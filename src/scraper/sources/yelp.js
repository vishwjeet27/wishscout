/**
 * WishScout — Local Business Discovery & Intelligence
 * Copyright (C) 2026 Vishwjeet Singh Vilkhu (Original Creator & Architect)
 * Licensed under the GNU GPL-3.0. See LICENSE and NOTICE; attribution must be preserved (GPL-3.0 §7).
 */
import { sleep, jitter, parseAddress } from '../helpers.js';

export async function* scrapeYelp(context, category, location, maxResults = 100, settings, gate, ctl, log) {
  let page = null;
  try {
    page = await context.newPage();
    let found = 0;
    let startIdx = 0;
    const maxPages = Math.min(8, Math.ceil(maxResults / 10));
    let pageCount = 0;

    while (found < maxResults && pageCount < maxPages && !ctl.aborted) {
      await gate();
      const url = `https://www.yelp.com/search?find_desc=${encodeURIComponent(category)}&find_loc=${encodeURIComponent(location)}&start=${startIdx}`;
      log('INFO', `[Yelp Page ${pageCount + 1}] Searching local businesses...`);

      let response = null;
      try {
        response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
      } catch (err) {
        log('WARN', `Yelp page load failed: ${err.message}`);
        break;
      }

      if (!response || response.status() === 403 || response.status() === 429) {
        log('WARN', `Yelp returned status ${response?.status() || 403}. Regional verification active.`);
        break;
      }

      await sleep(jitter(settings.delayMin, settings.delayMax));

      const listings = await page.evaluate(() => {
        const results = [];
        const links = document.querySelectorAll('a[href*="/biz/"]');
        const seenNames = new Set();

        for (const a of links) {
          const name = a.textContent?.trim();
          if (!name || name.length < 2 || seenNames.has(name) || name.includes('Write a Review')) continue;
          if (a.closest('[data-testid*="ad-banner"]') || a.href.includes('/adredir')) continue;

          seenNames.add(name);
          const card = a.closest('div[class*="container__"]') || a.closest('li') || a.parentElement;
          const ratingEl = card?.querySelector('[aria-label*="star rating"]');
          const ratingText = ratingEl?.getAttribute('aria-label') || '';
          const ratingMatch = ratingText.match(/(\d+(\.\d+)?)/);
          const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

          const phoneEl = card?.querySelector('[class*="phone"]');
          const phone = phoneEl?.textContent?.trim() || '';

          const priceEl = card?.querySelector('[class*="priceRange"], [class*="price-range"]');
          const price = priceEl?.textContent?.trim() || '';

          const imgEl = card?.querySelector('img[src*="bphoto"]');
          const thumbnail = imgEl?.src || '';

          results.push({
            name,
            phone,
            rating,
            price_range: price,
            thumbnail,
            href: a.href
          });
        }
        return results;
      });

      if (!listings || listings.length === 0) {
        if (pageCount === 0) {
          log('WARN', `Yelp returned 0 listings for "${location}". Note: Yelp only indexes US, UK, Canada & Western Europe; it does not operate in India or Asia.`);
        } else {
          log('INFO', 'Yelp: No more listings on this page.');
        }
        break;
      }

      for (const item of listings) {
        if (found >= maxResults || ctl.aborted) break;
        const a = parseAddress('', location);
        yield {
          name: item.name,
          category: category,
          address: `${a.city}, ${a.state}`,
          city: a.city,
          state: a.state,
          postal_code: a.postal,
          country: a.country,
          phone: item.phone,
          website: '', // Enricher can resolve website through phone / domain if available
          rating: item.rating || 0,
          review_count: 0,
          place_id: null,
          latitude: null,
          longitude: null,
          price_range: item.price_range || '',
          thumbnail: item.thumbnail || ''
        };
        found++;
      }

      startIdx += 10;
      pageCount++;
    }
  } catch (e) {
    log('WARN', `Yelp scan ended: ${e.message}`);
  } finally {
    if (page && !page.isClosed()) await page.close().catch(() => {});
  }
}
