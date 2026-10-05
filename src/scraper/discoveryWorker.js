/**
 * WishScout — Local Business Discovery & Intelligence
 * Copyright (C) 2026 Vishwjeet Singh Vilkhu (Original Creator & Architect)
 * Licensed under the GNU GPL-3.0. See LICENSE and NOTICE; attribution must be preserved (GPL-3.0 §7).
 */
// Runs inside an Electron utilityProcess (isolated from the main process).
import pw from 'playwright-core';
import { enrichWebsite } from './enrichmentWorker.js';
import { sleep, jitter, pick, UAS, proxyConfig, ProxyRotator, parseAddress, haversineKm, getGridPoints } from './helpers.js';
import { scrapeYellowPages } from './sources/yellowpages.js';
import { scrapeYelp } from './sources/yelp.js';
import { scrapeBingMaps } from './sources/bing.js';

const port = process.parentPort;
const ctl = { paused: false, aborted: false };
class Abort extends Error {}
const send = (type, data = {}) => port.postMessage({ type, ...data });
const log = (level, msg) => send('log', { level, msg });
const gate = async () => { while (ctl.paused && !ctl.aborted) await sleep(200); if (ctl.aborted) throw new Abort('aborted'); };

port.on('message', ({ data }) => {
  if (data.type === 'start') run(data.job).catch(err => (err instanceof Abort ? send('done', { aborted: true }) : send('fatal', { message: String(err?.message || err) })));
  else if (data.type === 'pause') ctl.paused = true;
  else if (data.type === 'resume') ctl.paused = false;
  else if (data.type === 'cancel') { ctl.aborted = true; ctl.paused = false; }
});

async function launchBrowser(settings, proxyRotator) {
  const isHeadless = settings?.headless !== false;
  const opts = { headless: isHeadless, args: ['--lang=en-US', '--disable-blink-features=AutomationControlled'] };
  const proxy = proxyRotator?.next() || proxyConfig(settings?.proxy);
  if (proxy) opts.proxy = proxy;
  let last;
  for (const channel of ['msedge', 'chrome']) {
    try { return await pw.chromium.launch({ ...opts, channel }); } catch (e) { last = e; }
  }
  throw new Error('Microsoft Edge or Google Chrome is required but could not be launched. ' + String(last?.message || '').split('\n')[0]);
}

const dismissConsent = page => page.getByRole('button', { name: /accept all|reject all|i agree/i }).first().click({ timeout: 4000 }).catch(() => {});

async function geocode(page, location) {
  await page.goto(`https://www.google.com/maps/search/${encodeURIComponent(location)}?hl=en`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await dismissConsent(page);
  await sleep(3500);
  const m = page.url().match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  return m ? { lat: +m[1], lng: +m[2] } : null;
}

async function* streamLinks(page, target, s) {
  const feed = page.locator('div[role="feed"]');
  try { await feed.waitFor({ timeout: 15000 }); }
  catch {
    if (/\/maps\/place\//.test(page.url())) { yield page.url(); return; }
    throw new Error('No results list appeared. The directory layout may have changed, or the query returned nothing.');
  }
  const seen = new Set();
  let stagnant = 0, yielded = 0;
  while (yielded < target && stagnant < 5) {
    await gate();
    const now = await page.$$eval('div[role="feed"] a[href*="/maps/place/"]', as => [...new Set(as.map(a => a.href))]).catch(() => []);
    let newFound = 0;
    for (const link of now) {
      if (!seen.has(link)) {
        seen.add(link);
        newFound++;
        yielded++;
        yield link;
        if (yielded >= target) return;
      }
    }
    if (newFound > 0) {
      stagnant = 0;
      log('INFO', `Discovered ${seen.size} candidate listing(s) so far…`);
    } else {
      stagnant++;
    }
    const endCount = await page.getByText(/You've reached the end of the list/i).count().catch(() => 0);
    if (endCount > 0) break;
    await feed.evaluate(el => el.scrollBy(0, el.scrollHeight)).catch(() => {});
    await sleep(jitter(s.delayMin, s.delayMax));
  }
}

async function scrapePlace(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  try { await page.waitForSelector('h1.DUwDvf', { timeout: 15000 }); } catch { return null; }
  await sleep(700);
  const u = page.url();
  const d = await page.evaluate(() => {
    const q = s => document.querySelector(s);
    const txt = s => (q(s)?.textContent || '').trim();
    const aria = (s, re) => (q(s)?.getAttribute('aria-label') || '').replace(re, '').trim();
    const rev = q('div.F7nice span[aria-label*="review"]')?.getAttribute('aria-label') || '';

    // Price range extraction: $, $$, $$$, ₹₹ or aria-label
    let price = '';
    const priceEl = q('span[aria-label*="Price:"]') || q('span.mgr77e span') || q('span[aria-label*="Moderate"]') || q('span[aria-label*="Inexpensive"]') || q('span[aria-label*="Expensive"]');
    if (priceEl) {
      price = (priceEl.getAttribute('aria-label') || priceEl.textContent || '').replace(/^\s*Price:\s*/i, '').trim();
    }
    if (!price) {
      const match = document.body.innerText.match(/\b([$€£₹]{1,4})\b/);
      if (match) price = match[1];
    }

    // Opening Hours / Business Status
    let hours = '';
    const hoursEl = q('button[data-item-id*="oh"]') || q('div[jsaction*="pane.openhours"]') || q('div.t39EBf') || q('span.ZDu9vd span') || q('div.M67rKe');
    if (hoursEl) {
      hours = (hoursEl.getAttribute('aria-label') || hoursEl.textContent || '').trim();
      hours = hours.replace(/\s+/g, ' ').replace(/^Open ⋅ /i, 'Open · ').replace(/^Closed ⋅ /i, 'Closed · ');
    }

    // Plus code
    const plusCode = aria('button[data-item-id="oloc"]', /^\s*Plus code:\s*/i);

    // Business Description / Overview
    const descEl = q('div.PYvSYb') || q('div.bJzME') || q('div[jslog*="description"]') || q('div.WeS02d');
    const description = (descEl?.textContent || '').trim();

    // High quality Thumbnail / Hero image
    const imgEl = q('button[jsaction*="heroHeaderImage"] img') || q('div.Z5OIFe img') || q('button.aoRNLd img') || q('img[decoding="async"][src*="googleusercontent.com"]');
    const thumbnail = imgEl?.src || '';

    return {
      name: txt('h1.DUwDvf'), category: txt('button[jsaction*="category"]'),
      address: aria('button[data-item-id="address"]', /^\s*Address:\s*/i), phone: aria('button[data-item-id^="phone"]', /^\s*Phone:\s*/i),
      website: q('a[data-item-id="authority"]')?.href || '',
      rating: parseFloat(txt('div.F7nice span[aria-hidden="true"]')) || 0, reviews: parseInt(rev.replace(/[^\d]/g, ''), 10) || 0,
      price_range: price, opening_hours: hours, plus_code: plusCode, description, thumbnail
    };
  });
  const clean = v => String(v || '').replace(/[\uE000-\uF8FF]/g, '').trim();
  const ll = u.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  return {
    name: clean(d.name), category: clean(d.category), address: clean(d.address), phone: clean(d.phone), website: d.website,
    rating: d.rating, review_count: d.reviews, place_id: (u.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i) || [])[1] || null,
    latitude: ll ? +ll[1] : null, longitude: ll ? +ll[2] : null,
    price_range: clean(d.price_range), opening_hours: clean(d.opening_hours), plus_code: clean(d.plus_code),
    description: clean(d.description), thumbnail: d.thumbnail || ''
  };
}

async function run(job) {
  const { location, category, limit, radius, settings, known, sources, websiteFilter, phoneRequired, ratingFilter } = job;
  const knownSet = new Set(known || []);
  const activeSources = Array.isArray(sources) && sources.length ? sources : ['google', 'bing'];
  const categories = String(category || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!categories.length) categories.push('local businesses');

  const passesFilters = rec => {
    if (!rec || !rec.name) return false;
    if (phoneRequired && (!rec.phone || !rec.phone.trim())) return false;
    if (websiteFilter === 'none' && rec.website && rec.website.trim()) return false;
    if (websiteFilter === 'has' && (!rec.website || !rec.website.trim())) return false;
    const r = Number(rec.rating) || 0;
    if (ratingFilter === 'high' && r < 4.5) return false;
    if (ratingFilter === 'low' && (r <= 0 || r >= 4.0)) return false;
    if (ratingFilter === 'poor' && (r <= 0 || r >= 3.5)) return false;
    return true;
  };

  const proxyRotator = new ProxyRotator(settings?.proxy);
  if (proxyRotator.count() > 1) {
    log('INFO', `Multi-proxy rotation pool active: ${proxyRotator.count()} rotating proxies loaded.`);
  }
  const browser = await launchBrowser(settings, proxyRotator);
  const reqProxy = proxyRotator.next() || proxyConfig(settings?.proxy);
  const req = await pw.request.newContext({ proxy: reqProxy, extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' } });
  try {
    const context = await browser.newContext({ userAgent: pick(UAS), locale: 'en-US', viewport: { width: 1366, height: 900 } });
    const searchPage = await context.newPage();
    let detailPage = await context.newPage();

    log('INFO', `Starting multi-source discovery (${activeSources.join(', ')}): [${categories.join(', ')}] in ${location}`);

    const hooks = { beforeRequest: async () => { await gate(); await sleep(jitter(settings.delayMin, settings.delayMax)); } };
    const enrichmentQueue = [];
    let activeEnrichments = 0;

    const pumpEnrichment = () => {
      while (activeEnrichments < settings.concurrency && enrichmentQueue.length > 0 && !ctl.aborted) {
        const item = enrichmentQueue.shift();
        activeEnrichments++;
        (async () => {
          try {
            const { _pages, ...e } = await enrichWebsite(req, item.website, hooks);
            if (!ctl.aborted) {
              send('record_enriched', { record: { ...item, ...e }, stage: 'enriched' });
            }
          } catch (err) {
            if (!(err instanceof Abort)) {
              log('WARN', `Enrichment failed for ${item.name}: ${String(err.message).split('\n')[0]}`);
            }
          } finally {
            activeEnrichments--;
            pumpEnrichment();
          }
        })();
      }
    };

    const enqueueEnrichment = rec => {
      enrichmentQueue.push(rec);
      pumpEnrichment();
    };

    let found = 0;

    // Geocode location once for radial grid exploration
    let center = null;
    let gridPoints = [{ lat: null, lng: null, label: 'Central Hub' }];
    if (activeSources.includes('google')) {
      log('INFO', 'Geocoding location for radial grid exploration…');
      center = await geocode(searchPage, location);
      if (radius > 0 && !center) log('WARN', 'Could not geocode location; radius filter disabled.');
      gridPoints = center ? getGridPoints(center, radius, limit) : [{ lat: null, lng: null, label: 'Central Hub' }];
      if (gridPoints.length > 1) {
        log('INFO', `Multi-Point Radial Grid active: generated ${gridPoints.length} sectors to bypass Google single-view limits.`);
      }
    }

    // Process all categories in batch
    for (let cIdx = 0; cIdx < categories.length; cIdx++) {
      if (found >= limit || ctl.aborted) break;
      const currentCategory = categories[cIdx];
      if (categories.length > 1) {
        log('INFO', `[Batch ${cIdx + 1}/${categories.length}] Scanning category: "${currentCategory}"…`);
      }

      // 1. Google Maps Source with Multi-Point Radial Grid Search
      if (activeSources.includes('google') && found < limit && !ctl.aborted) {
        const seenLinks = new Set();
        for (let pIdx = 0; pIdx < gridPoints.length; pIdx++) {
          if (found >= limit || ctl.aborted) break;
          const pt = gridPoints[pIdx];
          await gate();

          log('INFO', `[Google Maps Sector ${pIdx + 1}/${gridPoints.length}: ${pt.label}] Exploring "${currentCategory}"…`);
          const searchUrl = pt.lat && pt.lng
            ? `https://www.google.com/maps/search/${encodeURIComponent(currentCategory)}/@${pt.lat},${pt.lng},14z?hl=en`
            : `https://www.google.com/maps/search/${encodeURIComponent(`${currentCategory} in ${location}`)}?hl=en`;

          try {
            await searchPage.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 50000 });
            await dismissConsent(searchPage);
            await sleep(1500);

            const targetForSector = Math.min(limit - found, 120);
            for await (const link of streamLinks(searchPage, targetForSector, settings)) {
              if (found >= limit || ctl.aborted) break;
              await gate();

              if (seenLinks.has(link)) continue;
              seenLinks.add(link);

              const candidatePlaceId = (link.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i) || [])[1];
              if (candidatePlaceId && knownSet.has(candidatePlaceId)) {
                send('skipped', { name: 'Existing lead', phone: '' });
                continue;
              }

              if (detailPage.isClosed()) detailPage = await context.newPage();

              let biz = null;
              try { biz = await scrapePlace(detailPage, link); }
              catch (e) { log('WARN', `Skipped a listing: ${String(e.message).split('\n')[0]}`); }
              await sleep(jitter(settings.delayMin, settings.delayMax));

              if (!biz?.name) continue;
              if (center && radius > 0 && biz.latitude != null && haversineKm(center, { lat: biz.latitude, lng: biz.longitude }) > radius) {
                log('INFO', `Outside ${radius} km radius: ${biz.name}`);
                continue;
              }

              const a = parseAddress(biz.address, location);
              const rec = { ...biz, category: currentCategory, city: a.city, state: a.state, postal_code: a.postal, country: a.country };

              if (!passesFilters(rec)) continue;

              found++;
              send('progress', { found });

              if (biz.place_id && knownSet.has(biz.place_id)) {
                send('skipped', { name: biz.name, phone: biz.phone });
                continue;
              }

              send('record', { record: rec, stage: 'discovered' });
              if (rec.website) enqueueEnrichment(rec);
            }
          } catch (secErr) {
            log('WARN', `Sector ${pt.label} query finished: ${secErr.message}`);
          }
        }
      }

      // 2. Bing Maps Source (Global Coverage - India, US, UK, Europe, etc.)
      if (activeSources.includes('bing') && found < limit && !ctl.aborted) {
        log('INFO', `Scanning Bing Maps directory for "${currentCategory}"…`);
        try {
          let bingFound = 0;
          for await (const rec of scrapeBingMaps(context, currentCategory, location, limit - found, settings, gate, ctl, log)) {
            if (found >= limit || ctl.aborted) break;
            await gate();

            if (!passesFilters(rec)) continue;

            found++;
            bingFound++;
            send('progress', { found });
            send('record', { record: rec, stage: 'discovered' });
            if (rec.website) enqueueEnrichment(rec);
          }
          log('INFO', `Bing Maps scan finished: ${bingFound} listing(s) found.`);
        } catch (bingErr) {
          log('WARN', `Bing Maps scan ended: ${bingErr.message}`);
        }
      }

      // 3. YellowPages Source
      if (activeSources.includes('yellowpages') && found < limit && !ctl.aborted) {
        log('INFO', `Scanning YellowPages directory for "${currentCategory}"…`);
        try {
          for await (const rec of scrapeYellowPages(context, currentCategory, location, limit - found, settings, gate, ctl, log)) {
            if (found >= limit || ctl.aborted) break;
            await gate();

            if (!passesFilters(rec)) continue;

            found++;
            send('progress', { found });
            send('record', { record: rec, stage: 'discovered' });
            if (rec.website) enqueueEnrichment(rec);
          }
        } catch (ypErr) {
          log('WARN', `YellowPages scan ended: ${ypErr.message}`);
        }
      }

      // 4. Yelp Source
      if (activeSources.includes('yelp') && found < limit && !ctl.aborted) {
        log('INFO', `Scanning Yelp local businesses for "${currentCategory}"…`);
        try {
          for await (const rec of scrapeYelp(context, currentCategory, location, limit - found, settings, gate, ctl, log)) {
            if (found >= limit || ctl.aborted) break;
            await gate();

            if (!passesFilters(rec)) continue;

            found++;
            send('progress', { found });
            send('record', { record: rec, stage: 'discovered' });
            if (rec.website) enqueueEnrichment(rec);
          }
        } catch (yelpErr) {
          log('WARN', `Yelp scan ended: ${yelpErr.message}`);
        }
      }
    }

    // Wait for in-flight website enrichments to finish
    while ((enrichmentQueue.length > 0 || activeEnrichments > 0) && !ctl.aborted) {
      await sleep(200);
    }

    send('done', { aborted: ctl.aborted });
  } finally {
    await req.dispose().catch(() => {});
    await browser.close().catch(() => {});
  }
}
