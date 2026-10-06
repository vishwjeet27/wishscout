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
import { api, call, h, $, toast, field, ext, copy, icon, modal } from './util.js';
import { CH } from '../../shared/channels.js';

const PRESET_PACKS = [
  {
    name: 'Healthcare & Clinics Pack (35 queries)',
    niches: ['hospitals', 'multispeciality hospitals', 'dental clinics', 'orthodontists', 'skin clinics', 'dermatologists', 'hair transplant clinics', 'cosmetic surgeons', 'eye hospitals', 'ENT specialists', 'gynecologists', 'IVF centres', 'pediatricians', 'orthopedic doctors', 'cardiologists', 'neurologists', 'psychiatrists', 'diagnostic labs', 'pathology labs', 'X-ray centres', 'pharmacies', 'physiotherapy clinics', 'ayurvedic clinics', 'homeopathic clinics', 'veterinary clinics', 'ambulance services', 'dialysis centres', 'dietitians', 'hearing aid clinics', 'opticians']
  },
  {
    name: 'Real Estate & Construction Ecosystem (35 queries)',
    niches: ['real estate agents', 'property dealers', 'builders and developers', 'real estate consultants', 'co-working spaces', 'interior designers', 'architects', 'civil contractors', 'construction companies', 'building material suppliers', 'cement dealers', 'steel dealers', 'tiles showrooms', 'sanitaryware stores', 'paint shops', 'plywood dealers', 'modular kitchen showrooms', 'furniture stores', 'false ceiling contractors', 'waterproofing contractors', 'home renovation contractors', 'landscaping services', 'swimming pool contractors', 'elevator companies', 'glass and aluminium dealers', 'electricians', 'plumbers', 'carpenters', 'painters', 'solar companies', 'inverter and battery dealers']
  },
  {
    name: 'Home Improvement & Local Services (35 queries)',
    niches: ['electricians', 'plumbers', 'carpenters', 'painters', 'pest control services', 'AC repair', 'RO water purifier service', 'home cleaning services', 'packers and movers', 'CCTV installers', 'solar companies', 'inverter and battery dealers', 'washing machine repair', 'locksmiths', 'car service centres', 'car wash', 'tyre shops', 'car rental services', 'supermarkets', 'mobile repair', 'computer shops', 'laptop dealers', 'home appliance stores']
  },
  {
    name: 'Hospitality, Food & Nightlife (30 queries)',
    niches: ['restaurants', 'cafes', 'fast food restaurants', 'pizza shops', 'bakeries', 'sweet shops', 'ice cream parlours', 'catering services', 'cloud kitchens', 'hotels', 'budget hotels', 'resorts', 'guest houses', 'hostels', 'banquet halls', 'party halls', 'bars', 'pubs', 'wedding planners', 'event management companies', 'photographers', 'DJ services', 'tent houses', 'florists']
  },
  {
    name: 'Professional B2B Services & Education (30 queries)',
    niches: ['CA firms', 'tax consultants', 'GST consultants', 'lawyers', 'advocates', 'company registration consultants', 'insurance agents', 'loan agents', 'financial advisors', 'recruitment agencies', 'HR consultants', 'software companies', 'IT services', 'app development companies', 'digital marketing agencies', 'web designers', 'coaching classes', 'schools', 'colleges', 'computer training institutes', 'gyms', 'yoga studios', 'salons', 'spas', 'travel agencies', 'visa consultants']
  }
];

function openMatrixModal(onApply) {
  const txtNiches = h('textarea', {
    class: 'input',
    rows: 5,
    placeholder: 'Enter niches (one per line):\nReal Estate Agents\nBuilders and Developers\nInterior Designers\nArchitects'
  });
  txtNiches.value = 'Real Estate Agents\nBuilders and Developers\nInterior Designers\nArchitects\nPlumbers';

  const txtLocations = h('textarea', {
    class: 'input',
    rows: 5,
    placeholder: 'Enter locations / cities (one per line):\nPanaji\nMargao\nCalangute\nVasco\nMapusa'
  });
  txtLocations.value = 'North Goa\nSouth Goa\nPanaji\nMargao\nMapusa';

  const patternSelect = h('select', { class: 'input' },
    h('option', { value: '{niche} in {location}' }, '{niche} in {location} (e.g. Dentists in Goa)'),
    h('option', { value: '{niche} near {location}' }, '{niche} near {location} (e.g. Dentists near Goa)'),
    h('option', { value: '{location} {niche}' }, '{location} {niche} (e.g. Goa Dentists)')
  );

  const previewBadge = h('span', { class: 'pill', style: 'font-weight: 600;' }, '25 queries will be generated');

  function updateCount() {
    const n = txtNiches.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean).length;
    const l = txtLocations.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean).length;
    previewBadge.textContent = `${n} Niches × ${l} Locations = ${n * l} Queries`;
  }
  txtNiches.oninput = updateCount;
  txtLocations.oninput = updateCount;
  updateCount();

  const close = modal([
    h('div', { class: 'row', style: 'justify-content: space-between; align-items: center;' },
      h('div', { class: 'row', style: 'gap: 8px;' },
        icon('zap', { size: 16 }),
        h('h1', { style: 'font-size: 16px; margin: 0;' }, 'Matrix Query Multiplier')
      ),
      h('button', { class: 'btn sm', onClick: () => close() }, 'Close')
    ),
    h('p', { class: 'sec', style: 'font-size: 12.5px; margin: 6px 0 14px;' },
      'Multiply target business niches across multiple cities or sub-areas in 1-click.'
    ),
    h('div', { class: 'grid cols2', style: 'gap: 12px;' },
      field('1. Target Niches (one per line)', txtNiches),
      field('2. Target Locations / Cities (one per line)', txtLocations)
    ),
    h('div', { style: 'margin-top: 12px;' },
      field('Query Pattern Template', patternSelect)
    ),
    h('div', { class: 'row', style: 'justify-content: space-between; margin-top: 16px; align-items: center;' },
      previewBadge,
      h('div', { class: 'row', style: 'gap: 8px;' },
        h('button', { class: 'btn', onClick: () => close() }, 'Cancel'),
        h('button', {
          class: 'btn primary',
          onClick: () => {
            const niches = txtNiches.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
            const locations = txtLocations.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
            if (!niches.length || !locations.length) return toast('Please enter at least 1 niche and 1 location');
            const pattern = patternSelect.value;
            const generated = [];
            for (const n of niches) {
              for (const loc of locations) {
                generated.push(pattern.replace('{niche}', n).replace('{location}', loc));
              }
            }
            onApply(generated);
            close();
            toast(`Generated ${generated.length} queries successfully!`);
          }
        }, icon('zap', { size: 13 }), ' Generate & Insert Queries')
      )
    )
  ]);
}

function openPresetModal(onApply) {
  const selPack = h('select', { class: 'input' },
    PRESET_PACKS.map((p, idx) => h('option', { value: idx }, p.name))
  );

  const inpLoc = h('input', {
    class: 'input',
    placeholder: 'Enter city or region, e.g.: Goa, Berlin, Austin TX, Mumbai...',
    value: 'Goa'
  });

  const previewList = h('div', {
    class: 'cmd-preview-box',
    style: 'max-height: 120px; overflow-y: auto; font-size: 11px;'
  });

  function updatePreview() {
    const pack = PRESET_PACKS[selPack.value];
    const loc = inpLoc.value.trim() || 'Goa';
    previewList.textContent = pack.niches.slice(0, 8).map(n => `${n} in ${loc}`).join('\n') + `\n...and ${pack.niches.length - 8} more`;
  }
  selPack.onchange = updatePreview;
  inpLoc.oninput = updatePreview;
  updatePreview();

  const close = modal([
    h('div', { class: 'row', style: 'justify-content: space-between; align-items: center;' },
      h('div', { class: 'row', style: 'gap: 8px;' },
        icon('box', { size: 16 }),
        h('h1', { style: 'font-size: 16px; margin: 0;' }, 'Industry Preset Query Packs')
      ),
      h('button', { class: 'btn sm', onClick: () => close() }, 'Close')
    ),
    h('p', { class: 'sec', style: 'font-size: 12.5px; margin: 6px 0 14px;' },
      'High-converting, pre-curated B2B lead generation packages for agencies and scrapers.'
    ),
    field('1. Select Industry Package', selPack),
    h('div', { style: 'margin-top: 10px;' },
      field('2. Target Location / Market', inpLoc)
    ),
    h('div', { style: 'margin-top: 10px;' },
      h('span', { class: 'sec', style: 'font-size: 11.5px; display: block; margin-bottom: 4px;' }, 'Queries Preview:'),
      previewList
    ),
    h('div', { class: 'row', style: 'justify-content: flex-end; margin-top: 16px; gap: 8px;' },
      h('button', { class: 'btn', onClick: () => close() }, 'Cancel'),
      h('button', {
        class: 'btn primary',
        onClick: () => {
          const pack = PRESET_PACKS[selPack.value];
          const loc = inpLoc.value.trim() || 'Goa';
          const queries = pack.niches.map(n => `${n} in ${loc}`);
          onApply(queries);
          close();
          toast(`Loaded ${queries.length} queries from ${pack.name}!`);
        }
      }, icon('play', { size: 13 }), ' Apply Preset Pack')
    )
  ]);
}

const G = {
  prereq: { checking: true, installed: false, running: false, version: '', message: '' },
  status: 'idle',
  counters: { found: 0, added: 0, duplicates: 0, enriched: 0 },
  progress: { currentQueryIndex: 0, totalQueries: 0, currentQuery: '', percent: 0, etaSeconds: 0 },
  queryStats: { total: 0, completed: 0, zeroResults: 0, failed: 0 },
  failedQueries: [],
  logs: [],
  form: {
    queries: 'dentists in Berlin\nfitness gyms in Munich',
    depth: 10,
    concurrency: 4,
    lang: 'en',
    email: false,
    fastMode: false,
    extraReviews: false,
    geoCoordinates: '',
    zoom: 14,
    gridBBox: '',
    gridCellKm: 1.0,
    proxies: ''
  },
  ui: null,
  cleanupEvent: null
};

function addLog(level, msg) {
  G.logs.push({ level, msg, time: Date.now() });
  if (G.logs.length > 500) G.logs.shift();
  if (G.ui?.console) appendConsole({ level, msg });
}

function appendConsole({ level, msg }) {
  const c = G.ui.console;
  if (!c) return;
  const stick = c.scrollTop + c.clientHeight >= c.scrollHeight - 35;
  c.append(h('div', { class: level }, `[${level}] ${msg}`));
  if (stick) c.scrollTop = c.scrollHeight;
}

function updateCountersUi() {
  if (!G.ui) return;
  if (G.ui.statFound) G.ui.statFound.textContent = G.counters.found;
  if (G.ui.statAdded) G.ui.statAdded.textContent = G.counters.added;
  if (G.ui.statDup) G.ui.statDup.textContent = G.counters.duplicates + G.counters.enriched;
  if (G.ui.statStatus) G.ui.statStatus.textContent = G.status === 'running' ? 'Running' : 'Idle';
}

function buildCommandStrings() {
  const qLines = String(G.form.queries || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const c = Math.max(1, Math.min(32, Number(G.form.concurrency) || 4));
  const depth = Math.max(1, Math.min(100, Number(G.form.depth) || 10));
  const lang = String(G.form.lang || 'en').trim();

  const dockerCmd = [
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
  if (G.form.email) dockerCmd.push('-email');
  if (G.form.geoCoordinates && G.form.geoCoordinates.trim()) {
    dockerCmd.push(`-geo "${G.form.geoCoordinates.trim()}"`);
    if (G.form.zoom && Number(G.form.zoom) > 0) dockerCmd.push(`-zoom ${G.form.zoom}`);
    if (G.form.fastMode) dockerCmd.push('-fast-mode');
  }
  if (G.form.extraReviews) dockerCmd.push('-extra-reviews');
  if (G.form.gridBBox && G.form.gridBBox.trim()) {
    dockerCmd.push(`-grid-bbox "${G.form.gridBBox.trim()}"`);
    if (G.form.gridCellKm && Number(G.form.gridCellKm) > 0) dockerCmd.push(`-grid-cell ${G.form.gridCellKm}`);
  }

  const cliCmd = [
    'google-maps-scraper',
    '-input queries.txt',
    '-results results.json',
    '-json',
    `-c ${c}`,
    `-depth ${depth}`,
    `-lang ${lang}`
  ];
  if (G.form.email) cliCmd.push('-email');
  if (G.form.geoCoordinates && G.form.geoCoordinates.trim()) {
    cliCmd.push(`-geo "${G.form.geoCoordinates.trim()}"`);
    if (G.form.zoom && Number(G.form.zoom) > 0) cliCmd.push(`-zoom ${G.form.zoom}`);
    if (G.form.fastMode) cliCmd.push('-fast-mode');
  }
  if (G.form.extraReviews) cliCmd.push('-extra-reviews');

  return {
    docker: dockerCmd.join(' '),
    cli: cliCmd.join(' ')
  };
}

async function verifyPrerequisites() {
  if (G.ui?.prereqPill) {
    G.ui.prereqPill.className = 'gosom-prereq-badge';
    G.ui.prereqPill.replaceChildren(h('span', { class: 'pulse-dot-sm' }), document.createTextNode('Checking Docker…'));
  }
  if (G.ui?.prereqMsg) {
    G.ui.prereqMsg.textContent = 'Probing local Docker daemon and CLI…';
  }

  try {
    const res = await call(CH.GOSOM_CHECK);
    G.prereq = res;
    renderPrereqStatus();
  } catch (err) {
    G.prereq = {
      installed: false,
      running: false,
      version: '',
      message: 'Failed to query environment: ' + (err?.message || err)
    };
    renderPrereqStatus();
  }
}

function renderPrereqStatus() {
  if (!G.ui?.prereqPill || !G.ui?.prereqMsg) return;
  const p = G.prereq;

  if (p.installed && p.running) {
    G.ui.prereqPill.className = 'gosom-prereq-badge ok';
    G.ui.prereqPill.replaceChildren(
      icon('check', { size: 12 }),
      document.createTextNode(' ' + (p.version ? `${p.version} (Active)` : 'Docker Engine Ready'))
    );
    G.ui.prereqMsg.textContent = 'Docker Desktop engine is running smoothly. Container commands can execute directly from WishScout.';
  } else if (p.installed && !p.running) {
    G.ui.prereqPill.className = 'gosom-prereq-badge warn';
    G.ui.prereqPill.replaceChildren(
      icon('clock', { size: 12 }),
      document.createTextNode(' ' + (p.version ? `${p.version} (Daemon Stopped)` : 'Docker Inactive'))
    );
    G.ui.prereqMsg.textContent = 'Docker CLI is installed, but Docker Desktop daemon is not running. Start Docker Desktop to launch containers, or use the Command Generator below for manual execution.';
  } else {
    G.ui.prereqPill.className = 'gosom-prereq-badge err';
    G.ui.prereqPill.replaceChildren(
      icon('close', { size: 12 }),
      document.createTextNode(' Docker Not Found')
    );
    G.ui.prereqMsg.textContent = 'Docker command was not found on your system PATH. Please install Docker Desktop (or run Gosom via local Go CLI).';
  }
}

export function mountGosom(container) {
  container.innerHTML = '';

  // Header section
  const header = h('div', { class: 'pipeline-header' },
    h('h1', {}, 'Gosom Scraping Engine'),
    h('p', { class: 'sub' },
      'High-throughput, Go-powered Google Maps distributed scraper (',
      ext('https://github.com/gosom/google-maps-scraper', 'gosom/google-maps-scraper', { style: 'color: var(--accent-contrast); text-decoration: underline;' }),
      ' by Georgios Somarakis, MIT License). Built for bulk data harvesting, detailed user reviews, and hourly traffic curves. Scraped leads automatically populate your WishScout CRM pipeline.'
    )
  );

  // Prerequisites Card
  const prereqPill = h('span', { class: 'gosom-prereq-badge' }, 'Checking…');
  const prereqMsg = h('p', { class: 'sec', style: 'margin: 6px 0 0; font-size: 12.5px;' }, 'Probing system requirements…');

  const prereqCard = h('div', { class: 'card' },
    h('div', { class: 'row', style: 'justify-content: space-between; margin-bottom: 8px;' },
      h('div', { class: 'row', style: 'gap: 8px;' },
        icon('box', { size: 16 }),
        h('b', { style: 'font-size: 14px;' }, 'Prerequisites & Environment Status')
      ),
      h('div', { class: 'row', style: 'gap: 8px;' },
        prereqPill,
        h('button', {
          class: 'btn sm',
          onClick: () => verifyPrerequisites()
        }, icon('refresh', { size: 11 }), ' Re-check')
      )
    ),
    prereqMsg,
    h('div', { class: 'grid cols2', style: 'margin-top: 14px; gap: 14px;' },
      // Left box: Docker instructions
      h('div', { style: 'background: var(--bg-canvas); border: 1px solid var(--border-subtle); border-radius: var(--radius); padding: 12px;' },
        h('div', { class: 'row', style: 'margin-bottom: 6px;' },
          h('b', { style: 'font-size: 13px;' }, '1. Docker Desktop Requirement'),
          ext('https://www.docker.com/products/docker-desktop/', '(Download Docker)', { style: 'font-size: 11.5px; color: var(--accent-contrast); text-decoration: underline;' })
        ),
        h('p', { class: 'muted', style: 'font-size: 12px; margin: 0 0 8px;' },
          'Gosom is written in Golang and requires Docker Desktop or an existing Go binary to execute headlessly on Windows/Mac/Linux.'
        ),
        h('ul', { style: 'margin: 0; padding-left: 18px; font-size: 12px; color: var(--text-secondary); line-height: 1.55;' },
          h('li', {}, 'Ensure Docker Desktop is started and whale icon shows "Engine running".'),
          h('li', {}, 'Virtualization (WSL 2 on Windows) must be enabled in BIOS / Windows Features.'),
          h('li', {}, 'WishScout pulls official image ', h('code', {}, 'gosom/google-maps-scraper'), ' on demand.')
        )
      ),
      // Right box: Native vs Gosom Comparison
      h('div', { style: 'background: var(--bg-canvas); border: 1px solid var(--border-subtle); border-radius: var(--radius); padding: 12px;' },
        h('b', { style: 'font-size: 13px; display: block; margin-bottom: 6px;' }, '2. Native vs Gosom Engine Comparison'),
        h('div', { style: 'display: flex; flex-direction: column; gap: 6px; font-size: 12px;' },
          h('div', { class: 'row', style: 'gap: 6px;' },
            h('span', { class: 'engine-feature-tag' }, 'WishScout Native'),
            h('span', { class: 'sec' }, 'Zero setup, Edge/Chrome, CEO/Owner name extraction, Bing/Yelp/YP.')
          ),
          h('div', { class: 'row', style: 'gap: 6px;' },
            h('span', { class: 'engine-feature-tag', style: 'border: 1px solid var(--border-strong); color: var(--text-primary);' }, 'Gosom Engine'),
            h('span', { class: 'sec' }, 'Ultra-speed bulk (~120 places/min), reviews text, hourly traffic curve.')
          )
        )
      )
    )
  );

  // Form Card
  const txtQueries = h('textarea', {
    class: 'input',
    rows: 4,
    placeholder: 'Enter one query per line, e.g.:\ndentists in Berlin\nfitness gyms in Munich\nplumbers in Austin, TX',
    value: G.form.queries,
    onInput: e => { G.form.queries = e.target.value; updateCmdPreview(); }
  });

  const inpDepth = h('input', {
    class: 'input',
    type: 'number',
    min: 1,
    max: 100,
    value: G.form.depth,
    onInput: e => { G.form.depth = Number(e.target.value) || 10; updateCmdPreview(); }
  });

  const inpConcurrency = h('input', {
    class: 'input',
    type: 'number',
    min: 1,
    max: 32,
    value: G.form.concurrency,
    onInput: e => { G.form.concurrency = Number(e.target.value) || 4; updateCmdPreview(); }
  });

  const inpLang = h('input', {
    class: 'input',
    type: 'text',
    value: G.form.lang,
    placeholder: 'en, de, es, hi...',
    onInput: e => { G.form.lang = e.target.value || 'en'; updateCmdPreview(); }
  });

  const chkEmail = h('input', {
    type: 'checkbox',
    checked: G.form.email,
    onChange: e => { G.form.email = e.target.checked; updateCmdPreview(); }
  });

  const chkFastMode = h('input', {
    type: 'checkbox',
    checked: G.form.fastMode,
    onChange: e => { G.form.fastMode = e.target.checked; updateCmdPreview(); }
  });

  const chkExtraReviews = h('input', {
    type: 'checkbox',
    checked: G.form.extraReviews,
    onChange: e => { G.form.extraReviews = e.target.checked; updateCmdPreview(); }
  });

  const inpGeo = h('input', {
    class: 'input',
    type: 'text',
    placeholder: 'lat,lon (e.g. 52.5200,13.4050)',
    value: G.form.geoCoordinates,
    onInput: e => { G.form.geoCoordinates = e.target.value; updateCmdPreview(); }
  });

  const inpZoom = h('input', {
    class: 'input',
    type: 'number',
    min: 0,
    max: 21,
    value: G.form.zoom,
    onInput: e => { G.form.zoom = Number(e.target.value) || 14; updateCmdPreview(); }
  });

  const inpGridBBox = h('input', {
    class: 'input',
    type: 'text',
    placeholder: 'minLat,minLon,maxLat,maxLon (e.g. 52.4,13.3,52.6,13.5)',
    value: G.form.gridBBox,
    onInput: e => { G.form.gridBBox = e.target.value; updateCmdPreview(); }
  });

  const inpGridCellKm = h('input', {
    class: 'input',
    type: 'number',
    step: '0.1',
    value: G.form.gridCellKm,
    onInput: e => { G.form.gridCellKm = Number(e.target.value) || 1.0; updateCmdPreview(); }
  });

  const txtProxies = h('textarea', {
    class: 'input',
    rows: 2,
    placeholder: 'http://user:pass@host:port (one per line)',
    value: G.form.proxies,
    onInput: e => { G.form.proxies = e.target.value; }
  });

  const cmdPreview = h('div', { class: 'cmd-preview-box' }, '');

  function updateCmdPreview() {
    const cmds = buildCommandStrings();
    cmdPreview.textContent = cmds.docker;
  }
  updateCmdPreview();

  // Action Buttons
  const btnLaunch = h('button', {
    class: 'btn primary',
    type: 'button',
    onClick: async () => {
      const qLines = String(G.form.queries || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      if (!qLines.length) return toast('Please enter at least one target search query');

      if (!G.prereq.running) {
        toast('Docker engine is not active. Please start Docker Desktop or copy command below.');
        return;
      }

      try {
        btnLaunch.disabled = true;
        btnStop.disabled = false;
        G.status = 'running';
        updateCountersUi();
        addLog('INFO', `Starting Gosom crawl job with ${qLines.length} queries via Docker…`);
        await call(CH.GOSOM_START, G.form);
      } catch (err) {
        btnLaunch.disabled = false;
        btnStop.disabled = true;
        G.status = 'idle';
        updateCountersUi();
        toast(String(err?.message || err));
      }
    }
  }, icon('play', { size: 14 }), ' Launch via Docker');

  const btnStop = h('button', {
    class: 'btn danger',
    type: 'button',
    disabled: true,
    onClick: async () => {
      try {
        addLog('INFO', 'Sending stop signal to Gosom container…');
        await call(CH.GOSOM_STOP);
        btnLaunch.disabled = false;
        btnStop.disabled = true;
        G.status = 'idle';
        updateCountersUi();
      } catch (err) {
        toast(String(err?.message || err));
      }
    }
  }, icon('pause', { size: 14 }), ' Stop Crawl');

  const btnCopyDocker = h('button', {
    class: 'btn',
    type: 'button',
    onClick: () => {
      const cmds = buildCommandStrings();
      copy(cmds.docker);
    }
  }, icon('copy', { size: 13 }), ' Copy Docker Command');

  const btnCopyCli = h('button', {
    class: 'btn',
    type: 'button',
    onClick: () => {
      const cmds = buildCommandStrings();
      copy(cmds.cli);
    }
  }, icon('copy', { size: 13 }), ' Copy CLI Command');

  const btnImport = h('button', {
    class: 'btn',
    type: 'button',
    onClick: async () => {
      try {
        const res = await call(CH.GOSOM_IMPORT);
        if (res?.canceled) return;
        toast(`Imported ${res.total} records (${res.added} added, ${res.enriched} enriched)`);
        addLog('INFO', `Successfully imported ${res.filename}: ${res.added} new leads in CRM.`);
      } catch (err) {
        toast('Import failed: ' + (err?.message || err));
      }
    }
  }, icon('upload', { size: 13 }), ' Import Gosom Results (.json / .csv)');

  const queryToolbar = h('div', { class: 'row', style: 'justify-content: space-between; margin-bottom: 8px; align-items: center;' },
    h('div', { class: 'row', style: 'gap: 8px;' },
      h('button', {
        class: 'btn sm primary',
        type: 'button',
        title: 'Generate combinations of niches and areas',
        onClick: () => openMatrixModal(queries => {
          G.form.queries = queries.join('\n');
          txtQueries.value = G.form.queries;
          updateCmdPreview();
        })
      }, icon('zap', { size: 12 }), ' Matrix Generator (Niche × Area)'),
      h('button', {
        class: 'btn sm',
        type: 'button',
        title: 'Choose pre-built industry packages',
        onClick: () => openPresetModal(queries => {
          G.form.queries = queries.join('\n');
          txtQueries.value = G.form.queries;
          updateCmdPreview();
        })
      }, icon('box', { size: 12 }), ' Industry Preset Packs')
    ),
    h('div', { class: 'row', style: 'gap: 6px;' },
      h('button', {
        class: 'btn sm',
        type: 'button',
        onClick: () => {
          txtQueries.value = '';
          G.form.queries = '';
          updateCmdPreview();
        }
      }, 'Clear')
    )
  );

  const formCard = h('div', { class: 'card' },
    h('b', { style: 'font-size: 14px; display: block; margin-bottom: 12px;' }, 'Scraper Configuration & Parameters'),
    queryToolbar,
    field('Target Search Queries (one per line)', txtQueries),
    h('div', { class: 'grid cols4', style: 'margin-top: 12px;' },
      field('Scroll Depth (-depth)', inpDepth),
      field('Concurrency Workers (-c)', inpConcurrency),
      field('Language Code (-lang)', inpLang),
      field('Output Format', h('select', { class: 'input', disabled: true }, h('option', {}, 'JSON (Structured)')))
    ),
    // Advanced Collapsible Details
    h('details', { style: 'margin-top: 14px;' },
      h('summary', { style: 'font-weight: 600; font-size: 12.5px; margin-bottom: 10px;' }, 'Advanced Engine Parameters (Coordinates, Grid Bounding Box, Fast-Mode, Reviews, Proxies)'),
      h('div', { class: 'grid cols2', style: 'margin-top: 10px; gap: 12px;' },
        field('Center Coordinates (-geo: required for fast-mode)', inpGeo),
        field('Map Zoom Level (-zoom: 0-21)', inpZoom)
      ),
      h('div', { class: 'grid cols2', style: 'margin-top: 10px; gap: 12px;' },
        field('Bounding Box Grid (-grid-bbox: minLat,minLon,maxLat,maxLon)', inpGridBBox),
        field('Grid Cell Size Km (-grid-cell: use with -grid-bbox)', inpGridCellKm)
      ),
      h('div', { class: 'row', style: 'margin-top: 12px; gap: 18px;' },
        h('label', { class: 'chk' }, chkFastMode, h('span', {}, 'Fast-Mode (Direct HTTP requests; requires -geo coordinates)')),
        h('label', { class: 'chk' }, chkEmail, h('span', {}, 'Extract Emails (-email: visit websites)')),
        h('label', { class: 'chk' }, chkExtraReviews, h('span', {}, 'Scrape User Reviews (-extra-reviews)'))
      ),
      h('div', { style: 'margin-top: 12px;' },
        field('Proxy Pool (-proxies: http://user:pass@host:port or socks5://)', txtProxies)
      )
    ),
    h('div', { style: 'margin-top: 14px;' },
      h('span', { class: 'sec', style: 'font-size: 11.5px; display: block; margin-bottom: 4px;' }, 'Generated Docker Command Preview:'),
      cmdPreview
    ),
    h('div', { class: 'row', style: 'margin-top: 16px; justify-content: space-between;' },
      h('div', { class: 'row', style: 'gap: 8px;' },
        btnLaunch,
        btnStop
      ),
      h('div', { class: 'row', style: 'gap: 8px;' },
        btnCopyDocker,
        btnCopyCli,
        btnImport
      )
    )
  );

  // Statistics & Live Terminal Console Card
  const statFound = h('b', {}, '0');
  const statAdded = h('b', {}, '0');
  const statDup = h('b', {}, '0');
  const statStatus = h('b', {}, 'Idle');

  // Live Progress & Query Breakdown
  const progressText = h('span', { class: 'gosom-progress-label' }, 'Engine Idle');
  const progressEta = h('span', { class: 'gosom-eta-label' }, '');
  const progressFill = h('div', { class: 'gosom-progress-fill', style: 'width: 0%;' });
  const progressTrack = h('div', { class: 'gosom-progress-track' }, progressFill);

  const pillCompleted = h('span', { class: 'pill ok', style: 'display: none;' }, 'Completed: 0');
  const pillZero = h('span', { class: 'pill warn', style: 'display: none;' }, 'Zero Results: 0');
  const pillFailed = h('span', { class: 'pill danger', style: 'display: none;' }, 'Blocked/Failed: 0');

  const btnRetryFailed = h('button', {
    class: 'btn sm danger',
    style: 'display: none;',
    type: 'button',
    onClick: () => {
      const targets = G.failedQueries.length ? G.failedQueries : G.form.queries.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      if (!targets.length) return toast('No failed queries to retry');
      G.form.queries = targets.join('\n');
      txtQueries.value = G.form.queries;
      updateCmdPreview();
      toast(`Loaded ${targets.length} failed/zero-result queries. Starting retry…`);
      btnLaunch.click();
    }
  }, icon('refresh', { size: 12 }), ' 1-Click Retry Failed Queries');

  function updateProgressUi() {
    if (G.status === 'running') {
      const idx = G.progress.currentQueryIndex || 1;
      const tot = G.progress.totalQueries || 1;
      const pct = G.progress.percent || Math.round((idx / tot) * 100);
      const q = G.progress.currentQuery ? ` — "${G.progress.currentQuery}"` : '';
      progressText.textContent = `Query ${idx} of ${tot} (${pct}%)${q}`;
      progressEta.textContent = G.progress.etaSeconds > 0
        ? `Est. Time Left: ~${Math.max(1, Math.ceil(G.progress.etaSeconds / 60))} min`
        : 'Crawling in progress…';
      progressFill.style.width = `${Math.min(100, pct)}%`;
      progressTrack.classList.add('active');
    } else if (G.queryStats.total > 0) {
      progressText.textContent = `Completed ${G.queryStats.completed} of ${G.queryStats.total} queries`;
      progressEta.textContent = 'Finished';
      progressFill.style.width = '100%';
      progressTrack.classList.remove('active');
    } else {
      progressText.textContent = 'Engine Idle — Ready to crawl';
      progressEta.textContent = '';
      progressFill.style.width = '0%';
      progressTrack.classList.remove('active');
    }

    if (G.queryStats.total > 0) {
      pillCompleted.style.display = 'inline-flex';
      pillCompleted.textContent = `Completed: ${G.queryStats.completed}`;
      pillZero.style.display = G.queryStats.zeroResults > 0 ? 'inline-flex' : 'none';
      pillZero.textContent = `Zero Results: ${G.queryStats.zeroResults}`;
      pillFailed.style.display = G.queryStats.failed > 0 ? 'inline-flex' : 'none';
      pillFailed.textContent = `Blocked/Failed: ${G.queryStats.failed}`;

      const needRetry = G.queryStats.failed > 0 || G.queryStats.zeroResults > 0;
      btnRetryFailed.style.display = needRetry ? 'inline-flex' : 'none';
      if (needRetry) {
        const count = G.queryStats.failed + G.queryStats.zeroResults;
        btnRetryFailed.replaceChildren(icon('refresh', { size: 12 }), ` Retry Queries (${count})`);
      }
    } else {
      pillCompleted.style.display = 'none';
      pillZero.style.display = 'none';
      pillFailed.style.display = 'none';
      btnRetryFailed.style.display = 'none';
    }
  }

  const progressCard = h('div', { class: 'gosom-progress-box', style: 'margin-bottom: 14px;' },
    h('div', { class: 'row', style: 'justify-content: space-between; margin-bottom: 6px; font-size: 12px; align-items: center;' },
      progressText,
      progressEta
    ),
    progressTrack,
    h('div', { class: 'row', style: 'margin-top: 8px; justify-content: space-between; align-items: center;' },
      h('div', { class: 'row', style: 'gap: 6px;' }, pillCompleted, pillZero, pillFailed),
      btnRetryFailed
    )
  );

  const statCard = h('div', { class: 'card' },
    h('div', { class: 'grid cols4', style: 'margin-bottom: 14px;' },
      h('div', { class: 'stat' }, statFound, h('span', {}, 'Discovered Places')),
      h('div', { class: 'stat' }, statAdded, h('span', {}, 'Added to Pipeline')),
      h('div', { class: 'stat' }, statDup, h('span', {}, 'Duplicates / Enriched')),
      h('div', { class: 'stat' }, statStatus, h('span', {}, 'Engine State'))
    ),
    progressCard,
    h('div', { class: 'row', style: 'justify-content: space-between; margin-bottom: 6px;' },
      h('b', { style: 'font-size: 13px;' }, 'Live Gosom Terminal Console'),
      h('div', { class: 'row', style: 'gap: 8px;' },
        h('button', {
          class: 'btn sm',
          onClick: () => {
            G.logs = [];
            if (consoleEl) consoleEl.innerHTML = '';
          }
        }, 'Clear Logs'),
        h('button', {
          class: 'btn sm primary',
          onClick: () => {
            if (typeof window.navigateTo === 'function') window.navigateTo('pipeline');
          }
        }, icon('layers', { size: 12 }), ' View in Pipeline CRM')
      )
    )
  );

  const consoleEl = h('div', { class: 'console', style: 'height: 280px;' });
  statCard.append(consoleEl);

  container.append(header, prereqCard, formCard, statCard);

  G.ui = {
    prereqPill,
    prereqMsg,
    statFound,
    statAdded,
    statDup,
    statStatus,
    console: consoleEl,
    btnLaunch,
    btnStop,
    updateProgressUi
  };

  // Re-populate existing logs
  for (const l of G.logs) appendConsole(l);
  updateCountersUi();

  // Listen to IPC events
  G.cleanupEvent = api.on(CH.GOSOM_EVENT, data => {
    if (data.counters) {
      G.counters = { ...G.counters, ...data.counters };
      updateCountersUi();
    }
    if (data.type === 'log') {
      addLog(data.level, data.msg);
    } else if (data.type === 'state') {
      G.status = data.state;
      if (data.counters) G.counters = data.counters;
      btnLaunch.disabled = G.status === 'running';
      btnStop.disabled = G.status !== 'running';
      updateCountersUi();
      updateProgressUi();
    } else if (data.type === 'progress') {
      if (data.progress) {
        G.progress = data.progress;
        updateProgressUi();
      }
    } else if (data.type === 'lead' || data.type === 'lead_updated') {
      updateCountersUi();
    } else if (data.type === 'done') {
      G.status = 'idle';
      btnLaunch.disabled = false;
      btnStop.disabled = true;
      updateCountersUi();
      if (data.queryStats) G.queryStats = data.queryStats;
      if (data.failedQueries) G.failedQueries = data.failedQueries;
      else if (data.queryStats?.failed > 0 || data.queryStats?.zeroResults > 0) {
        G.failedQueries = G.form.queries.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      }
      updateProgressUi();
      if (data.aborted) {
        toast('Gosom crawl stopped');
      } else {
        toast(`Gosom crawl finished! ${data.total || G.counters.added} records ingested into CRM`);
      }
    }
  });

  // Verify Docker status and sync running state
  verifyPrerequisites();
  updateProgressUi();
  call(CH.GOSOM_STATE).then(snap => {
    if (snap) {
      G.status = snap.state || 'idle';
      if (snap.counters) G.counters = snap.counters;
      btnLaunch.disabled = G.status === 'running';
      btnStop.disabled = G.status !== 'running';
      updateCountersUi();
      updateProgressUi();
    }
  }).catch(() => {});

  return () => {
    G.cleanupEvent?.();
    G.cleanupEvent = null;
    G.ui = null;
  };
}
