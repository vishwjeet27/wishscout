/**
 * WishScout — Local Business Discovery & Intelligence
 * Copyright (C) 2026 Vishwjeet Singh Vilkhu (Original Creator & Architect)
 * Licensed under the GNU GPL-3.0. See LICENSE and NOTICE; attribution must be preserved (GPL-3.0 §7).
 */
import { utilityProcess } from 'electron';

const blank = () => ({ found: 0, added: 0, duplicates: 0, enriched: 0 });

export class ScraperManager {
  constructor({ store, workerPath, emit }) {
    Object.assign(this, { store, workerPath, emit, child: null, status: 'idle', counters: blank(), job: null, streamedLeads: [] });
  }
  snapshot() { return { state: this.status, counters: this.counters, job: this.job, streamedLeads: this.streamedLeads || [] }; }
  #push(evt) { this.emit({ ...evt, state: this.status, counters: this.counters }); }
  #log(level, msg) { this.#push({ type: 'log', level, msg }); }

  start(job) {
    if (this.child) throw new Error('A discovery run is already active.');
    this.job = { location: job.location, category: job.category, limit: job.limit, radius: job.radius, sources: job.sources || ['google'] };
    this.counters = blank();
    this.streamedLeads = [];
    this.status = 'running';
    const settings = this.store.getSettings();
    this.child = utilityProcess.fork(this.workerPath, [], { serviceName: 'wishscout-scraper' });
    this.child.on('message', m => this.#onMessage(m));
    this.child.on('exit', () => { if (this.child) this.#finish('Scraper process ended unexpectedly.'); });
    this.child.postMessage({ type: 'start', job: { ...job, settings, known: this.store.knownPlaceIds() } });
    this.#push({ type: 'state' });
  }
  pause() { if (this.status === 'running') { this.child?.postMessage({ type: 'pause' }); this.status = 'paused'; this.#log('INFO', 'Paused. In-flight requests will finish first.'); } }
  resume() { if (this.status === 'paused') { this.child?.postMessage({ type: 'resume' }); this.status = 'running'; this.#log('INFO', 'Resumed.'); } }
  cancel() { if (this.child) { this.child.postMessage({ type: 'cancel' }); this.#log('INFO', 'Cancelling…'); setTimeout(() => this.child && this.#finish('Cancelled.'), 8000); } }

  #onMessage(m) {
    switch (m.type) {
      case 'log': return this.#log(m.level, m.msg);
      case 'progress': this.counters.found = Math.max(this.counters.found, m.found); return this.#push({ type: 'progress' });
      case 'skipped':
        this.counters.duplicates++;
        this.#log('DEDUPE', `Skipped duplicate: ${m.name}${m.phone ? ` (${m.phone})` : ''}`);
        return;
      case 'record': return this.#ingest(m.record);
      case 'record_enriched': return this.#enrich(m.record);
      case 'done': return this.#finish(m.aborted ? 'Cancelled.' : 'Discovery complete.');
      case 'fatal': this.#log('ERROR', m.message); return this.#finish('Discovery stopped due to an error.');
    }
  }
  #ingest(rec) {
    try {
      const r = this.store.ingest(rec, `${this.job.category} in ${this.job.location}`);
      const where = [rec.city, rec.state].filter(Boolean).join(', ');
      if (r.outcome === 'added') {
        this.counters.added++;
        this.#log('INFO', `Discovered: ${rec.name} | ${where}`);
        const bits = [rec.email && 'email', rec.owner_name && 'owner', ['linkedin', 'instagram', 'facebook', 'twitter', 'youtube'].some(k => rec['social_' + k]) && 'social profiles'].filter(Boolean);
        if (bits.length) { this.counters.enriched++; this.#log('ENRICH', `${rec.name}: found ${bits.join(', ')}`); }
        const lead = this.store.get(r.id)?.lead;
        if (lead) {
          this.streamedLeads.unshift(lead);
          if (this.streamedLeads.length > 300) this.streamedLeads.pop();
          this.#push({ type: 'lead', lead, stage: 'discovered' });
        }
      } else {
        this.counters.duplicates++;
        const note = r.outcome === 'enriched' ? ' (existing lead enriched)' : r.outcome === 'protected' ? ' (active lead protected)' : '';
        this.#log('DEDUPE', `Skipped duplicate: ${rec.name}${rec.phone ? ` (${rec.phone})` : ''}${note}`);
        if (r.outcome === 'enriched') {
          const lead = this.store.get(r.id)?.lead;
          if (lead) {
            this.#push({ type: 'lead_updated', lead, stage: 'enriched' });
          }
        }
      }
    } catch (e) { this.#log('ERROR', `Could not save ${rec?.name}: ${e.message}`); }
    this.#push({ type: 'progress' });
  }
  #enrich(rec) {
    try {
      const r = this.store.ingest(rec, `${this.job.category} in ${this.job.location}`);
      const bits = [rec.email && 'email', rec.owner_name && 'owner', ['linkedin', 'instagram', 'facebook', 'twitter', 'youtube'].some(k => rec['social_' + k]) && 'social profiles'].filter(Boolean);
      if (bits.length) {
        this.counters.enriched++;
        this.#log('ENRICH', `${rec.name}: found ${bits.join(', ')}`);
      }
      if (r.id) {
        const lead = this.store.get(r.id)?.lead;
        if (lead) {
          const idx = this.streamedLeads.findIndex(l => l.id === lead.id);
          if (idx !== -1) this.streamedLeads[idx] = lead;
          this.#push({ type: 'lead_updated', lead, stage: 'enriched' });
        }
      }
    } catch (e) { this.#log('ERROR', `Could not update enriched data for ${rec?.name}: ${e.message}`); }
    this.#push({ type: 'progress' });
  }
  #finish(message) {
    const child = this.child; this.child = null;
    try { child?.kill(); } catch { /* already gone */ }
    if (this.job) {
      this.store.addHistory({ query_criteria: this.job.category, target_location: this.job.location, total_found: this.counters.found,
        new_leads_added: this.counters.added, duplicates_skipped: this.counters.duplicates });
    }
    this.status = 'idle';
    this.#log('INFO', message);
    this.#push({ type: 'state', summary: message });
  }
  shutdown() { try { this.child?.kill(); } catch { /* noop */ } this.child = null; }
}
