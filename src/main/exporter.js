/**
 * WishScout — Local Business Discovery & Intelligence
 * Copyright (C) 2026 Vishwjeet Singh Vilkhu (Original Creator & Architect)
 * Licensed under the GNU GPL-3.0. See LICENSE and NOTICE; attribution must be preserved (GPL-3.0 §7).
 */
import fs from 'node:fs';
import path from 'node:path';
import { BrowserWindow } from 'electron';

const COLUMNS = [
  ['ID', 'id'], ['Business Name', 'name'], ['Category', 'category'], ['Price Tier', 'price_range'], ['Opening Hours', 'opening_hours'],
  ['Owner Name', 'owner_name'], ['Owner Title', 'owner_title'],
  ['Email', 'email'], ['Phone', 'phone'], ['Address', 'address'], ['City', 'city'], ['State', 'state'], ['Postal Code', 'postal_code'],
  ['Country', 'country'], ['Website', 'website'], ['LinkedIn', 'social_linkedin'], ['Instagram', 'social_instagram'],
  ['Facebook', 'social_facebook'], ['Twitter', 'social_twitter'], ['Rating', 'rating'], ['Reviews', 'review_count'],
  ['Overview', 'description'], ['Plus Code', 'plus_code'], ['Thumbnail', 'thumbnail'],
  ['Pipeline Status', 'status'], ['Discovered Date', r => new Date(r.discovered_at).toISOString().slice(0, 10)], ['Notes', 'notes']
];

// Neutralise spreadsheet formula injection from scraped text (phone-like values starting with + or - are left alone).
function cell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !/^[+-]?[\d\s().-]+$/.test(s))) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows) {
  const head = COLUMNS.map(c => cell(c[0])).join(',');
  const body = rows.map(r => COLUMNS.map(([, k]) => cell(typeof k === 'function' ? k(r) : r[k])).join(','));
  return '\uFEFF' + [head, ...body].join('\r\n');
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function dossierHtml(rows, logoPath, branding = {}) {
  let logo = '';
  if (branding.logoDataUrl) {
    logo = branding.logoDataUrl;
  } else {
    try { logo = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64'); } catch { /* optional */ }
  }

  const agency = esc(branding.agencyName || 'WishScout Intelligence');
  const title = esc(branding.dossierTitle || 'Executive Prospect Dossier');
  const subtitle = esc(branding.clientNote || `${rows.length} qualified commercial leads · Generated ${new Date().toLocaleDateString()}`);
  const accent = esc(branding.accentColor || '#0f172a');
  const showThumbs = branding.includeThumbnails !== false;

  const field = (l, v) => (v ? `<tr><th>${l}</th><td>${esc(v)}</td></tr>` : '');
  const cards = rows.map(r => `<section>
    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
      <div>
        <h2 style="color:${accent};">${esc(r.name)}</h2>
        <p class="cat">${esc(r.category)} · ${esc(r.status)}${r.price_range ? ` · <span style="font-weight:bold;color:#16a34a">${esc(r.price_range)}</span>` : ''}</p>
      </div>
      ${showThumbs && r.thumbnail ? `<img src="${esc(r.thumbnail)}" alt="" style="width: 72px; height: 54px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1;" />` : ''}
    </div>
    <table>
    ${field('Overview', r.description)}
    ${field('Opening Hours', r.opening_hours)}
    ${field('Decision maker', [r.owner_name, r.owner_title].filter(Boolean).join(', '))}
    ${field('Phone', r.phone)}${field('Email', r.email)}
    ${field('Website', r.website)}${field('Address', [r.address].filter(Boolean).join(''))}
    ${field('Location', [r.city, r.state, r.country].filter(Boolean).join(', '))}
    ${field('Reputation', r.rating ? `${r.rating} / 5 (${r.review_count} reviews)` : '')}
    ${field('Plus Code', r.plus_code)}
    ${field('LinkedIn', r.social_linkedin)}${field('Instagram', r.social_instagram)}
    ${field('Facebook', r.social_facebook)}${field('Twitter / X', r.social_twitter)}${field('YouTube', r.social_youtube)}
    ${field('Notes', r.notes)}
    </table></section>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body{font:11pt/1.45 Helvetica,Arial,sans-serif;color:#0f172a;margin:0}
  header{display:flex;align-items:center;gap:14px;border-bottom:3px solid ${accent};padding-bottom:12px;margin-bottom:18px}
  header img{max-width:54px;max-height:54px;border-radius:8px;object-fit:contain}
  header h1{font-size:20pt;margin:0;color:${accent}} header p{margin:2px 0 0;color:#475569;font-size:11pt}
  .agency-badge{display:inline-block;padding:2px 8px;background:#f1f5f9;border-radius:4px;font-size:9pt;font-weight:700;color:#334155;margin-bottom:4px}
  section{page-break-inside:avoid;border:1px solid #cbd5e1;border-radius:8px;padding:12px 16px;margin-bottom:12px}
  h2{margin:0;font-size:13pt}.cat{margin:2px 0 8px;color:#475569}
  table{border-collapse:collapse;width:100%}th{text-align:left;width:120px;color:#475569;font-weight:600;vertical-align:top;padding:2px 8px 2px 0}td{padding:2px 0;word-break:break-word}
  footer{margin-top:22px;color:#64748b;font-size:9pt;text-align:center;border-top:1px solid #e2e8f0;padding-top:10px}</style></head><body>
  <header>${logo ? `<img src="${logo}" alt="">` : ''}<div><span class="agency-badge">${agency}</span><h1>${title}</h1><p>${subtitle}</p></div></header>
  ${cards || '<p>No records.</p>'}<footer>Prepared via ${agency} · WishScout Engine (Architect: Vishwjeet Singh Vilkhu · GPL-3.0)</footer></body></html>`;
}

export async function renderPdf(html, tmpDir) {
  const file = path.join(tmpDir, `dossier-${Date.now()}.html`);
  fs.writeFileSync(file, html);
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  try {
    await win.loadFile(file);
    return await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
  } finally { win.destroy(); fs.rmSync(file, { force: true }); }
}
