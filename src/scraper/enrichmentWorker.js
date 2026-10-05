/**
 * WishScout — Local Business Discovery & Intelligence
 * Copyright (C) 2026 Vishwjeet Singh Vilkhu (Original Creator & Architect)
 * Licensed under the GNU GPL-3.0. See LICENSE and NOTICE; attribution must be preserved (GPL-3.0 §7).
 */
import * as cheerio from 'cheerio';
import { UAS, pick } from './helpers.js';

const PATHS = ['/', '/contact', '/contact-us', '/about', '/about-us', '/team'];
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const JUNK_LOCAL = /^(privacy|abuse|noreply|no-reply|donotreply|do-not-reply|postmaster|webmaster|mailer-daemon|root|hostmaster|spam|unsubscribe)$/i;
const JUNK_DOMAIN = /(^|\.)(example\.(com|org)|domain\.com|yourdomain\.com|email\.com|test\.com|sentry\.io|wixpress\.com)$/i;
const FILE_EXT = /\.(png|jpe?g|gif|webp|svg|css|js|ico|woff2?)$/i;

const SOCIAL = {
  linkedin: /linkedin\.com\/(company|in)\/[^/?#\s]+/i,
  instagram: /instagram\.com\/(?!p\/|explore|reel|accounts|share)[^/?#\s]+/i,
  facebook: /facebook\.com\/(?!sharer|share|plugins|tr\b|dialog|login|policies)[^/?#\s]+/i,
  twitter: /(?:twitter|x)\.com\/(?!intent|share|home|i\/)[^/?#\s]+/i,
  youtube: /youtube\.com\/(?:@|channel\/|c\/|user\/)[^/?#\s]+/i
};

const TITLE_RE = /\b(co-?founder|founder|owner|managing director|managing partner|principal|chief executive officer|ceo|proprietor|president)\b/i;
const NAME_RE = /\b(?:Dr\.?\s+)?[A-Z][a-z'’-]{1,20}(?:\s+[A-Z]\.)?(?:\s+[A-Z][a-z'’-]{1,24}){1,2}\b/g;
const STOP = new Set('meet our the about us team contact home welcome hello from message words story leadership management staff his her their we is are of a an at in by for to and with your founder owner president'.split(' '));

export function isValidEmail(e) {
  const [local, domain] = e.toLowerCase().split('@');
  return !!domain && !JUNK_LOCAL.test(local) && !JUNK_DOMAIN.test(domain) && !FILE_EXT.test(e) && e.length < 80;
}

// ---- robots.txt (minimal: honours Disallow rules for User-agent: *) ----
const robotsCache = new Map();
async function robotsAllows(req, origin, p) {
  if (!robotsCache.has(origin)) {
    const rules = [];
    try {
      const r = await req.get(origin + '/robots.txt', { timeout: 6000, failOnStatusCode: false });
      if (r.ok()) {
        let applies = false;
        for (const line of (await r.text()).split(/\r?\n/)) {
          const [k, ...v] = line.split('#')[0].split(':');
          const key = (k || '').trim().toLowerCase(), val = v.join(':').trim();
          if (key === 'user-agent') applies = val === '*';
          else if (applies && key === 'disallow' && val && !/[*$]/.test(val)) rules.push(val);
        }
      }
    } catch { /* unreachable robots.txt = no rules */ }
    robotsCache.set(origin, rules);
  }
  return !robotsCache.get(origin).some(rule => p.startsWith(rule));
}

async function fetchHtml(req, url) {
  const r = await req.get(url, {
    timeout: 12000, maxRedirects: 4, failOnStatusCode: false,
    headers: { 'User-Agent': pick(UAS), Accept: 'text/html,application/xhtml+xml' }
  });
  if (!r.ok() || !/html/i.test(r.headers()['content-type'] || '')) return null;
  return (await r.text()).slice(0, 1_500_000);
}

const okName = n => { const w = n.replace(/^Dr\.?\s+/, '').split(/\s+/); return w.length >= 2 && !w.some(x => STOP.has(x.toLowerCase())); };
const nameFrom = (str, last) => { const ms = [...str.matchAll(NAME_RE)].map(m => m[0].trim()).filter(okName); return ms.length ? (last ? ms.at(-1) : ms[0]) : ''; };
const titleCase = t => (/^ceo$/i.test(t) ? 'CEO' : t.replace(/\b\w/g, c => c.toUpperCase()));

export function extractOwner($) {
  for (const el of $('h1,h2,h3,h4,h5,h6,p,li,span,strong,b,div,a').toArray()) {
    const $el = $(el);
    if ($el.children().length > 3) continue;
    const t = $el.text().replace(/\s+/g, ' ').trim();
    if (!t || t.length > 140) continue;
    const m = t.match(TITLE_RE);
    if (!m) continue;
    let name = nameFrom(t.slice(0, m.index), true) || nameFrom(t.slice(m.index + m[0].length), false);
    if (!name && t.length <= m[0].length + 4) name = nameFrom(($el.prev().text() || $el.parent().prev().text() || '').replace(/\s+/g, ' ').trim(), false);
    if (name) return { name, title: titleCase(m[0]) };
  }
  return null;
}

/**
 * Crawl homepage + contact/about/team pages of one website.
 * hooks.beforeRequest() is awaited before every request (pause gate + jitter delay).
 */
export async function enrichWebsite(req, website, hooks = {}) {
  const base = new URL(/^https?:\/\//i.test(website) ? website : 'https://' + website);
  const siteDomain = base.hostname.replace(/^www\./, '').toLowerCase();
  const emails = [], social = {};
  let owner = null;

  const addSocial = raw => {
    for (const [key, re] of Object.entries(SOCIAL)) {
      const m = String(raw).match(re);
      if (!m) continue;
      const clean = 'https://' + m[0].replace(/^https?:\/\/(www\.)?/i, '');
      if (!social[key] || (key === 'linkedin' && /\/company\//i.test(clean) && !/\/company\//i.test(social[key]))) social[key] = clean;
    }
  };
  const walk = n => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    if (n.email) emails.push(String(n.email).replace(/^mailto:/i, ''));
    if (n.sameAs) [].concat(n.sameAs).forEach(addSocial);
    if (n.founder && !owner) [].concat(n.founder).forEach(f => { const nm = typeof f === 'string' ? f : f?.name; if (nm && !owner && okName(nm)) owner = { name: nm, title: 'Founder' }; });
    Object.values(n).forEach(walk);
  };

  let fetched = 0;
  for (const p of PATHS) {
    await hooks.beforeRequest?.();
    if (!(await robotsAllows(req, base.origin, p))) continue;
    let html = null;
    try { html = await fetchHtml(req, base.origin + p); } catch { /* network error */ }
    if (!html) { if (p === '/') break; continue; }
    fetched++;
    const $ = cheerio.load(html);
    $('a[href]').each((_, a) => {
      const href = $(a).attr('href') || '';
      if (/^mailto:/i.test(href)) emails.push(decodeURIComponent(href.slice(7).split('?')[0]));
      else addSocial(href);
    });
    $('script[type="application/ld+json"]').each((_, s) => { try { walk(JSON.parse($(s).text())); } catch { /* bad JSON-LD */ } });
    $('script,style,noscript').remove();
    emails.push(...($('body').text().match(EMAIL_RE) || []));
    if (!owner && p !== '/contact' && p !== '/contact-us') owner = extractOwner($);
  }

  const good = [...new Set(emails.map(e => e.trim().toLowerCase()).filter(isValidEmail))];
  const best = good.find(e => e.split('@')[1].endsWith(siteDomain)) || good[0] || '';
  return {
    email: best, owner_name: owner?.name || '', owner_title: owner?.title || '',
    social_linkedin: social.linkedin || '', social_instagram: social.instagram || '', social_facebook: social.facebook || '',
    social_twitter: social.twitter || '', social_youtube: social.youtube || '', _pages: fetched
  };
}
