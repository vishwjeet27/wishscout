/**
 * WishScout — Local Business Discovery & Intelligence
 * Copyright (C) 2026 Vishwjeet Singh Vilkhu (Original Creator & Architect)
 * Licensed under the GNU GPL-3.0. See LICENSE and NOTICE; attribution must be preserved (GPL-3.0 §7).
 */
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const jitter = (min, max) => Math.round(min + Math.random() * Math.max(0, max - min));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0'
];

export function proxyConfig(str) {
  if (!str) return undefined;
  const u = new URL(str);
  const cfg = { server: `${u.protocol}//${u.host}` };
  if (u.username) cfg.username = decodeURIComponent(u.username);
  if (u.password) cfg.password = decodeURIComponent(u.password);
  return cfg;
}

export class ProxyRotator {
  constructor(proxyInput) {
    this.proxies = [];
    if (proxyInput) {
      const lines = String(proxyInput)
        .split(/[\r\n,;]+/)
        .map(s => s.trim())
        .filter(Boolean);
      for (const line of lines) {
        try {
          const cfg = proxyConfig(line);
          if (cfg) this.proxies.push(cfg);
        } catch {}
      }
    }
    this.index = 0;
  }
  next() {
    if (!this.proxies.length) return undefined;
    const p = this.proxies[this.index % this.proxies.length];
    this.index++;
    return p;
  }
  first() {
    return this.proxies[0] || undefined;
  }
  all() {
    return this.proxies;
  }
  count() {
    return this.proxies.length;
  }
}

export function haversineKm(a, b) {
  const R = 6371, rad = d => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Best-effort split of a Google Maps style address into city/state/postal/country. */
export function parseAddress(address = '', location = '') {
  const parts = address.split(',').map(s => s.trim()).filter(Boolean);
  const loc = location.split(',').map(s => s.trim()).filter(Boolean);
  let country = '', state = '', postal = '', city = '';
  if (parts.length >= 3 && !/\d/.test(parts.at(-1)) && parts.at(-1).length > 3) country = parts.pop();
  const m = (parts.at(-1) || '').match(/^(.*?)\s*(\b\d{4,6}(?:-\d{4})?\b|[A-Z]\d[A-Z] ?\d[A-Z]\d|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/);
  if (m) { state = m[1].trim(); postal = m[2]; parts.pop(); }
  else if (parts.length >= 3 && /^[A-Za-z .]{2,}$/.test(parts.at(-1))) state = parts.pop();
  city = parts.length > 1 ? parts.at(-1) : '';
  if (!city || /\d/.test(city)) city = loc[0] || '';
  if (!state && loc[1]) state = loc[1];
  if (!country && loc.length > 1) country = loc.at(-1);
  return { city, state, postal, country };
}

/** Generates concentric radial coordinates around center location to bypass single-viewport discovery caps. */
export function getGridPoints(center, radiusKm = 0, targetCount = 50) {
  if (!center?.lat || !center?.lng) return [{ lat: null, lng: null, label: 'Central Hub' }];

  // Single sector is sufficient for small queries with no radius restriction
  if (targetCount <= 80 && radiusKm === 0) {
    return [{ lat: center.lat, lng: center.lng, label: 'Central Hub' }];
  }

  const effRadius = radiusKm > 0 ? radiusKm : Math.min(25, Math.max(10, Math.round(targetCount / 35)));
  const points = [{ lat: center.lat, lng: center.lng, label: 'Central Hub' }];

  const R = 6371;
  const rad = Math.PI / 180;
  const lat1 = center.lat * rad;
  const lon1 = center.lng * rad;

  const offset = (distKm, brngDeg, label) => {
    const dByR = distKm / R;
    const brng = brngDeg * rad;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dByR) + Math.cos(lat1) * Math.sin(dByR) * Math.cos(brng));
    const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dByR) * Math.cos(lat1), Math.cos(dByR) - Math.sin(lat1) * Math.sin(lat2));
    return {
      lat: +(lat2 / rad).toFixed(6),
      lng: +(lon2 / rad).toFixed(6),
      label
    };
  };

  // Ring 1: 4 cardinal directions (55% distance)
  const r1 = +(effRadius * 0.55).toFixed(1);
  points.push(
    offset(r1, 0, 'North Sector'),
    offset(r1, 90, 'East Sector'),
    offset(r1, 180, 'South Sector'),
    offset(r1, 270, 'West Sector')
  );

  // Ring 2: 4 diagonal sectors (90% distance)
  if (targetCount > 140 || radiusKm > 10) {
    const r2 = +(effRadius * 0.9).toFixed(1);
    points.push(
      offset(r2, 45, 'North-East Sector'),
      offset(r2, 135, 'South-East Sector'),
      offset(r2, 225, 'South-West Sector'),
      offset(r2, 315, 'North-West Sector')
    );
  }

  // Ring 3: 4 outer perimeter sectors for large 400+ lead queries
  if (targetCount > 350) {
    const r3 = +(effRadius * 1.3).toFixed(1);
    points.push(
      offset(r3, 0, 'Outer North Sector'),
      offset(r3, 90, 'Outer East Sector'),
      offset(r3, 180, 'Outer South Sector'),
      offset(r3, 270, 'Outer West Sector')
    );
  }

  return points;
}
