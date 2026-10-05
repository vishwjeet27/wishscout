/**
 * WishScout — Local Business Discovery & Intelligence
 * Copyright (C) 2026 Vishwjeet Singh Vilkhu (Original Creator & Architect)
 * Licensed under the GNU GPL-3.0. See LICENSE and NOTICE; attribution must be preserved (GPL-3.0 §7).
 */
import { sleep, jitter, parseAddress } from '../helpers.js';

export async function* scrapeBingMaps(context, category, location, maxResults = 100, settings, gate, ctl, log) {
  let page = null;
  try {
    page = await context.newPage();
    let found = 0;
    const url = `https://www.bing.com/maps?q=${encodeURIComponent(`${category} in ${location}`)}`;
    log('INFO', `[Bing Maps] Querying global business directory for ${category} in ${location}…`);

    let response = null;
    try {
      response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch (err) {
      log('WARN', `Bing Maps load failed: ${err.message}`);
      return;
    }

    await sleep(3500);

    // Extract business listings from Bing Maps task pane
    const rawListings = await page.evaluate(() => {
      const items = [];
      const aside = document.querySelector('aside, div[class*="contentPane"], div.pageNonNav_if3Am, div[class*="localSearch"]');
      const root = aside || document.body;

      // Extract all potential business card blocks
      const text = root.innerText || '';
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      // Extract all external website links if present
      const links = [...root.querySelectorAll('a[href^="http"]')].map(a => a.href).filter(h => !h.includes('bing.com') && !h.includes('microsoft.com') && !h.includes('msn.com'));

      // Parse structured text blocks
      let currentBiz = null;
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (l.includes('·') || /\b\d{4,}\b/.test(l) || /\b0\d{9,11}\b/.test(l)) {
          // This line likely contains phone or hours
          const phoneMatch = l.match(/(?:\+?\d{1,3}[ -]?)?(?:(?:\(?\d{2,5}\)?[ -]?)?\d{3,5}[ -]?\d{3,5})/);
          if (phoneMatch && currentBiz) {
            currentBiz.phone = phoneMatch[0].trim();
            if (!currentBiz.address && i > 1) {
              currentBiz.address = lines[i - 1];
            }
            items.push(currentBiz);
            currentBiz = null;
          }
        } else if (l.length >= 3 && l.length <= 80 && !['Sign in', 'Directions', 'Feedback', 'Details', 'Road', 'Satellite', 'Filter'].includes(l)) {
          if (!currentBiz) {
            currentBiz = { name: l, category: '', address: '', phone: '', website: '' };
          } else if (!currentBiz.category) {
            currentBiz.category = l;
          } else {
            currentBiz.address = l;
          }
        }
      }

      return { items, links };
    });

    const parsed = rawListings?.items || [];
    log('INFO', `Bing Maps: Found ${parsed.length} candidate business listings.`);

    const seenNames = new Set();
    for (const item of parsed) {
      if (found >= maxResults || ctl.aborted) break;
      if (!item.name || seenNames.has(item.name)) continue;
      seenNames.add(item.name);

      const a = parseAddress(item.address, location);
      yield {
        name: item.name,
        category: item.category || category,
        address: item.address || `${a.city}, ${a.state}`,
        city: a.city,
        state: a.state,
        postal_code: a.postal,
        country: a.country,
        phone: item.phone || '',
        website: item.website || '',
        rating: 4.0,
        review_count: 0,
        place_id: null,
        latitude: null,
        longitude: null,
        source: 'Bing Maps'
      };
      found++;
    }
  } catch (e) {
    log('WARN', `Bing Maps scan ended: ${e.message}`);
  } finally {
    if (page && !page.isClosed()) await page.close().catch(() => {});
  }
}
