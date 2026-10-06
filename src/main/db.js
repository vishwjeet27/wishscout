/**
 * WishScout — Local Business Discovery & Intelligence
 * Copyright (C) 2026 Vishwjeet Singh Vilkhu (Original Creator & Architect)
 * Licensed under the GNU GPL-3.0. See LICENSE and NOTICE; attribution must be preserved (GPL-3.0 §7).
 */
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { STATUSES } from '../shared/channels.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, normalized_name TEXT NOT NULL, category TEXT NOT NULL,
  address TEXT, city TEXT NOT NULL, state TEXT, postal_code TEXT, country TEXT NOT NULL,
  latitude REAL, longitude REAL, phone TEXT, normalized_phone TEXT, email TEXT, website TEXT, domain TEXT,
  owner_name TEXT, owner_title TEXT, rating REAL DEFAULT 0.0, review_count INTEGER DEFAULT 0,
  social_linkedin TEXT, social_instagram TEXT, social_facebook TEXT, social_twitter TEXT, social_youtube TEXT,
  place_id TEXT UNIQUE, status TEXT DEFAULT 'New Lead', notes TEXT, tags TEXT, source_query TEXT,
  discovered_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_contacted_at INTEGER,
  follow_up_date TEXT, price_range TEXT, opening_hours TEXT, thumbnail TEXT, description TEXT, plus_code TEXT
);
CREATE INDEX IF NOT EXISTS idx_businesses_domain ON businesses(domain);
CREATE INDEX IF NOT EXISTS idx_businesses_phone ON businesses(normalized_phone);
CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);
CREATE INDEX IF NOT EXISTS idx_businesses_city ON businesses(city);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category);
CREATE INDEX IF NOT EXISTS idx_businesses_name_city ON businesses(normalized_name, city);
CREATE TABLE IF NOT EXISTS search_history (
  id TEXT PRIMARY KEY, query_criteria TEXT NOT NULL, target_location TEXT NOT NULL,
  total_found INTEGER DEFAULT 0, new_leads_added INTEGER DEFAULT 0, duplicates_skipped INTEGER DEFAULT 0,
  executed_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS outreach_logs (
  id TEXT PRIMARY KEY, business_id TEXT NOT NULL, action_type TEXT NOT NULL, notes TEXT, timestamp INTEGER NOT NULL,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_logs_business ON outreach_logs(business_id);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  channel TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

const COLS = ['id','name','normalized_name','category','address','city','state','postal_code','country','latitude','longitude',
  'phone','normalized_phone','email','website','domain','owner_name','owner_title','rating','review_count',
  'social_linkedin','social_instagram','social_facebook','social_twitter','social_youtube','place_id','status','notes','tags',
  'source_query','discovered_at','updated_at','last_contacted_at','follow_up_date','price_range','opening_hours','thumbnail','description','plus_code'];
// Fields that may be filled in non-destructively on an existing "New Lead".
const FILLABLE = ['address','state','postal_code','phone','normalized_phone','email','website','domain','owner_name','owner_title',
  'social_linkedin','social_instagram','social_facebook','social_twitter','social_youtube','latitude','longitude','follow_up_date',
  'price_range','opening_hours','thumbnail','description','plus_code'];
const EDITABLE = ['notes','owner_name','owner_title','email','tags','follow_up_date','price_range','opening_hours','description'];
const SORTS = { name: 'name COLLATE NOCASE', rating: 'rating', review_count: 'review_count', discovered_at: 'discovered_at',
  city: 'city COLLATE NOCASE', status: 'status' };
const DEFAULTS = { concurrency: 2, delayMin: 1500, delayMax: 3500, proxy: '', headless: true, whatsappMode: 'web' };

// ---------- normalisation helpers (fingerprints) ----------
export function normalizePhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length < 7) return '';
  return d.length > 10 ? d.slice(-10) : d;
}
export function normalizeName(n) {
  return String(n || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
export function extractDomain(url) {
  if (!url) return '';
  try { return new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}
const DEFAULT_TEMPLATES = [
  {
    id: 'tpl_email_website',
    name: 'Website Redesign & Modernization Pitch',
    channel: 'email',
    subject: "Quick inquiry regarding {name}'s online presence",
    body: "Hi {name} team,\n\nI was looking up top-rated {category} providers in {city} and noticed your profile. Having an outdated or missing mobile-friendly site could be costing you valuable local clients.\n\nWe specialize in high-converting, modern websites for {category} businesses that double direct inquiries. Would you be open to a 5-minute chat or seeing a quick concept preview?\n\nBest regards,\n[Your Name]"
  },
  {
    id: 'tpl_email_seo',
    name: 'Local SEO & Google Maps Ranking Pitch',
    channel: 'email',
    subject: "Ranking {name} #1 on Google in {city}",
    body: "Hi {name} team,\n\nI noticed your business in {city}. You already have great potential, but competitors are capturing most of the high-intent search traffic for \"{category} in {city}\".\n\nWe help local businesses reach the top 3 Google Map pack to generate 30-50+ new inquiries every month on autopilot. Can I share a free 2-minute audit for {name}?\n\nBest regards,\n[Your Name]"
  },
  {
    id: 'tpl_email_reviews',
    name: 'Reputation & 5-Star Reviews Booster',
    channel: 'email',
    subject: "Helping {name} get more 5-star customer reviews",
    body: "Hi {name} team,\n\nDid you know that 88% of local customers in {city} choose the provider with the most recent 5-star reviews?\n\nWe provide an automated review booster that helps {name} effortlessly collect authentic 5-star customer reviews via WhatsApp/SMS without awkward follow-ups. Would you like to see how it works?\n\nBest regards,\n[Your Name]"
  },
  {
    id: 'tpl_email_partnership',
    name: 'Direct B2B Referral Partnership',
    channel: 'email',
    subject: "Partnership inquiry with {name} in {city}",
    body: "Hi {name} team,\n\nI run a B2B agency and frequently work with clients looking for {category} in {city}. I'd love to connect with your team to explore sending qualified client referrals your way.\n\nWho would be the best person to speak with?\n\nBest regards,\n[Your Name]"
  },
  {
    id: 'tpl_wa_intro',
    name: 'Quick Business Introduction (WhatsApp)',
    channel: 'whatsapp',
    subject: '',
    body: "Hi {name},\n\nI noticed your business listing in {city} and wanted to reach out regarding our services and client acquisition.\n\nAre you available for a brief conversation this week?"
  },
  {
    id: 'tpl_wa_website',
    name: 'Mobile Website Audit Pitch (WhatsApp)',
    channel: 'whatsapp',
    subject: '',
    body: "Hi {name} team,\n\nI came across {name} in {city}. Noticed that your business could get 2x more phone calls with a modern, fast mobile landing page.\n\nCan I send you a free 60-second video audit of your online presence?"
  },
  {
    id: 'tpl_wa_followup',
    name: 'Friendly Follow-Up (WhatsApp)',
    channel: 'whatsapp',
    subject: '',
    body: "Hi {name},\n\nFollowing up on my previous message. Wanted to see if you had 2 minutes to chat about growing {name}'s local inquiries in {city}?"
  }
];

function seedTemplates(db) {
  try {
    const count = db.prepare('SELECT COUNT(*) c FROM templates').get()?.c || 0;
    if (count === 0) {
      const insert = db.prepare('INSERT INTO templates (id, name, channel, subject, body, updated_at) VALUES (@id, @name, @channel, @subject, @body, @updated_at)');
      const now = Date.now();
      for (const t of DEFAULT_TEMPLATES) {
        insert.run({ ...t, updated_at: now });
      }
    }
  } catch {}
}

export function createStore(dbFile) {
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const db = new Database(dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  seedTemplates(db);
  try { db.exec('ALTER TABLE businesses ADD COLUMN follow_up_date TEXT'); } catch { /* column exists */ }
  try { db.exec('ALTER TABLE businesses ADD COLUMN price_range TEXT'); } catch {}
  try { db.exec('ALTER TABLE businesses ADD COLUMN opening_hours TEXT'); } catch {}
  try { db.exec('ALTER TABLE businesses ADD COLUMN thumbnail TEXT'); } catch {}
  try { db.exec('ALTER TABLE businesses ADD COLUMN description TEXT'); } catch {}
  try { db.exec('ALTER TABLE businesses ADD COLUMN plus_code TEXT'); } catch {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_businesses_followup ON businesses(follow_up_date)'); } catch {}
  try { db.exec("UPDATE businesses SET owner_name = '', owner_title = '' WHERE LOWER(TRIM(owner_name)) = LOWER(TRIM(name)) OR owner_name LIKE '%' || name || '%'"); } catch {}

  const insertStmt = db.prepare(`INSERT INTO businesses (${COLS.join(',')}) VALUES (${COLS.map(c => '@' + c).join(',')})`);
  const byPlace = db.prepare('SELECT id, status FROM businesses WHERE place_id = ?');
  const byDomain = db.prepare('SELECT id, status FROM businesses WHERE domain = ?');
  const byPhone = db.prepare('SELECT id, status FROM businesses WHERE normalized_phone = ?');
  const byNameCity = db.prepare('SELECT id, status FROM businesses WHERE normalized_name = ? AND city = ? COLLATE NOCASE');
  const getById = db.prepare('SELECT * FROM businesses WHERE id = ?');

  function prepare(raw, sourceQuery) {
    const now = Date.now();
    const s = v => (v == null ? '' : String(v).trim());
    const n = v => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : null);
    return {
      id: randomUUID(), name: s(raw.name), normalized_name: normalizeName(raw.name), category: s(raw.category) || 'Uncategorized',
      address: s(raw.address), city: s(raw.city) || 'Unknown', state: s(raw.state), postal_code: s(raw.postal_code),
      country: s(raw.country) || 'Unknown', latitude: n(raw.latitude), longitude: n(raw.longitude),
      phone: s(raw.phone), normalized_phone: normalizePhone(raw.phone), email: s(raw.email).toLowerCase(),
      website: s(raw.website), domain: extractDomain(raw.website), owner_name: s(raw.owner_name), owner_title: s(raw.owner_title),
      rating: n(raw.rating) ?? 0, review_count: Math.trunc(n(raw.review_count) ?? 0),
      social_linkedin: s(raw.social_linkedin), social_instagram: s(raw.social_instagram), social_facebook: s(raw.social_facebook),
      social_twitter: s(raw.social_twitter), social_youtube: s(raw.social_youtube),
      place_id: s(raw.place_id) || null, status: s(raw.status) || 'New Lead', notes: s(raw.notes), tags: s(raw.tags), source_query: sourceQuery || '',
      discovered_at: now, updated_at: now, last_contacted_at: null,
      follow_up_date: s(raw.follow_up_date) || null,
      price_range: s(raw.price_range),
      opening_hours: s(raw.opening_hours),
      thumbnail: s(raw.thumbnail),
      description: s(raw.description),
      plus_code: s(raw.plus_code)
    };
  }

  // Triple-point deduplication (+ canonical place_id) — see blueprint §3.2
  function evaluateDuplicate(rec) {
    let hit;
    if (rec.place_id && (hit = byPlace.get(rec.place_id))) return dup('place_id', hit);
    if (rec.domain && (hit = byDomain.get(rec.domain))) return dup('domain', hit);
    if (rec.normalized_phone && (hit = byPhone.get(rec.normalized_phone))) return dup('phone', hit);
    if ((hit = byNameCity.get(rec.normalized_name, rec.city))) return dup('name_city', hit);
    return { isDuplicate: false };
  }
  const dup = (matchReason, row) => ({ isDuplicate: true, matchReason, existingId: row.id, currentStatus: row.status });

  /** Insert, enrich-in-place, or protect. Returns { outcome: added|enriched|duplicate|protected, id } */
  function ingest(raw, sourceQuery) {
    const rec = prepare(raw, sourceQuery);
    if (!rec.name) return { outcome: 'duplicate', id: null, reason: 'empty' };
    const d = evaluateDuplicate(rec);
    if (!d.isDuplicate) { insertStmt.run(rec); return { outcome: 'added', id: rec.id }; }
    if (d.currentStatus !== 'New Lead') return { outcome: 'protected', id: d.existingId, reason: d.matchReason };
    const cur = getById.get(d.existingId);
    const patch = {};
    for (const f of FILLABLE) if ((cur[f] == null || cur[f] === '') && rec[f] != null && rec[f] !== '') patch[f] = rec[f];
    const keys = Object.keys(patch);
    if (!keys.length) return { outcome: 'duplicate', id: d.existingId, reason: d.matchReason };
    db.prepare(`UPDATE businesses SET ${keys.map(k => `${k}=@${k}`).join(',')}, updated_at=@updated_at WHERE id=@id`)
      .run({ ...patch, updated_at: Date.now(), id: d.existingId });
    return { outcome: 'enriched', id: d.existingId, reason: d.matchReason };
  }

  function where(f = {}) {
    const w = [], p = [];
    if (f.search) {
      const s = `%${String(f.search).replace(/[\\%_]/g, '\\$&')}%`;
      w.push(`(name LIKE ? ESCAPE '\\' OR domain LIKE ? ESCAPE '\\' OR city LIKE ? ESCAPE '\\' OR state LIKE ? ESCAPE '\\' OR country LIKE ? ESCAPE '\\' OR address LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR owner_name LIKE ? ESCAPE '\\')`);
      p.push(s, s, s, s, s, s, s, s, s);
    }
    if (f.status && STATUSES.includes(f.status)) { w.push('status = ?'); p.push(f.status); }
    if (f.category) { w.push('category = ?'); p.push(f.category); }
    if (f.hasEmail) w.push("COALESCE(email,'') <> ''");
    if (f.hasOwner) w.push("COALESCE(owner_name,'') <> ''");
    if (f.hasSocial) w.push("(COALESCE(social_linkedin,'') <> '' OR COALESCE(social_instagram,'') <> '' OR COALESCE(social_facebook,'') <> '' OR COALESCE(social_twitter,'') <> '' OR COALESCE(social_youtube,'') <> '')");
    if (f.websiteFilter === 'has') w.push("COALESCE(website,'') <> ''");
    if (f.websiteFilter === 'none') w.push("COALESCE(website,'') = ''");
    if (f.ratingFilter === 'high') w.push('rating >= 4.5');
    if (f.ratingFilter === 'low') w.push('rating > 0 AND rating < 4.0');
    if (f.ratingFilter === 'poor') w.push('rating > 0 AND rating < 3.5');
    if (f.ratingMin != null && !isNaN(f.ratingMin)) { w.push('rating >= ?'); p.push(Number(f.ratingMin)); }
    if (f.ratingMax != null && !isNaN(f.ratingMax)) { w.push('rating <= ?'); p.push(Number(f.ratingMax)); }
    if (f.tag) { w.push("tags LIKE ? ESCAPE '\\'"); p.push(`%${String(f.tag).replace(/[\\%_]/g, '\\$&')}%`); }
    if (f.followUpDue) {
      const today = new Date().toISOString().slice(0, 10);
      w.push("follow_up_date IS NOT NULL AND follow_up_date <> '' AND follow_up_date <= ?");
      p.push(today);
    }
    return { sql: w.length ? 'WHERE ' + w.join(' AND ') : '', params: p };
  }
  const idsClause = ids => ({ sql: 'WHERE id IN (SELECT value FROM json_each(?))', params: [JSON.stringify(ids)] });

  const api = {
    raw: db,
    evaluateDuplicate, ingest,
    knownPlaceIds: () => db.prepare('SELECT place_id FROM businesses WHERE place_id IS NOT NULL').all().map(r => r.place_id),

    query(f = {}) {
      const page = Math.max(1, Number(f.page) || 1);
      const pageSize = [25, 50, 100].includes(Number(f.pageSize)) ? Number(f.pageSize) : 25;
      const order = SORTS[f.sort] || SORTS.discovered_at;
      const dir = f.dir === 'asc' ? 'ASC' : 'DESC';
      const { sql, params } = where(f);
      const total = db.prepare(`SELECT COUNT(*) c FROM businesses ${sql}`).get(...params).c;
      const rows = db.prepare(`SELECT * FROM businesses ${sql} ORDER BY ${order} ${dir}, id LIMIT ? OFFSET ?`)
        .all(...params, pageSize, (page - 1) * pageSize);
      return { rows, total, page, pageSize };
    },
    exportRows({ ids, filters } = {}) {
      const { sql, params } = Array.isArray(ids) && ids.length ? idsClause(ids) : where(filters || {});
      return db.prepare(`SELECT * FROM businesses ${sql} ORDER BY discovered_at DESC`).all(...params);
    },
    get(id) { return { lead: getById.get(id) || null, logs: db.prepare('SELECT * FROM outreach_logs WHERE business_id = ? ORDER BY timestamp DESC').all(id) }; },
    facets() {
      return { categories: db.prepare("SELECT category, COUNT(*) c FROM businesses GROUP BY category ORDER BY c DESC LIMIT 200").all().map(r => r.category) };
    },
    setStatus(id, status) {
      if (!STATUSES.includes(status)) throw new Error('Invalid status');
      db.prepare('UPDATE businesses SET status=?, updated_at=? WHERE id=?').run(status, Date.now(), id);
    },
    bulkStatus(ids, status) {
      if (!STATUSES.includes(status)) throw new Error('Invalid status');
      db.prepare('UPDATE businesses SET status=?, updated_at=? WHERE id IN (SELECT value FROM json_each(?))').run(status, Date.now(), JSON.stringify(ids));
    },
    updateFields(id, fields) {
      const keys = Object.keys(fields || {}).filter(k => EDITABLE.includes(k));
      if (!keys.length) return;
      const vals = Object.fromEntries(keys.map(k => [k, String(fields[k] ?? '').slice(0, 5000)]));
      db.prepare(`UPDATE businesses SET ${keys.map(k => `${k}=@${k}`).join(',')}, updated_at=@u WHERE id=@id`).run({ ...vals, u: Date.now(), id });
    },
    deleteMany(ids) { return db.prepare('DELETE FROM businesses WHERE id IN (SELECT value FROM json_each(?))').run(JSON.stringify(ids)).changes; },

    findPotentialDuplicates() {
      const byPhone = db.prepare(`
        SELECT a.id as id1, b.id as id2, a.name as name1, b.name as name2,
               a.phone as phone1, b.phone as phone2, a.email as email1, b.email as email2,
               a.website as web1, b.website as web2,
               a.city as city1, b.city as city2, 'phone' as match_type
        FROM businesses a
        JOIN businesses b ON a.normalized_phone = b.normalized_phone AND a.id < b.id
        WHERE a.normalized_phone IS NOT NULL AND a.normalized_phone != ''
        LIMIT 40
      `).all();

      const byDomain = db.prepare(`
        SELECT a.id as id1, b.id as id2, a.name as name1, b.name as name2,
               a.phone as phone1, b.phone as phone2, a.email as email1, b.email as email2,
               a.website as web1, b.website as web2,
               a.city as city1, b.city as city2, 'domain' as match_type
        FROM businesses a
        JOIN businesses b ON a.domain = b.domain AND a.id < b.id
        WHERE a.domain IS NOT NULL AND a.domain != ''
        LIMIT 40
      `).all();

      const map = new Map();
      for (const pair of [...byPhone, ...byDomain]) {
        const key = `${pair.id1}_${pair.id2}`;
        if (!map.has(key)) map.set(key, pair);
      }
      return Array.from(map.values()).slice(0, 50);
    },

    mergeLeads(primaryId, secondaryId) {
      const p = getById.get(primaryId);
      const s = getById.get(secondaryId);
      if (!p || !s) throw new Error('Lead not found');

      const patch = {};
      for (const f of FILLABLE) {
        if ((p[f] == null || p[f] === '') && s[f] != null && s[f] !== '') {
          patch[f] = s[f];
        }
      }
      if (s.notes && s.notes !== p.notes) {
        patch.notes = [p.notes, `[Merged from ${s.name}]: ${s.notes}`].filter(Boolean).join('\n');
      }

      if (Object.keys(patch).length > 0) {
        const keys = Object.keys(patch);
        db.prepare(`UPDATE businesses SET ${keys.map(k => `${k}=@${k}`).join(',')}, updated_at=@u WHERE id=@id`)
          .run({ ...patch, u: Date.now(), id: primaryId });
      }

      db.prepare('UPDATE outreach_logs SET business_id = ? WHERE business_id = ?').run(primaryId, secondaryId);
      db.prepare('DELETE FROM businesses WHERE id = ?').run(secondaryId);
      return { ok: true, primaryId };
    },

    addLog({ business_id, action_type, notes, followUpDate }) {
      const row = getById.get(business_id);
      if (!row) throw new Error('Lead not found');
      const text = [followUpDate ? `Follow-up on ${followUpDate}` : '', notes || ''].filter(Boolean).join(' — ').slice(0, 5000);
      const now = Date.now();
      db.prepare('INSERT INTO outreach_logs (id,business_id,action_type,notes,timestamp) VALUES (?,?,?,?,?)').run(randomUUID(), business_id, action_type, text, now);
      if (followUpDate) {
        db.prepare('UPDATE businesses SET follow_up_date=?, updated_at=? WHERE id=?').run(followUpDate, now, business_id);
      }
      if (['Email Sent', 'Call Placed', 'LinkedIn InMail', 'WhatsApp Sent'].includes(action_type)) {
        db.prepare('UPDATE businesses SET last_contacted_at=?, updated_at=? WHERE id=?').run(now, now, business_id);
        if (row.status === 'New Lead') api.setStatus(business_id, 'Contacted');
      } else if (action_type === 'Follow-up Scheduled' && ['New Lead', 'Contacted'].includes(row.status)) {
        api.setStatus(business_id, 'Follow-up Scheduled');
      }
      return api.get(business_id);
    },
    addHistory(h) {
      db.prepare('INSERT INTO search_history (id,query_criteria,target_location,total_found,new_leads_added,duplicates_skipped,executed_at) VALUES (?,?,?,?,?,?,?)')
        .run(randomUUID(), h.query_criteria, h.target_location, h.total_found, h.new_leads_added, h.duplicates_skipped, Date.now());
    },

    importRows(rows = []) {
      let added = 0, enriched = 0, duplicates = 0;
      for (const row of rows) {
        if (!row || !row.name) continue;
        const res = ingest(row, 'CSV Import');
        if (res.outcome === 'added') added++;
        else if (res.outcome === 'enriched') enriched++;
        else duplicates++;
      }
      return { total: rows.length, added, enriched, duplicates };
    },

    getRecentSearches(limit = 10) {
      return db.prepare('SELECT * FROM search_history ORDER BY executed_at DESC LIMIT ?').all(Math.min(50, Math.max(1, Number(limit) || 10)));
    },

    getDueFollowUps() {
      const today = new Date().toISOString().slice(0, 10);
      return db.prepare("SELECT * FROM businesses WHERE follow_up_date IS NOT NULL AND follow_up_date <> '' AND follow_up_date <= ? AND status NOT IN ('Converted', 'Disqualified') ORDER BY follow_up_date ASC").all(today);
    },

    analytics() {
      const one = (sql, ...p) => db.prepare(sql).get(...p).c;
      const total = one('SELECT COUNT(*) c FROM businesses');
      const contacted = one("SELECT COUNT(*) c FROM businesses WHERE status IN ('Contacted','Follow-up Scheduled','Interested','Converted')");
      const withEmail = one("SELECT COUNT(*) c FROM businesses WHERE COALESCE(email,'') <> ''");
      return {
        total, contacted, withEmail,
        contactedRate: total ? (contacted / total) * 100 : 0,
        emailCoverage: total ? (withEmail / total) * 100 : 0,
        topCities: db.prepare('SELECT city, COUNT(*) c FROM businesses GROUP BY city ORDER BY c DESC LIMIT 5').all(),
        statuses: db.prepare('SELECT status, COUNT(*) c FROM businesses GROUP BY status').all(),
        recent: db.prepare('SELECT * FROM search_history ORDER BY executed_at DESC LIMIT 5').all()
      };
    },

    getSettings() {
      const out = { ...DEFAULTS };
      for (const r of db.prepare('SELECT key, value FROM settings').all()) {
        if (r.key in DEFAULTS) {
          if (typeof DEFAULTS[r.key] === 'boolean') out[r.key] = r.value === 'true' || r.value === '1';
          else if (typeof DEFAULTS[r.key] === 'number') out[r.key] = Number(r.value);
          else out[r.key] = r.value;
        }
      }
      return out;
    },
    saveSettings(p = {}) {
      const cur = api.getSettings();
      const clamp = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : d);
      const next = { ...cur };
      if ('concurrency' in p) next.concurrency = clamp(p.concurrency, 1, 5, cur.concurrency);
      if ('delayMin' in p) next.delayMin = clamp(p.delayMin, 500, 30000, cur.delayMin);
      if ('delayMax' in p) next.delayMax = clamp(p.delayMax, 500, 60000, cur.delayMax);
      if (next.delayMax < next.delayMin) next.delayMax = next.delayMin;
      if ('headless' in p) next.headless = p.headless !== false && p.headless !== 'false';
      if ('proxy' in p) {
        const raw = String(p.proxy || '').trim();
        if (raw) {
          const lines = raw.split(/[\r\n,;]+/).map(s => s.trim()).filter(Boolean);
          for (const line of lines) {
            if (!/^(https?|socks5):\/\/[^\s]+$/i.test(line)) {
              throw new Error(`Invalid proxy format: "${line}". Each proxy must look like http://host:port or socks5://host:port`);
            }
          }
        }
        next.proxy = raw;
      }
      const up = db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
      for (const [k, v] of Object.entries(next)) up.run(k, String(v));
      return next;
    },
    getFlag: key => db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value ?? null,
    setFlag: (key, value) => db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value)),

    getTemplates(channel = null) {
      if (channel) {
        return db.prepare('SELECT * FROM templates WHERE channel = ? ORDER BY updated_at DESC').all(channel);
      }
      return db.prepare('SELECT * FROM templates ORDER BY channel ASC, updated_at DESC').all();
    },
    saveTemplate(p = {}) {
      const id = String(p.id || randomUUID());
      const name = String(p.name || 'Untitled Template').trim().slice(0, 150);
      const channel = ['whatsapp', 'email'].includes(p.channel) ? p.channel : 'email';
      const subject = String(p.subject || '').trim().slice(0, 300);
      const body = String(p.body || '').trim().slice(0, 10000);
      db.prepare(`
        INSERT INTO templates (id, name, channel, subject, body, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          channel = excluded.channel,
          subject = excluded.subject,
          body = excluded.body,
          updated_at = excluded.updated_at
      `).run(id, name, channel, subject, body, Date.now());
      return db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    },
    deleteTemplate(id) {
      db.prepare('DELETE FROM templates WHERE id = ?').run(id);
      return { ok: true };
    },
    resetTemplates() {
      db.prepare('DELETE FROM templates').run();
      seedTemplates(db);
      return api.getTemplates();
    },

    backup: dest => db.backup(dest),
    wipe() {
      db.exec('DELETE FROM outreach_logs; DELETE FROM businesses; DELETE FROM search_history;');
      db.exec('VACUUM');
    },
    close: () => db.close()
  };
  return api;
}
