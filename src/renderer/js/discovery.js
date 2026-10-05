/**
 * WishScout — Local Business Discovery & Intelligence
 * Copyright (C) 2026 Vishwjeet Singh Vilkhu (Original Creator & Architect)
 * Licensed under the GNU GPL-3.0. See LICENSE and NOTICE; attribution must be preserved (GPL-3.0 §7).
 */
import { api, call, h, toast, field, ext, copy, debounce, icon } from './util.js';
import { CH } from '../../shared/channels.js';
import { openDrawer, openWhatsApp } from './pipeline.js';
import { CITIES } from './cities.js';

const S = {
  status: 'idle',
  counters: { found: 0, added: 0, duplicates: 0, enriched: 0 },
  lines: [],
  leads: [],
  filter: '',
  form: { location: '', category: '', limit: 50, radius: 0, sources: ['google', 'bing'], websiteFilter: 'all', ratingFilter: 'all', phoneRequired: false },
  ui: null
};

const SOCIALS = [
  ['linkedin', 'LinkedIn'],
  ['twitter', 'Twitter / X'],
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['youtube', 'YouTube']
];

function addLine(level, msg) {
  S.lines.push({ level, msg });
  if (S.lines.length > 600) S.lines.shift();
  if (S.ui?.console) appendLine(S.lines.at(-1));
}

function appendLine({ level, msg }) {
  const c = S.ui.console;
  const stick = c.scrollTop + c.clientHeight >= c.scrollHeight - 30;
  c.append(h('div', { class: level }, `[${level}] ${msg}`));
  if (stick) c.scrollTop = c.scrollHeight;
}

function addStreamLead(lead) {
  const existingIdx = S.leads.findIndex(l => l.id === lead.id);
  if (existingIdx !== -1) {
    S.leads[existingIdx] = lead;
    updateLeadCard(lead);
    return;
  }
  S.leads.unshift(lead);
  if (S.leads.length > 300) S.leads.pop();

  if (!S.ui?.streamList) return;
  const q = S.filter.toLowerCase().trim();
  const matches = !q || [lead.name, lead.category, lead.city, lead.phone, lead.email, lead.owner_name]
    .some(s => String(s || '').toLowerCase().includes(q));

  // If scanner or empty placeholder is shown, re-render
  if (S.ui.streamList.querySelector('.scanner-box, .stream-empty')) {
    renderStream();
    return;
  }

  if (matches) {
    const card = renderLeadCard(lead, true);
    S.ui.streamList.prepend(card);
  }
  updatePill();
}

function updateStreamLead(lead) {
  const idx = S.leads.findIndex(l => l.id === lead.id);
  if (idx !== -1) S.leads[idx] = lead;
  else S.leads.unshift(lead);
  updateLeadCard(lead);
  updatePill();
}

function updateLeadCard(lead) {
  if (!S.ui?.streamList) return;
  const oldCard = document.getElementById('lead-card-' + lead.id);
  if (oldCard) {
    const newCard = renderLeadCard(lead, false);
    newCard.classList.add('lead-glow');
    oldCard.replaceWith(newCard);
  } else {
    renderStream();
  }
}

function renderLeadCard(lead, isNew = false) {
  const card = h('div', {
    class: 'stream-card' + (isNew ? ' stream-card-enter' : ''),
    id: 'lead-card-' + lead.id
  });

  const titleGroup = h('div', { class: 'stream-biz-info' },
    h('span', { class: 'stream-biz-name' },
      lead.name,
      lead.website ? ext(lead.website, icon('external', { size: 11 }), { 'aria-label': 'Open website' }) : null),
    h('span', { class: 'pill' }, lead.category || 'Business'),
    lead.rating ? h('span', { class: 'rating-text' }, icon('star', { size: 12, fill: '#f59e0b', stroke: '#f59e0b' }), ` ${lead.rating.toFixed(1)}`, lead.review_count ? h('span', { class: 'muted' }, ` (${lead.review_count})`) : null) : null);

  const actions = h('div', { class: 'row', style: 'margin:0;' },
    h('span', { class: 'pill', style: 'font-size:10px;' }, lead.status || 'New Lead'),
    h('button', {
      class: 'btn sm',
      onClick: () => openDrawer(lead.id, async () => {
        const fresh = await call(CH.LEADS_GET, { id: lead.id });
        if (fresh?.lead) updateStreamLead(fresh.lead);
      })
    }, 'Details'));

  const header = h('div', { class: 'stream-card-header' }, titleGroup, actions);

  const loc = [lead.address, lead.city, lead.state].filter(Boolean).join(', ');
  const meta = h('div', { class: 'stream-card-meta' },
    loc ? h('span', { class: 'stream-meta-item' }, icon('pin', { size: 13, class: 'meta-icon' }), loc) : null,
    lead.phone ? h('span', { class: 'stream-meta-item' }, icon('phone', { size: 13, class: 'meta-icon' }), ext('tel:' + lead.phone, lead.phone),
      h('button', { class: 'btn sm', style: 'padding:1px 6px; font-size:11px;', onClick: () => copy(lead.phone) }, 'Copy'),
      h('button', { class: 'btn sm btn-wa', style: 'padding:1px 6px; font-size:11px;', title: 'Open WhatsApp Chat', onClick: () => openWhatsApp(lead) }, icon('whatsapp', { size: 11 }), ' WhatsApp')) : null,
    lead.email ? h('span', { class: 'stream-meta-item email-badge' }, icon('mail', { size: 13, class: 'meta-icon' }), ext('mailto:' + lead.email, lead.email),
      h('button', { class: 'btn sm', style: 'padding:1px 6px; font-size:11px;', onClick: () => copy(lead.email) }, 'Copy'))
      : (lead.website && S.status === 'running'
        ? h('span', { class: 'enriching-pill' }, h('span', { class: 'pulse-dot-sm' }), 'Enriching website…')
        : h('span', { class: 'muted', style: 'font-size:11px;' }, 'No email')),
    lead.owner_name ? h('span', { class: 'stream-meta-item' }, icon('user', { size: 13, class: 'meta-icon' }), `${lead.owner_name}${lead.owner_title ? ` (${lead.owner_title})` : ''}`) : null,
    h('div', { class: 'chips' }, SOCIALS.filter(([k]) => lead['social_' + k]).map(([k, n]) => ext(lead['social_' + k], icon(k, { size: 12 }), { class: 'chip', 'aria-label': n, title: n }))));

  card.append(header, meta);
  return card;
}

function updatePill() {
  const pill = S.ui?.livePill;
  if (!pill) return;
  const count = S.leads.length;
  if (S.status === 'running') {
    pill.className = 'live-pill live';
    pill.replaceChildren(h('span', { class: 'pulse-indicator' }), `Streaming Live (${count})`);
  } else if (S.status === 'paused') {
    pill.className = 'live-pill paused';
    pill.replaceChildren(`Paused (${count})`);
  } else if (count > 0) {
    pill.className = 'live-pill done';
    pill.replaceChildren(icon('check', { size: 12, class: 'pill-icon' }), ` ${count} Discovered`);
  } else {
    pill.className = 'live-pill';
    pill.replaceChildren('Ready to Stream');
  }
}

const SOURCE_NAMES = {
  google: 'Google Maps',
  bing: 'Bing Maps',
  yellowpages: 'YellowPages',
  yelp: 'Yelp'
};

function formatActiveSources(sources) {
  if (!Array.isArray(sources) || !sources.length) return 'Google Maps';
  return sources.map(s => SOURCE_NAMES[s] || s).join(' + ');
}

function renderStream() {
  const list = S.ui?.streamList;
  if (!list) return;
  updatePill();

  const q = S.filter.toLowerCase().trim();
  const visible = q
    ? S.leads.filter(l => [l.name, l.category, l.city, l.phone, l.email, l.owner_name].some(s => String(s || '').toLowerCase().includes(q)))
    : S.leads;

  if (visible.length > 0) {
    list.replaceChildren(...visible.map(l => renderLeadCard(l, false)));
    return;
  }

  if (S.status === 'running') {
    const activeSourcesText = formatActiveSources(S.form.sources);
    list.replaceChildren(
      h('div', { class: 'scanner-box' },
        h('div', { class: 'radar-ring' }),
        h('div', { class: 'scanner-info' },
          h('b', {}, `Scanning ${activeSourcesText} for "${S.form.category || 'local businesses'}" in "${S.form.location || 'target area'}"…`),
          h('span', {}, 'Connected to live scraper. Listings and contact details will stream in below.'))));
    return;
  }

  list.replaceChildren(
    h('div', { class: 'stream-empty' },
      q ? 'No streamed leads match your filter.' : 'No discovery active. Click "Start discovery" to stream leads here in real-time as they are found.'));
}

function paint() {
  const u = S.ui; if (!u) return;
  const c = S.counters, run = S.status !== 'idle';
  u.found.textContent = c.found; u.added.textContent = c.added; u.dups.textContent = c.duplicates;
  u.enr.textContent = (c.found ? Math.round((c.enriched / c.found) * 100) : 0) + '%';
  u.start.disabled = run; u.pause.disabled = !run; u.cancel.disabled = !run;
  u.pause.textContent = S.status === 'paused' ? 'Resume' : 'Pause';
  u.status.textContent = { idle: 'Idle', running: 'Running…', paused: 'Paused' }[S.status];
  for (const i of u.inputs) i.disabled = run;
  updatePill();
}

export function initDiscovery() {
  api.on(CH.SCRAPE_EVENT, evt => {
    if (evt.type === 'lead') addStreamLead(evt.lead);
    if (evt.type === 'lead_updated') updateStreamLead(evt.lead);
    if (evt.counters) S.counters = evt.counters;
    if (evt.state) S.status = evt.state;
    if (evt.type === 'log') addLine(evt.level, evt.msg);
    if (evt.type === 'state' && evt.summary) toast(evt.summary);
    paint();
  });
  call(CH.SCRAPE_STATE).then(s => {
    S.status = s.state;
    S.counters = s.counters;
    if (s.streamedLeads) S.leads = s.streamedLeads;
    renderStream();
    paint();
  });
}

export function mountDiscovery(root) {
  const f = S.form;
  if (!f.sources) f.sources = ['google', 'bing'];

  // Smart Geo-Autocomplete Input
  const loc = h('input', {
    class: 'input',
    value: f.location,
    placeholder: 'e.g. Seattle, WA',
    autocomplete: 'off',
    onInput: e => { f.location = e.target.value; updateSuggestions(e.target.value); }
  });

  const suggestionsBox = h('div', { class: 'geo-autocomplete-dropdown', style: 'display:none;' });
  let activeIndex = -1;
  let currentMatches = [];

  function updateSuggestions(q) {
    const val = String(q || '').trim().toLowerCase();
    if (val.length < 1) {
      hideSuggestions();
      return;
    }
    currentMatches = CITIES.filter(c => c.toLowerCase().includes(val)).slice(0, 8);
    if (!currentMatches.length) {
      hideSuggestions();
      return;
    }
    activeIndex = -1;
    suggestionsBox.replaceChildren(...currentMatches.map((city, idx) =>
      h('div', {
        class: 'geo-suggestion-item',
        'data-index': idx,
        onClick: () => selectCity(city)
      }, icon('pin', { size: 12, class: 'geo-pin' }), document.createTextNode(' ' + city))
    ));
    suggestionsBox.style.display = 'block';
  }

  function selectCity(city) {
    loc.value = city;
    f.location = city;
    hideSuggestions();
    loc.focus();
  }

  function hideSuggestions() {
    suggestionsBox.style.display = 'none';
    suggestionsBox.replaceChildren();
    activeIndex = -1;
  }

  loc.addEventListener('keydown', e => {
    if (suggestionsBox.style.display === 'none') return;
    const items = suggestionsBox.querySelectorAll('.geo-suggestion-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      items.forEach((it, i) => it.classList.toggle('active', i === activeIndex));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      items.forEach((it, i) => it.classList.toggle('active', i === activeIndex));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && currentMatches[activeIndex]) {
        e.preventDefault();
        selectCity(currentMatches[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
  });

  loc.addEventListener('focus', () => {
    if (loc.value.trim().length >= 1) updateSuggestions(loc.value);
  });

  const onDocClick = e => {
    if (!loc.contains(e.target) && !suggestionsBox.contains(e.target)) hideSuggestions();
  };
  document.addEventListener('click', onDocClick);

  const locWrapper = h('div', { class: 'autocomplete-wrapper', style: 'position:relative; width: 100%;' }, loc, suggestionsBox);

  const cat = h('input', { class: 'input', value: f.category, placeholder: 'e.g. Dental clinics', onInput: e => (f.category = e.target.value) });
  const radius = h('select', { class: 'input', onChange: e => (f.radius = Number(e.target.value)) },
    [[0, 'Whole area (Multi-grid)'], [5, '5 km'], [10, '10 km'], [25, '25 km'], [50, '50 km']].map(([v, l]) => h('option', { value: v, selected: v === f.radius }, l)));
  const limit = h('input', { class: 'input', type: 'number', min: 1, max: 1000, value: f.limit, onInput: e => (f.limit = e.target.value) });

  const updateSource = (src, checked) => {
    if (checked) {
      if (!f.sources.includes(src)) f.sources.push(src);
    } else {
      if (f.sources.length > 1) {
        f.sources = f.sources.filter(s => s !== src);
      } else {
        toast('At least one data source must be selected.');
        return false;
      }
    }
    return true;
  };

  const chkGoogle = h('input', { type: 'checkbox', checked: f.sources.includes('google'), onChange: e => { if (!updateSource('google', e.target.checked)) e.target.checked = true; } });
  const chkBing = h('input', { type: 'checkbox', checked: f.sources.includes('bing'), onChange: e => { if (!updateSource('bing', e.target.checked)) e.target.checked = true; } });
  const chkYP = h('input', { type: 'checkbox', checked: f.sources.includes('yellowpages'), onChange: e => { if (!updateSource('yellowpages', e.target.checked)) e.target.checked = true; } });
  const chkYelp = h('input', { type: 'checkbox', checked: f.sources.includes('yelp'), onChange: e => { if (!updateSource('yelp', e.target.checked)) e.target.checked = true; } });

  const sourcesRow = h('div', { class: 'field', style: 'grid-column: 1 / -1; width: 100%;' },
    h('div', { class: 'row', style: 'justify-content: space-between; align-items: baseline; margin-bottom: 2px;' },
      h('span', {}, 'Active discovery sources'),
      h('span', { class: 'muted', style: 'font-size: 11px;' }, 'Google & Bing support global queries (India, Worldwide). Yelp & YellowPages cover US / Canada / Europe.')
    ),
    h('div', { class: 'row', style: 'gap: 16px; margin-top: 6px; flex-wrap: wrap;' },
      h('label', { class: 'chk', style: 'cursor: pointer;' }, chkGoogle, ' Google Maps (Global / Multi-Grid)'),
      h('label', { class: 'chk', style: 'cursor: pointer;' }, chkBing, ' Bing Maps (Global)'),
      h('label', { class: 'chk', style: 'cursor: pointer;' }, chkYP, ' YellowPages (US / Canada)'),
      h('label', { class: 'chk', style: 'cursor: pointer;' }, chkYelp, ' Yelp (US / UK / Europe)')
    )
  );

  const selWebsite = h('select', { class: 'input', onChange: e => (f.websiteFilter = e.target.value) },
    [['all', 'All listings'], ['none', 'No website only (Pitch targets)'], ['has', 'Has website only']].map(([v, l]) =>
      h('option', { value: v, selected: v === (f.websiteFilter || 'all') }, l)));

  const selRating = h('select', { class: 'input', onChange: e => (f.ratingFilter = e.target.value) },
    [['all', 'All ratings'], ['high', '4.5+ Stars (Top rated)'], ['low', 'Under 4.0 Stars (ORM pitch)'], ['poor', 'Under 3.5 Stars']].map(([v, l]) =>
      h('option', { value: v, selected: v === (f.ratingFilter || 'all') }, l)));

  const chkPhone = h('input', { type: 'checkbox', checked: !!f.phoneRequired, onChange: e => (f.phoneRequired = e.target.checked) });

  const filtersRow = h('div', { class: 'row', style: 'margin-top: 10px; gap: 16px; align-items: flex-end; flex-wrap: wrap;' },
    field('Website filter', selWebsite),
    field('Rating filter', selRating),
    h('div', { class: 'field' },
      h('span', {}, 'Contact requirements'),
      h('label', { class: 'chk', style: 'cursor: pointer; margin-top: 8px;' }, chkPhone, ' Phone number required')
    )
  );

  const recentSearchesBox = h('div', { class: 'recent-searches-box', style: 'display:none; margin-top: 14px; padding-top: 10px; border-top: 1px solid var(--border);' });

  function fmtTimeAgo(timestamp) {
    const diffSec = Math.floor((Date.now() - Number(timestamp)) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  }

  async function loadRecentSearches() {
    try {
      const recents = await call(CH.SEARCH_HISTORY, { limit: 6 });
      if (!recents || !recents.length) {
        recentSearchesBox.style.display = 'none';
        return;
      }
      recentSearchesBox.replaceChildren(
        h('div', { style: 'display: flex; align-items: center; gap: 6px; margin-bottom: 8px;' },
          icon('clock', { size: 12 }),
          h('span', { class: 'muted', style: 'font-size: 11px; font-weight: 600;' }, 'Recent Discovery Queries (Click chip to reload):')
        ),
        h('div', { class: 'chips', style: 'gap: 8px; flex-wrap: wrap;' },
          recents.map(r => {
            const timeAgo = fmtTimeAgo(r.executed_at);
            return h('button', {
              class: 'btn sm recent-query-chip',
              type: 'button',
              style: 'font-size: 11px;',
              title: `Target: ${r.query_criteria} in ${r.target_location}`,
              onClick: () => {
                f.location = r.target_location;
                loc.value = r.target_location;
                f.category = r.query_criteria;
                cat.value = r.query_criteria;
                toast(`Loaded: ${r.query_criteria} in ${r.target_location}`);
              }
            },
              h('b', {}, r.query_criteria),
              document.createTextNode(` in ${r.target_location} `),
              h('span', { class: 'muted', style: 'font-size: 10px;' }, `(${r.new_leads_added || r.total_found} leads • ${timeAgo})`)
            );
          })
        )
      );
      recentSearchesBox.style.display = 'block';
    } catch {}
  }
  loadRecentSearches();

  const start = h('button', { class: 'btn primary', onClick: async () => {
    const hasGlobal = (f.sources || []).some(s => s === 'google' || s === 'bing');
    const isIndia = /india|indore|mumbai|delhi|bangalore|bengaluru|hyderabad|pune|chennai|kolkata|jaipur|ahmedabad|madhya pradesh|karnataka|maharashtra|uttar pradesh|rajasthan|gujarat|tamil nadu/i.test(f.location || '');
    if (!hasGlobal && isIndia) {
      toast('Yelp & YellowPages do not cover India. Please enable Google Maps or Bing Maps for Indian cities.');
      return;
    }

    S.lines = [];
    S.leads = [];
    S.ui.console.replaceChildren();
    renderStream();
    try {
      const s = await call(CH.SCRAPE_START, f);
      S.status = s.state;
      S.counters = s.counters;
      if (s.streamedLeads) S.leads = s.streamedLeads;
      renderStream();
      paint();
      setTimeout(loadRecentSearches, 2000);
    } catch (e) {
      toast(e.message.replace(/^Error invoking remote method '[^']+': Error: /, ''));
    }
  } }, 'Start discovery');

  const pause = h('button', { class: 'btn', onClick: () => call(S.status === 'paused' ? CH.SCRAPE_RESUME : CH.SCRAPE_PAUSE) }, 'Pause');
  const cancel = h('button', { class: 'btn danger', onClick: () => call(CH.SCRAPE_CANCEL) }, 'Cancel');
  const stat = label => { const n = h('b', {}, '0'); return [h('div', { class: 'card stat' }, n, h('span', {}, label)), n]; };
  const [c1, found] = stat('Found'), [c2, added] = stat('Net-new added'), [c3, dups] = stat('Duplicates skipped'), [c4, enr] = stat('Enriched');
  const status = h('span', { class: 'muted' }, 'Idle');
  const console_ = h('div', { class: 'console', role: 'log', 'aria-live': 'polite' });

  const livePill = h('span', { class: 'live-pill' }, 'Ready to Stream');
  const filterInput = h('input', {
    class: 'input search-sm',
    type: 'search',
    placeholder: 'Filter streamed leads…',
    value: S.filter,
    onInput: debounce(e => { S.filter = e.target.value; renderStream(); }, 200)
  });

  const btnPipeline = h('button', {
    class: 'btn sm',
    type: 'button',
    onClick: () => window.navigateTo?.('pipeline')
  }, 'View in Pipeline ', icon('arrow-right', { size: 12 }));

  const btnExport = h('button', {
    class: 'btn sm',
    type: 'button',
    onClick: async () => {
      if (!S.leads.length) return toast('No leads in current stream');
      const r = await call(CH.EXPORT_CSV, { ids: S.leads.map(l => l.id) });
      if (!r.canceled) toast(`Exported ${r.count} lead${r.count === 1 ? '' : 's'}`);
    }
  }, 'Export CSV');

  const btnClear = h('button', {
    class: 'btn sm',
    type: 'button',
    onClick: () => { S.leads = []; renderStream(); updatePill(); }
  }, 'Clear stream');

  const streamHeader = h('div', { class: 'stream-header' },
    h('div', { class: 'stream-title-group' },
      h('h2', {}, 'Live Discovered Leads'),
      livePill),
    h('div', { class: 'stream-actions' },
      filterInput,
      btnPipeline,
      btnExport,
      btnClear));

  const streamList = h('div', { class: 'stream-list' });
  const streamContainer = h('div', { class: 'stream-container' }, streamList);

  S.ui = {
    found, added, dups, enr, start, pause, cancel, status,
    console: console_, livePill, streamList,
    inputs: [loc, cat, radius, limit, selWebsite, selRating, chkPhone, chkGoogle, chkBing, chkYP, chkYelp]
  };

  S.lines.forEach(appendLine);
  renderStream();

  root.replaceChildren(
    h('h1', {}, 'Discovery'),
    h('p', { class: 'sub' }, 'Find local businesses by place and category. Candidate results and enriched public contacts stream directly to your screen in real time.'),
    h('div', { class: 'card' },
      h('div', { class: 'row' }, field('Target location', locWrapper), field('Business category (comma-separated for batch)', cat), field('Search radius', radius), field('Max results', limit)),
      h('div', { class: 'row', style: 'margin-top: 10px;' }, sourcesRow),
      filtersRow,
      h('div', { class: 'row', style: 'margin-top: 14px;' }, start, pause, cancel, status),
      recentSearchesBox
    ),
    h('div', { class: 'grid cols4', id: 'stats' }, c1, c2, c3, c4),
    h('div', { class: 'stream-section' }, streamHeader, streamContainer),
    h('details', { class: 'console-details' }, h('summary', {}, 'Live extraction console (Technical logs)'), console_));

  paint();
  return () => {
    document.removeEventListener('click', onDocClick);
    S.ui = null;
  };
}

