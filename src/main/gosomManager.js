/**
 * WishScout — Local Business Discovery & Intelligence
 * Copyright (C) 2026 Vishwjeet Singh Vilkhu (Original Creator & Architect)
 * Licensed under the GNU GPL-3.0. See LICENSE and NOTICE; attribution must be preserved (GPL-3.0 §7).
 *
 * Upstream Engine Credit & Attribution:
 * Google Maps Scraper (gosom/google-maps-scraper)
 * Created by Georgios Somarakis (gosom) — https://github.com/gosom/google-maps-scraper
 * Licensed under the MIT License. See NOTICE for full license text.
 */
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { parseAddress } from '../scraper/helpers.js';

const execFileAsync = promisify(execFile);

const blankCounters = () => ({ found: 0, added: 0, duplicates: 0, enriched: 0 });

export function mapGosomEntry(entry, queryLabel = 'Gosom Engine') {
  const clean = v => (v == null ? '' : String(v).trim());
  const name = clean(entry.title || entry.name);
  if (!name) return null;

  let category = clean(entry.category);
  if (!category && Array.isArray(entry.categories) && entry.categories.length) {
    category = clean(entry.categories[0]);
  }
  if (!category) category = 'Local Business';

  // Address parsing
  let address = clean(entry.address);
  let city = '', state = '', postal_code = '', country = '';
  if (entry.complete_address && typeof entry.complete_address === 'object') {
    city = clean(entry.complete_address.city);
    state = clean(entry.complete_address.state);
    postal_code = clean(entry.complete_address.postal_code);
    country = clean(entry.complete_address.country);
    if (!address) {
      address = [entry.complete_address.street, city, state, postal_code, country].filter(Boolean).join(', ');
    }
  }

  const cleanCityHint = String(queryLabel || '')
    .replace(/^Gosom:\s*/i, '')
    .replace(/^.*?\bin\s+/i, '')
    .replace(/^.*?\bnear\s+/i, '')
    .trim();

  if ((!city || city === 'Unknown') && address) {
    const parsed = parseAddress(address, cleanCityHint);
    if (parsed.city) city = parsed.city;
    if (!state && parsed.state) state = parsed.state;
    if (!postal_code && parsed.postal) postal_code = parsed.postal;
    if (!country && parsed.country) country = parsed.country;
  }

  if ((!city || city === 'Unknown') && cleanCityHint && !/\d/.test(cleanCityHint)) {
    city = cleanCityHint;
  }

  if (!country || country === 'Unknown') {
    if (/\b(?:United Arab Emirates|UAE|Dubai|Abu Dhabi|Sharjah)\b/i.test(address)) country = 'United Arab Emirates';
    else if (/\b(?:India|Goa|Maharashtra|Delhi|Karnataka)\b/i.test(address)) country = 'India';
    else if (/\b(?:Germany|Deutschland|Berlin|München)\b/i.test(address)) country = 'Germany';
    else if (/\b(?:United States|USA)\b/i.test(address)) country = 'United States';
    else if (/\b(?:United Kingdom|UK|England|London)\b/i.test(address)) country = 'United Kingdom';
  }

  // Opening hours
  let hours = '';
  if (entry.open_hours && typeof entry.open_hours === 'object') {
    hours = Object.entries(entry.open_hours)
      .map(([day, val]) => `${day}: ${Array.isArray(val) ? val.join(', ') : val}`)
      .join('; ');
  } else if (typeof entry.open_hours === 'string') {
    hours = clean(entry.open_hours);
  }

  // Rating & Review count
  const rating = Number(entry.review_rating ?? entry.rating) || 0;
  const review_count = Math.trunc(Number(entry.review_count ?? entry.reviews) || 0);

  // Phone
  const phone = clean(entry.phone);

  // Website & Email
  const website = clean(entry.web_site || entry.website);
  let email = clean(entry.email);
  if (!email && Array.isArray(entry.emails) && entry.emails.length) {
    email = clean(entry.emails[0]);
  }

  // Coordinates
  const lat = Number(entry.latitude);
  const lng = Number(entry.longitude ?? entry.longtitude);

  // Place ID
  const place_id = clean(entry.place_id || entry.cid || entry.data_id) || null;

  // Owner extraction: Google Maps displays "<Business Name> (Owner)" for claimed listings.
  // We only treat it as an actual decision maker if it is not identical to the business name.
  let owner_name = '';
  let owner_title = '';
  const cleanBiz = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (entry.owner && typeof entry.owner === 'object' && entry.owner.name) {
    const rawOwner = clean(entry.owner.name).replace(/\s*\(Owner\)\s*$/i, '');
    const cleanOwn = rawOwner.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (rawOwner && cleanOwn !== cleanBiz && !cleanBiz.includes(cleanOwn) && !cleanOwn.includes(cleanBiz)) {
      owner_name = rawOwner;
      owner_title = 'Owner / Operator';
    }
  } else if (entry.owner_name) {
    const rawOwner = clean(entry.owner_name);
    const cleanOwn = rawOwner.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (rawOwner && cleanOwn !== cleanBiz && !cleanBiz.includes(cleanOwn)) {
      owner_name = rawOwner;
      owner_title = clean(entry.owner_title || 'Owner');
    }
  }

  return {
    name,
    category,
    address,
    city: city || 'Unknown',
    state,
    postal_code,
    country: country || 'Unknown',
    phone,
    email,
    website,
    owner_name,
    owner_title,
    rating,
    review_count,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    place_id,
    price_range: clean(entry.price_range),
    opening_hours: hours,
    thumbnail: clean(entry.thumbnail),
    description: clean(entry.description),
    plus_code: clean(entry.plus_code),
    source_query: queryLabel
  };
}

export function parseGosomJson(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const arr = JSON.parse(trimmed);
      return Array.isArray(arr) ? arr : [];
    } catch {}
  }
  // Single JSON record
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const single = JSON.parse(trimmed);
      if (single && typeof single === 'object') return [single];
    } catch {}
  }
  // Try newline-delimited JSON (NDJSON)
  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const results = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj && typeof obj === 'object') results.push(obj);
    } catch {}
  }
  return results;
}

export function parseGosomCsv(text) {
  const lines = [];
  let cur = '', inQuotes = false;
  const rawText = String(text || '').replace(/^\uFEFF/, ''); // strip BOM
  for (let i = 0; i < rawText.length; i++) {
    const c = rawText[i];
    if (c === '"') {
      if (inQuotes && rawText[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (c === '\r' && rawText[i + 1] === '\n') i++;
      lines.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur.trim()) lines.push(cur);
  if (lines.length < 2) return [];

  const parseLine = line => {
    const res = [];
    let field = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (q && line[i + 1] === '"') { field += '"'; i++; }
        else q = !q;
      } else if (c === ',' && !q) {
        res.push(field.trim());
        field = '';
      } else {
        field += c;
      }
    }
    res.push(field.trim());
    return res;
  };

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const findCol = (...keys) => headers.findIndex(h => keys.some(k => h === k || h.includes(k)));

  const colTitle = findCol('title', 'name', 'businessname', 'company');
  const colCat = findCol('category', 'categories', 'industry');
  const colAddr = findCol('completeaddress', 'address', 'street', 'location');
  const colCity = findCol('city', 'town');
  const colState = findCol('state', 'province', 'region');
  const colZip = findCol('postalcode', 'zip', 'zipcode', 'postcode');
  const colCountry = findCol('country');
  const colPhone = findCol('phone', 'tel', 'mobile');
  const colWeb = findCol('website', 'website', 'url', 'domain');
  const colEmail = findCol('email', 'emails', 'mail');
  const colRating = findCol('reviewrating', 'rating');
  const colReviews = findCol('reviewcount', 'reviews');
  const colLat = findCol('latitude', 'lat');
  const colLng = findCol('longitude', 'longtitude', 'lng', 'lon');
  const colPlaceId = findCol('placeid', 'cid', 'dataid');
  const colPrice = findCol('pricerange', 'price');
  const colHours = findCol('openhours', 'openinghours', 'hours');
  const colThumb = findCol('thumbnail', 'image', 'photo');
  const colDesc = findCol('description', 'overview');
  const colPlus = findCol('pluscode', 'plus');

  const entries = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = parseLine(line);
    const getVal = idx => (idx >= 0 && idx < cols.length ? cols[idx] : '');
    const title = getVal(colTitle);
    if (!title) continue;

    entries.push({
      title,
      category: getVal(colCat),
      address: getVal(colAddr),
      complete_address: {
        city: getVal(colCity),
        state: getVal(colState),
        postal_code: getVal(colZip),
        country: getVal(colCountry)
      },
      phone: getVal(colPhone),
      web_site: getVal(colWeb),
      email: getVal(colEmail),
      review_rating: getVal(colRating),
      review_count: getVal(colReviews),
      latitude: getVal(colLat),
      longitude: getVal(colLng),
      place_id: getVal(colPlaceId),
      price_range: getVal(colPrice),
      open_hours: getVal(colHours),
      thumbnail: getVal(colThumb),
      description: getVal(colDesc),
      plus_code: getVal(colPlus)
    });
  }
  return entries;
}

export class GosomManager {
  constructor({ store, emit }) {
    this.store = store;
    this.emit = emit;
    this.child = null;
    this.containerName = null;
    this.activeDir = null;
    this.status = 'idle';
    this.counters = blankCounters();
    this.job = null;
    this.logs = [];
    this.progress = {
      currentQueryIndex: 0,
      totalQueries: 0,
      currentQuery: '',
      percent: 0,
      etaSeconds: 0,
      startTime: 0,
      completedQueries: 0,
      failedQueries: []
    };
    this.livePollTimer = null;
  }

  snapshot() {
    return {
      state: this.status,
      counters: this.counters,
      job: this.job,
      progress: this.progress,
      logs: this.logs.slice(-300)
    };
  }

  #push(evt) {
    this.emit({ ...evt, state: this.status, counters: this.counters });
  }

  #log(level, msg) {
    const entry = { level, msg, time: Date.now() };
    this.logs.push(entry);
    if (this.logs.length > 500) this.logs.shift();
    this.#push({ type: 'log', level, msg });
  }

  async checkPrerequisites() {
    try {
      const { stdout: vOut } = await execFileAsync('docker', ['--version'], { timeout: 4000 });
      const versionStr = vOut.trim();
      try {
        await execFileAsync('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 5000 });
        return {
          installed: true,
          running: true,
          version: versionStr,
          message: 'Docker Engine is active and ready.'
        };
      } catch (e) {
        return {
          installed: true,
          running: false,
          version: versionStr,
          message: 'Docker is installed, but the Docker Desktop daemon is not running. Please start Docker Desktop.'
        };
      }
    } catch (err) {
      return {
        installed: false,
        running: false,
        version: '',
        message: 'Docker command was not found on your PATH. Please install Docker Desktop (or run Gosom via local CLI).'
      };
    }
  }

  generateCommand(p) {
    const queries = Array.isArray(p.queries) ? p.queries : String(p.queries || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const c = Math.max(1, Math.min(32, Number(p.concurrency) || 4));
    const depth = Math.max(1, Math.min(100, Number(p.depth) || 10));
    const lang = String(p.lang || 'en').trim();

    const dockerParts = [
      'docker run --rm',
      '-v "${PWD}:/data"',
      'gosom/google-maps-scraper',
      '-input /data/queries.txt',
      '-results /data/results.json',
      '-json',
      `-c ${c}`,
      `-depth ${depth}`,
      `-lang ${lang}`
    ];
    if (p.email) dockerParts.push('-email');
    if (p.geoCoordinates && p.geoCoordinates.trim()) {
      dockerParts.push(`-geo "${p.geoCoordinates.trim()}"`);
      if (p.zoom && Number(p.zoom) > 0) dockerParts.push(`-zoom ${p.zoom}`);
      if (p.fastMode) dockerParts.push('-fast-mode');
    }
    if (p.extraReviews) dockerParts.push('-extra-reviews');
    if (p.gridBBox && p.gridBBox.trim()) {
      dockerParts.push(`-grid-bbox "${p.gridBBox.trim()}"`);
      if (p.gridCellKm && Number(p.gridCellKm) > 0) dockerParts.push(`-grid-cell ${p.gridCellKm}`);
    }

    const cliParts = [
      'google-maps-scraper',
      '-input queries.txt',
      '-results results.json',
      '-json',
      `-c ${c}`,
      `-depth ${depth}`,
      `-lang ${lang}`
    ];
    if (p.email) cliParts.push('-email');
    if (p.geoCoordinates && p.geoCoordinates.trim()) {
      cliParts.push(`-geo "${p.geoCoordinates.trim()}"`);
      if (p.zoom && Number(p.zoom) > 0) cliParts.push(`-zoom ${p.zoom}`);
      if (p.fastMode) cliParts.push('-fast-mode');
    }
    if (p.extraReviews) cliParts.push('-extra-reviews');

    return {
      docker: dockerParts.join(' '),
      cli: cliParts.join(' ')
    };
  }

  async start(p, tempBaseDir) {
    if (this.child) throw new Error('A Gosom crawl task is already running.');

    const queries = Array.isArray(p.queries)
      ? p.queries
      : String(p.queries || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);

    if (!queries.length) {
      throw new Error('Please enter at least one search query.');
    }

    const check = await this.checkPrerequisites();
    if (!check.installed || !check.running) {
      throw new Error(check.message);
    }

    this.counters = blankCounters();
    this.status = 'running';
    this.isStopping = false;
    this.progress = {
      currentQueryIndex: 1,
      totalQueries: queries.length,
      currentQuery: queries[0] || '',
      percent: 0,
      etaSeconds: Math.max(30, queries.length * 25),
      startTime: Date.now(),
      completedQueries: 0,
      failedQueries: []
    };
    this.job = { queries, concurrency: p.concurrency || 4, depth: p.depth || 10, lang: p.lang || 'en' };
    this.#push({ type: 'state' });
    this.#push({ type: 'progress', progress: this.progress });

    const timestamp = Date.now();
    const runDir = path.join(tempBaseDir, `ws-gosom-${timestamp}`);
    fs.mkdirSync(runDir, { recursive: true });
    this.activeDir = runDir;

    const queriesFile = path.join(runDir, 'queries.txt');
    fs.writeFileSync(queriesFile, queries.join('\n'), 'utf8');

    const containerName = `ws-gosom-${timestamp}`;
    this.containerName = containerName;

    // Use forward slashes for clean Docker volume mounting on all platforms
    const mountPath = path.resolve(runDir).replace(/\\/g, '/');
    const dockerArgs = [
      'run',
      '--rm',
      '--name', containerName,
      '-v', `${mountPath}:/data`,
      'gosom/google-maps-scraper',
      '-input', '/data/queries.txt',
      '-results', '/data/results.json',
      '-json',
      '-c', String(Math.max(1, Math.min(32, Number(p.concurrency) || 4))),
      '-depth', String(Math.max(1, Math.min(100, Number(p.depth) || 10))),
      '-lang', String(p.lang || 'en').trim()
    ];

    if (p.email) dockerArgs.push('-email');
    if (p.geoCoordinates && String(p.geoCoordinates).trim()) {
      dockerArgs.push('-geo', String(p.geoCoordinates).trim());
      if (p.zoom && Number(p.zoom) > 0) dockerArgs.push('-zoom', String(p.zoom));
      if (p.fastMode) dockerArgs.push('-fast-mode');
    } else if (p.fastMode) {
      this.#log('WARN', 'Fast-mode ignored: Gosom requires geo-coordinates (-geo) to be specified when fast-mode is active. Running in standard browser mode.');
    }
    if (p.extraReviews) dockerArgs.push('-extra-reviews');
    if (p.gridBBox && String(p.gridBBox).trim()) {
      dockerArgs.push('-grid-bbox', String(p.gridBBox).trim());
      if (p.gridCellKm && Number(p.gridCellKm) > 0) {
        dockerArgs.push('-grid-cell', String(p.gridCellKm));
      }
    }
    if (p.proxies && String(p.proxies).trim()) {
      fs.writeFileSync(path.join(runDir, 'proxies.txt'), String(p.proxies).trim(), 'utf8');
      dockerArgs.push('-proxies-file', '/data/proxies.txt');
    }

    this.#log('INFO', `Initializing Gosom Docker container: ${containerName}`);
    this.#log('INFO', `Queries: [${queries.join(', ')}] | Concurrency: ${p.concurrency || 4} | Depth: ${p.depth || 10}`);

    try {
      this.child = spawn('docker', dockerArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (spawnErr) {
      this.status = 'idle';
      this.child = null;
      this.#log('ERROR', `Failed to spawn docker process: ${spawnErr.message}`);
      this.#push({ type: 'done', error: spawnErr.message });
      throw spawnErr;
    }

    // Live incremental streaming ingestion: Read results.json continuously while container runs
    let lastReadSize = 0;
    let leftoverBuffer = '';
    const ingestedPlaceKeys = new Set();

    const ingestLive = () => {
      const resultsFile = path.join(runDir, 'results.json');
      if (!fs.existsSync(resultsFile)) return;

      try {
        const stats = fs.statSync(resultsFile);
        if (stats.size <= lastReadSize) return;

        const bytesToRead = stats.size - lastReadSize;
        const buf = Buffer.alloc(bytesToRead);
        const fd = fs.openSync(resultsFile, 'r');
        fs.readSync(fd, buf, 0, bytesToRead, lastReadSize);
        fs.closeSync(fd);
        lastReadSize = stats.size;

        const newChunk = leftoverBuffer + buf.toString('utf8');
        const lines = newChunk.split(/\r?\n/);
        leftoverBuffer = lines.pop() || '';

        let newRecordsCount = 0;
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let entry;
          try {
            entry = JSON.parse(trimmed);
          } catch {
            continue;
          }
          if (!entry || typeof entry !== 'object') continue;

          const dedupKey = entry.place_id || entry.cid || entry.data_id || `${entry.title || entry.name}_${entry.address || ''}`;
          if (dedupKey && ingestedPlaceKeys.has(dedupKey)) continue;
          if (dedupKey) ingestedPlaceKeys.add(dedupKey);

          const mapped = mapGosomEntry(entry, `Gosom: ${queries[0] || 'Bulk'}`);
          if (!mapped) continue;

          this.counters.found++;
          newRecordsCount++;
          const res = this.store.ingest(mapped, `Gosom: ${queries[0] || 'Bulk'}`);
          if (res.outcome === 'added') {
            this.counters.added++;
            const lead = this.store.get(res.id)?.lead;
            if (lead) this.#push({ type: 'lead', lead, stage: 'discovered' });
          } else if (res.outcome === 'enriched') {
            this.counters.enriched++;
            const lead = this.store.get(res.id)?.lead;
            if (lead) this.#push({ type: 'lead_updated', lead, stage: 'enriched' });
          } else {
            this.counters.duplicates++;
          }
        }

        if (newRecordsCount > 0) {
          this.#push({ type: 'state' });
        }
      } catch {}
    };

    if (this.livePollTimer) clearInterval(this.livePollTimer);
    this.livePollTimer = setInterval(ingestLive, 1000);

    const handleLogLine = line => {
      const clean = line.trim();
      if (!clean) return;

      // When scrapemate completes its crawl, finalize ingestion and exit gracefully
      if (clean.includes('scrapemate exited')) {
        this.#log('INFO', 'Gosom crawl engine finished. Finalizing lead ingestion…');
        ingestLive();
        setTimeout(() => {
          if (this.containerName && this.status === 'running') {
            execFileAsync('docker', ['stop', '-t', '1', this.containerName], { timeout: 4000 }).catch(() => {});
          }
        }, 1200);
      }

      // Parse Scrapemate structured JSON logs into friendly readable messages
      if (clean.startsWith('{') && clean.endsWith('}')) {
        try {
          const parsed = JSON.parse(clean);
          const level = (parsed.level || 'INFO').toUpperCase();
          if (parsed.job && parsed.status === 'success') {
            const match = String(parsed.job).match(/\/maps\/place\/([^/]+)/);
            const name = match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : 'Place';
            const dur = parsed.duration ? ` (${Math.round(parsed.duration)}ms)` : '';
            this.#log('INFO', `Discovered & fetched: ${name}${dur}`);
            return;
          }
          if (parsed.message) {
            this.#log(level, parsed.message);
            return;
          }
        } catch {}
      }

      let level = 'INFO';
      if (/error|failed/i.test(clean)) level = 'ERROR';
      else if (/warn/i.test(clean)) level = 'WARN';
      else if (/email/i.test(clean)) level = 'ENRICH';
      else if (/duplicate|skip/i.test(clean)) level = 'DEDUPE';
      this.#log(level, clean);

      // Track progress & ETA estimation dynamically
      if (clean.includes('/maps/place/') || clean.includes('seed job') || clean.includes('job finished')) {
        const elapsed = (Date.now() - this.progress.startTime) / 1000;
        this.progress.completedQueries = Math.min(this.progress.totalQueries, Math.max(1, Math.floor(this.counters.found / 12) + 1));
        this.progress.currentQueryIndex = this.progress.completedQueries;
        this.progress.currentQuery = queries[Math.min(queries.length - 1, this.progress.completedQueries - 1)] || queries[0];
        this.progress.percent = Math.min(95, Math.round((this.progress.completedQueries / this.progress.totalQueries) * 100));
        const avgPerQuery = elapsed / this.progress.completedQueries;
        const remaining = Math.max(0, this.progress.totalQueries - this.progress.completedQueries);
        this.progress.etaSeconds = Math.round(remaining * Math.max(4, avgPerQuery));
        this.#push({ type: 'progress', progress: this.progress });
      }
    };

    this.child.stdout.on('data', data => {
      for (const line of String(data).split(/\r?\n/)) handleLogLine(line);
    });

    this.child.stderr.on('data', data => {
      for (const line of String(data).split(/\r?\n/)) handleLogLine(line);
    });

    this.child.on('close', code => {
      this.#onProcessFinished(code, runDir, queries, null, ingestedPlaceKeys);
    });

    this.child.on('error', err => {
      this.#log('ERROR', `Process error: ${err.message}`);
      this.#onProcessFinished(1, runDir, queries, err.message, ingestedPlaceKeys);
    });

    return this.snapshot();
  }

  async #onProcessFinished(code, runDir, queries, errorMsg, ingestedPlaceKeys = new Set()) {
    if (this.livePollTimer) {
      clearInterval(this.livePollTimer);
      this.livePollTimer = null;
    }
    if (this.status !== 'running' && !this.isStopping) return;
    const wasStopping = !!this.isStopping;
    this.isStopping = false;
    this.child = null;
    this.containerName = null;

    if (code !== 0 && !errorMsg && !wasStopping) {
      this.#log('WARN', `Docker exited with code ${code}. Checking for parsed results…`);
    }

    const resultsFile = path.join(runDir, 'results.json');
    let totalParsed = this.counters.found;

    if (fs.existsSync(resultsFile)) {
      try {
        const content = fs.readFileSync(resultsFile, 'utf8');
        const rawEntries = parseGosomJson(content);

        for (const raw of rawEntries) {
          const dedupKey = raw.place_id || raw.cid || raw.data_id || `${raw.title || raw.name}_${raw.address || ''}`;
          if (dedupKey && ingestedPlaceKeys.has(dedupKey)) continue;
          if (dedupKey) ingestedPlaceKeys.add(dedupKey);

          const mapped = mapGosomEntry(raw, `Gosom: ${queries[0] || 'Bulk'}`);
          if (!mapped) continue;
          totalParsed++;
          this.counters.found++;

          const res = this.store.ingest(mapped, `Gosom: ${queries[0] || 'Bulk'}`);
          if (res.outcome === 'added') {
            this.counters.added++;
            const lead = this.store.get(res.id)?.lead;
            if (lead) this.#push({ type: 'lead', lead, stage: 'discovered' });
          } else if (res.outcome === 'enriched') {
            this.counters.enriched++;
            const lead = this.store.get(res.id)?.lead;
            if (lead) this.#push({ type: 'lead_updated', lead, stage: 'enriched' });
          } else {
            this.counters.duplicates++;
          }
        }

        if (this.counters.found > 0) {
          this.store.addHistory({
            query_criteria: queries.join(', '),
            target_location: 'Gosom Engine Crawl',
            total_found: this.counters.found,
            new_leads_added: this.counters.added,
            duplicates_skipped: this.counters.duplicates + this.counters.enriched
          });
        }

        this.#log('INFO', `Ingestion complete: ${this.counters.added} new leads added, ${this.counters.enriched} enriched, ${this.counters.duplicates} duplicates protected.`);
      } catch (readErr) {
        this.#log('ERROR', `Could not parse Gosom results file: ${readErr.message}`);
      }
    } else if (totalParsed === 0) {
      this.#log('WARN', 'No results file was generated by the scraper.');
    }

    // Cleanup temp directory
    try {
      fs.rmSync(runDir, { recursive: true, force: true });
    } catch {}

    this.progress.percent = 100;
    this.progress.etaSeconds = 0;
    this.progress.completedQueries = queries.length;
    this.status = 'idle';
    this.activeDir = null;
    this.#push({
      type: 'done',
      code,
      total: this.counters.found,
      aborted: wasStopping,
      progress: this.progress,
      queryStats: {
        total: queries.length,
        completed: this.counters.found > 0 ? queries.length : 0,
        zeroResults: this.counters.found === 0 ? queries.length : 0,
        failed: (code !== 0 && !wasStopping) ? 1 : 0
      }
    });
  }

  async stop() {
    if (this.livePollTimer) {
      clearInterval(this.livePollTimer);
      this.livePollTimer = null;
    }
    if (!this.child && !this.containerName) return this.snapshot();
    this.isStopping = true;
    this.#log('INFO', 'Stopping Gosom scraper container…');

    if (this.containerName) {
      try {
        await execFileAsync('docker', ['stop', '-t', '2', this.containerName], { timeout: 6000 });
      } catch {}
    }

    if (this.child) {
      try {
        this.child.kill('SIGTERM');
      } catch {}
    }

    return this.snapshot();
  }

  importFile(filePath) {
    if (!fs.existsSync(filePath)) throw new Error('File does not exist: ' + filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const isJson = filePath.toLowerCase().endsWith('.json');
    const rawEntries = isJson ? parseGosomJson(content) : parseGosomCsv(content);

    if (!rawEntries.length) {
      throw new Error('No valid records found in file. Ensure the file was generated by Gosom scraper (JSON or CSV).');
    }

    const filename = path.basename(filePath);
    let total = 0, added = 0, enriched = 0, duplicates = 0;

    for (const raw of rawEntries) {
      const mapped = mapGosomEntry(raw, `Gosom Import: ${filename}`);
      if (!mapped) continue;
      total++;
      const res = this.store.ingest(mapped, `Gosom Import: ${filename}`);
      if (res.outcome === 'added') added++;
      else if (res.outcome === 'enriched') enriched++;
      else duplicates++;
    }

    if (total > 0) {
      this.store.addHistory({
        query_criteria: `File: ${filename}`,
        target_location: 'Gosom File Import',
        total_found: total,
        new_leads_added: added,
        duplicates_skipped: duplicates + enriched
      });
    }

    this.#log('INFO', `Imported "${filename}": ${total} records parsed (${added} new leads, ${enriched} enriched, ${duplicates} duplicates protected).`);
    return { total, added, enriched, duplicates, filename };
  }
}
