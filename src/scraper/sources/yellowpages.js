/**
 * WishScout — Local Business Discovery & Intelligence
 * Copyright (C) 2026 Vishwjeet Singh Vilkhu (Original Creator & Architect)
 * Licensed under the GNU GPL-3.0. See LICENSE and NOTICE; attribution must be preserved (GPL-3.0 §7).
 */
import { sleep, jitter, parseAddress } from '../helpers.js';

export async function* scrapeYellowPages(context, category, location, maxResults = 100, settings, gate, ctl, log) {
  let page = null;
  try {
    page = await context.newPage();
    let found = 0;
    let pageNum = 1;
    const maxPages = Math.min(10, Math.ceil(maxResults / 25));

    while (found < maxResults && pageNum <= maxPages && !ctl.aborted) {
      await gate();
      const url = `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(category)}&geo_location_terms=${encodeURIComponent(location)}&page=${pageNum}`;
      log('INFO', `[YellowPages Page ${pageNum}] Fetching business directory...`);

      let response = null;
      try {
        response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
      } catch (err) {
        log('WARN', `YellowPages page ${pageNum} load failed: ${err.message}`);
        break;
      }

      if (!response || response.status() === 403 || response.status() === 429) {
        log('WARN', `YellowPages returned status ${response?.status() || 403}. Regional verification active.`);
        break;
      }

      await sleep(jitter(settings.delayMin, settings.delayMax));

      const listings = await page.evaluate(() => {
        const results = [];
        const cards = document.querySelectorAll('.result, .v-card, .info');
        for (const card of cards) {
          const nameEl = card.querySelector('a.business-name, .info-section h2 a');
          const name = nameEl?.textContent?.trim();
          if (!name || name.length < 2) continue;

          const phoneEl = card.querySelector('.phones, [class*="phone"]');
          const phone = phoneEl?.textContent?.trim() || '';

          const streetEl = card.querySelector('.street-address');
          const street = streetEl?.textContent?.trim() || '';

          const locEl = card.querySelector('.locality');
          const locality = locEl?.textContent?.trim() || '';

          const webEl = card.querySelector('a.track-visit-website');
          const website = webEl?.href || '';

          const catEl = card.querySelector('.categories a');
          const cat = catEl?.textContent?.trim() || '';

          const ratingEl = card.querySelector('[class*="rating-stars"] [class*="rating"], [class*="rating"]');
          let rating = 0;
          if (ratingEl) {
            const cls = ratingEl.className || '';
            const match = cls.match(/result-rating\s+([a-z]+)/i) || cls.match(/rating-(\d+)/);
            if (match) rating = 4.0;
          }

          const descEl = card.querySelector('p.snippet, .body, .description');
          const description = descEl?.textContent?.trim() || '';

          const imgEl = card.querySelector('img[class*="thumb"], img[src*="media"]');
          const thumbnail = imgEl?.src || '';

          results.push({
            name,
            phone,
            address: [street, locality].filter(Boolean).join(', '),
            website,
            category: cat,
            rating,
            description,
            thumbnail
          });
        }
        return results;
      });

      if (!listings || listings.length === 0) {
        if (pageNum === 1) {
          log('WARN', `YellowPages returned 0 listings for "${location}". Note: YellowPages (.com) only covers the United States and Canada.`);
        } else {
          log('INFO', 'YellowPages: No more listings on this page.');
        }
        break;
      }

      for (const item of listings) {
        if (found >= maxResults || ctl.aborted) break;
        const a = parseAddress(item.address, location);
        yield {
          name: item.name,
          category: item.category || category,
          address: item.address,
          city: a.city,
          state: a.state,
          postal_code: a.postal,
          country: a.country,
          phone: item.phone,
          website: item.website,
          rating: item.rating || 0,
          review_count: 0,
          place_id: null,
          latitude: null,
          longitude: null,
          description: item.description || '',
          thumbnail: item.thumbnail || ''
        };
        found++;
      }

      pageNum++;
    }
  } catch (e) {
    log('WARN', `YellowPages scan ended: ${e.message}`);
  } finally {
    if (page && !page.isClosed()) await page.close().catch(() => {});
  }
}
