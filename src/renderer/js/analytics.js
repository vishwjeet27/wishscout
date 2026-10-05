/**
 * WishScout — Local Business Discovery & Intelligence
 * Copyright (C) 2026 Vishwjeet Singh Vilkhu (Original Creator & Architect)
 * Licensed under the GNU GPL-3.0. See LICENSE and NOTICE; attribution must be preserved (GPL-3.0 §7).
 */
import { call, h } from './util.js';
import { CH } from '../../shared/channels.js';

export async function mountAnalytics(root) {
  root.replaceChildren(h('h1', {}, 'Analytics'), h('p', { class: 'sub muted' }, 'Loading…'));
  const a = await call(CH.ANALYTICS_GET);
  const stat = (v, l) => h('div', { class: 'card stat' }, h('b', {}, v), h('span', {}, l));
  const pct = n => n.toFixed(1) + '%';
  const maxStatus = Math.max(1, ...a.statuses.map(s => s.c));
  root.replaceChildren(
    h('h1', {}, 'Analytics'),
    h('p', { class: 'sub' }, 'A snapshot of your local lead database.'),
    h('div', { class: 'grid cols4' }, stat(a.total, 'Total leads'), stat(pct(a.contactedRate), 'Contacted rate'), stat(pct(a.emailCoverage), 'Email coverage'), stat(a.topCities.length, 'Cities in top list')),
    h('div', { class: 'grid cols2', style: '' },
      h('div', { class: 'card' }, h('h2', {}, 'Pipeline status'),
        a.statuses.length ? a.statuses.map(s => h('div', { style: '' }, h('div', { class: 'row' }, h('span', {}, s.status), h('span', { class: 'muted' }, s.c)),
          h('div', { class: 'bar' }, h('i', { style: `width:${(s.c / maxStatus) * 100}%` })))) : h('p', { class: 'muted' }, 'No leads yet.')),
      h('div', { class: 'card' }, h('h2', {}, 'Top 5 cities'),
        a.topCities.length ? h('ol', {}, a.topCities.map(c => h('li', {}, `${c.city} — ${c.c}`))) : h('p', { class: 'muted' }, 'Run a discovery to see where your leads are.'),
        h('h2', {}, 'Recent searches'),
        a.recent.length ? h('ul', {}, a.recent.map(r => h('li', {}, `${r.query_criteria} in ${r.target_location}: ${r.new_leads_added} new, ${r.duplicates_skipped} duplicates`))) : h('p', { class: 'muted' }, 'Nothing yet.'))));
}
