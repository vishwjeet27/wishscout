/**
 * WishScout — Local Business Discovery & Intelligence
 * Copyright (C) 2026 Vishwjeet Singh Vilkhu (Original Creator & Architect)
 * Licensed under the GNU GPL-3.0. See LICENSE and NOTICE; attribution must be preserved (GPL-3.0 §7).
 */
import { api, call, h, ext, toast, copy, debounce, confirmBox, field, fmtDate, icon, modal } from './util.js';
import { CH, STATUSES, ACTION_TYPES } from '../../shared/channels.js';

const F = {
  search: '', status: '', category: '', sort: 'discovered_at', dir: 'desc',
  page: 1, pageSize: 25, hasEmail: false, hasOwner: false, hasSocial: false,
  websiteFilter: '', ratingFilter: '', followUpDue: false
};
const sel = new Set();
let compact = false;
const errText = e => String(e.message).replace(/^Error invoking remote method '[^']+': Error: /, '');
const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { toast(errText(e)); } };
const SOCIALS = [['linkedin', 'LinkedIn'], ['twitter', 'Twitter / X'], ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['youtube', 'YouTube']];
const QUICK_TAGS = ['Hot Lead', 'High Budget', 'Call Back', 'Wrong Number', 'Proposal Sent'];

export function substituteVars(text, lead) {
  if (!text) return '';
  const category = lead.category || 'business';
  const city = lead.city || 'your area';
  const name = lead.name || 'there';
  const owner = lead.owner_name || lead.name || 'Business Owner';
  const website = lead.website || (lead.domain ? `https://${lead.domain}` : '');
  const phone = lead.phone || '';
  return text
    .replace(/\{name\}/gi, name)
    .replace(/\{city\}/gi, city)
    .replace(/\{category\}/gi, category)
    .replace(/\{owner_name\}/gi, owner)
    .replace(/\{website\}/gi, website)
    .replace(/\{phone\}/gi, phone);
}

export async function openWhatsApp(lead, onLogged) {
  if (!lead.phone) return toast('No phone number recorded for this lead');
  const digits = String(lead.phone).replace(/\D/g, '');
  if (!digits) return toast('Invalid phone number format');
  const cleanPhone = (digits.length === 10 && (lead.country === 'India' || !lead.country)) ? '91' + digits : digits;

  let templates = [];
  try {
    templates = await call(CH.TEMPLATES_GET, { channel: 'whatsapp' });
  } catch {}

  if (!templates || templates.length === 0) {
    templates = [{
      id: 'default',
      name: 'Standard Introduction',
      channel: 'whatsapp',
      body: "Hi {name},\n\nI noticed your business listing in {city} and wanted to reach out regarding our services and client acquisition.\n\nAre you available for a brief conversation this week?"
    }];
  }

  let currentTpl = templates[0];
  const tplSelect = h('select', { class: 'input', style: 'margin-bottom: 12px;' },
    templates.map((t, idx) => h('option', { value: idx }, t.name)));

  const bodyInput = h('textarea', {
    class: 'input',
    style: 'min-height: 160px; font-family: inherit; line-height: 1.5;'
  }, substituteVars(currentTpl.body, lead));

  tplSelect.addEventListener('change', () => {
    currentTpl = templates[tplSelect.value] || templates[0];
    bodyInput.value = substituteVars(currentTpl.body, lead);
  });

  const sendBtn = h('button', {
    class: 'btn primary btn-wa',
    onClick: guard(async () => {
      const text = bodyInput.value.trim();
      const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
      await call(CH.OPEN_EXTERNAL, { url });
      await call(CH.LOGS_ADD, {
        business_id: lead.id,
        action_type: 'WhatsApp Sent',
        notes: `WhatsApp message: "${currentTpl.name}"`
      });
      toast('WhatsApp opened & outreach logged');
      closeModal();
      onLogged?.();
    })
  }, icon('whatsapp', { size: 14 }), ' Send in WhatsApp');

  const copyBtn = h('button', {
    class: 'btn',
    onClick: () => copy(bodyInput.value)
  }, icon('copy', { size: 14 }), ' Copy Message');

  const logOnlyBtn = h('button', {
    class: 'btn',
    onClick: guard(async () => {
      await call(CH.LOGS_ADD, {
        business_id: lead.id,
        action_type: 'WhatsApp Sent',
        notes: `Manual WhatsApp: "${currentTpl.name}"`
      });
      toast('Outreach logged as "WhatsApp Sent"');
      closeModal();
      onLogged?.();
    })
  }, icon('check', { size: 14 }), ' Log as Sent');

  const modalBox = [
    h('div', { class: 'row', style: 'justify-content: space-between; align-items: center;' },
      h('h1', {}, `WhatsApp Outreach — ${lead.name}`),
      h('button', { class: 'btn sm', onClick: () => closeModal() }, 'Close')
    ),
    h('p', { class: 'sub' }, `Recipient: ${lead.phone} (${cleanPhone})`),
    field('Choose WhatsApp Template', tplSelect),
    field('Message Text', bodyInput),
    h('div', { class: 'actions', style: 'margin-top: 14px; gap: 8px;' },
      sendBtn, copyBtn, logOnlyBtn
    )
  ];

  const closeModal = modal(modalBox);
}

export async function openPitchComposer(lead, onLogged) {
  let templates = [];
  try {
    templates = await call(CH.TEMPLATES_GET, { channel: 'email' });
  } catch {}

  if (!templates || templates.length === 0) {
    templates = [{
      id: 'default',
      name: 'General Business Inquiry',
      channel: 'email',
      subject: "Quick inquiry regarding {name}'s online presence",
      body: "Hi {name} team,\n\nI was looking up providers in {city} and noticed your profile. Would love to connect regarding your services.\n\nBest regards,\n[Your Name]"
    }];
  }

  let currentTpl = templates[0];
  const tplSelect = h('select', { class: 'input', style: 'margin-bottom: 12px;' },
    templates.map((t, idx) => h('option', { value: idx }, t.name)));

  const subjInput = h('input', { class: 'input', value: substituteVars(currentTpl.subject || '', lead) });
  const bodyInput = h('textarea', {
    class: 'input',
    style: 'min-height: 170px; font-family: inherit; line-height: 1.5;'
  }, substituteVars(currentTpl.body || '', lead));

  tplSelect.addEventListener('change', () => {
    currentTpl = templates[tplSelect.value] || templates[0];
    subjInput.value = substituteVars(currentTpl.subject || '', lead);
    bodyInput.value = substituteVars(currentTpl.body || '', lead);
  });

  const sendMailBtn = h('button', {
    class: 'btn primary',
    onClick: guard(async () => {
      const email = lead.email || '';
      const mailto = `mailto:${email}?subject=${encodeURIComponent(subjInput.value)}&body=${encodeURIComponent(bodyInput.value)}`;
      await call(CH.OPEN_EXTERNAL, { url: mailto });
      await call(CH.LOGS_ADD, {
        business_id: lead.id,
        action_type: 'Email Sent',
        notes: `Pitch sent: "${currentTpl.name}"`
      });
      toast('Email client opened & outreach logged');
      closeModal();
      onLogged?.();
    })
  }, icon('mail', { size: 14 }), ' Open in Email Client');

  const copyBtn = h('button', {
    class: 'btn',
    onClick: () => copy(`Subject: ${subjInput.value}\n\n${bodyInput.value}`)
  }, icon('copy', { size: 14 }), ' Copy Pitch');

  const logOnlyBtn = h('button', {
    class: 'btn',
    onClick: guard(async () => {
      await call(CH.LOGS_ADD, {
        business_id: lead.id,
        action_type: 'Email Sent',
        notes: `Manual pitch: "${currentTpl.name}"`
      });
      toast('Outreach logged as "Email Sent"');
      closeModal();
      onLogged?.();
    })
  }, icon('check', { size: 14 }), ' Log as Contacted');

  const modalBox = [
    h('div', { class: 'row', style: 'justify-content: space-between; align-items: center;' },
      h('h1', {}, `Quick Cold Outreach — ${lead.name}`),
      h('button', { class: 'btn sm', onClick: () => closeModal() }, 'Close')
    ),
    h('p', { class: 'sub' }, `Target: ${lead.email ? lead.email : 'No email saved (copy pitch for contact form / DM)'}`),
    field('Choose Pitch Template', tplSelect),
    field('Email Subject', subjInput),
    field('Message Body', bodyInput),
    h('div', { class: 'actions', style: 'margin-top: 14px; gap: 8px;' },
      sendMailBtn, copyBtn, logOnlyBtn
    )
  ];

  const closeModal = modal(modalBox);
}

const statusSelect = (lead, onChange) => h('div', { class: 'status-sel' }, h('span', { class: 'dot', 'data-s': lead.status }),
  h('select', { class: 'input', 'aria-label': 'Pipeline status', onChange: guard(async e => {
    await call(CH.LEADS_STATUS, { id: lead.id, status: e.target.value }); lead.status = e.target.value; e.target.previousSibling.dataset.s = lead.status; onChange?.();
  }) }, STATUSES.map(s => h('option', { value: s, selected: s === lead.status }, s))));

export function mountPipeline(root) {
  let rows = [], total = 0;
  const tbody = h('tbody'), pager = h('div', { class: 'pager' }), bulk = h('div'), table = h('table', { class: 'data' + (compact ? ' compact' : '') });
  const catSel = h('select', { class: 'input', onChange: e => { F.category = e.target.value; F.page = 1; refresh(); } }, h('option', { value: '' }, 'All categories'));
  call(CH.LEADS_FACETS).then(f => f.categories.forEach(c => catSel.append(h('option', { value: c, selected: c === F.category }, c))));

  const th = (label, key) => h('th', key ? { class: 'sortable', onClick: () => { F.dir = F.sort === key && F.dir === 'asc' ? 'desc' : 'asc'; F.sort = key; refresh(); }, 'aria-sort': F.sort === key ? (F.dir === 'asc' ? 'ascending' : 'descending') : 'none' } : {},
    label,
    F.sort === key ? icon(F.dir === 'asc' ? 'chevron-up' : 'chevron-down', { size: 12, class: 'sort-icon' }) : null);
  const allBox = h('input', { type: 'checkbox', 'aria-label': 'Select all on page', onChange: e => { rows.forEach(r => (e.target.checked ? sel.add(r.id) : sel.delete(r.id))); renderBody(); renderBulk(); } });

  function renderHead() {
    table.querySelector('thead')?.remove();
    table.prepend(h('thead', {}, h('tr', {}, h('th', {}, allBox), th('Business', 'name'), th('Contact & Outreach'), th('Decision maker'), th('Location', 'city'),
      th('Reputation', 'rating'), th('Social'), th('Pipeline status', 'status'), th('Actions'))));
  }

  function renderBody() {
    tbody.replaceChildren();
    if (!rows.length) { tbody.append(h('tr', {}, h('td', { colSpan: 9 }, h('div', { class: 'empty' }, total === 0 && !F.search && !F.status && !F.category ? 'No leads yet. Start a discovery to fill your pipeline.' : 'No leads match these filters.')))); return; }
    const today = new Date().toISOString().slice(0, 10);
    for (const r of rows) {
      const tagList = (r.tags || '').split(',').map(s => s.trim()).filter(Boolean);
      const isDue = r.follow_up_date && r.follow_up_date <= today;

      tbody.append(h('tr', {},
        h('td', {}, h('input', { type: 'checkbox', checked: sel.has(r.id), 'aria-label': 'Select ' + r.name, onChange: e => { e.target.checked ? sel.add(r.id) : sel.delete(r.id); renderBulk(); } })),
        h('td', {},
          h('div', { class: 'row', style: 'gap: 8px; align-items: flex-start; flex-wrap: nowrap;' },
            r.thumbnail ? h('img', { src: r.thumbnail, class: 'lead-thumb-mini', alt: '' }) : null,
            h('div', {},
              h('div', { class: 'cell-name' }, r.name, r.website ? ext(r.website, icon('external', { size: 11 }), { 'aria-label': 'Open website' }) : null),
              h('div', { class: 'chips', style: 'margin-top: 4px; gap: 4px;' },
                h('span', { class: 'pill' }, r.category),
                r.price_range ? h('span', { class: 'pill price-pill' }, r.price_range) : null,
                ...tagList.map(t => h('span', { class: 'pill tag-pill' }, t)),
                isDue ? h('span', { class: 'pill danger' }, 'Due Today') : null
              )
            )
          )
        ),
        h('td', {},
          r.phone ? h('div', { class: 'row', style: 'gap: 6px; margin: 0; align-items: center;' },
            ext('tel:' + r.phone, r.phone),
            h('button', {
              class: 'btn sm btn-wa',
              title: 'Open WhatsApp Chat',
              onClick: () => openWhatsApp(r, refresh)
            }, icon('whatsapp', { size: 12 }), ' WhatsApp')
          ) : null,
          r.email ? h('div', { class: 'row', style: 'gap: 6px; margin-top: 4px; align-items: center;' },
            h('span', {}, r.email),
            h('button', {
              class: 'btn sm',
              title: 'Send Cold Outreach Pitch',
              onClick: () => openPitchComposer(r, refresh)
            }, icon('mail', { size: 11 }), ' Pitch')
          ) : h('span', { class: 'muted' }, r.phone ? '' : '—')
        ),
        h('td', {}, r.owner_name ? [h('div', {}, r.owner_name), h('div', { class: 'muted' }, r.owner_title)] : h('span', { class: 'muted' }, 'Unassigned')),
        h('td', {}, [r.city, r.state].filter(Boolean).join(', '), h('div', { class: 'muted' }, r.country)),
        h('td', {}, r.rating ? [h('span', { class: 'rating-text' }, icon('star', { size: 12, fill: '#f59e0b', stroke: '#f59e0b' }), ` ${r.rating.toFixed(1)}`), r.review_count ? h('span', { class: 'muted' }, ` (${r.review_count})`) : null] : '—'),
        h('td', {}, h('div', { class: 'chips' }, SOCIALS.filter(([k]) => r['social_' + k]).map(([k, n]) => ext(r['social_' + k], icon(k, { size: 13 }), { class: 'chip', 'aria-label': n, title: n })))),
        h('td', {}, statusSelect(r)),
        h('td', {}, h('div', { class: 'row' },
          h('button', { class: 'btn sm', onClick: () => openDrawer(r.id, refresh) }, 'Details'),
          h('button', { class: 'btn sm danger', 'aria-label': 'Delete ' + r.name, onClick: guard(async () => {
            if (await confirmBox('Delete lead?', `Remove ${r.name} and its activity log?`, 'Delete')) { await call(CH.LEADS_DELETE, { ids: [r.id] }); sel.delete(r.id); refresh(); }
          }) }, 'Delete')
        ))
      ));
    }
  }

  function renderBulk() {
    bulk.replaceChildren(); allBox.checked = rows.length > 0 && rows.every(r => sel.has(r.id));
    if (!sel.size) return;
    const st = h('select', { class: 'input' }, STATUSES.map(s => h('option', {}, s)));
    bulk.append(h('div', { class: 'bulk' }, h('b', {}, `${sel.size} selected`), st,
      h('button', { class: 'btn sm', onClick: guard(async () => { await call(CH.LEADS_BULK_STATUS, { ids: [...sel], status: st.value }); toast('Status updated'); refresh(); }) }, 'Change status'),
      h('button', { class: 'btn sm', onClick: () => doExport(CH.EXPORT_CSV, { ids: [...sel] }) }, 'Export selected (CSV)'),
      h('button', { class: 'btn sm danger', onClick: guard(async () => {
        if (await confirmBox('Delete selected?', `Permanently delete ${sel.size} leads?`, 'Delete')) { await call(CH.LEADS_DELETE, { ids: [...sel] }); sel.clear(); refresh(); }
      }) }, 'Delete selected'),
      h('button', { class: 'btn sm', onClick: () => { sel.clear(); renderBody(); renderBulk(); } }, 'Clear')));
  }

  function renderPager() {
    const pages = Math.max(1, Math.ceil(total / F.pageSize)), from = total ? (F.page - 1) * F.pageSize + 1 : 0;
    pager.replaceChildren(
      h('span', {}, `${from}–${Math.min(total, F.page * F.pageSize)} of ${total}`),
      h('select', { class: 'input', 'aria-label': 'Rows per page', onChange: e => { F.pageSize = +e.target.value; F.page = 1; refresh(); } }, [25, 50, 100].map(n => h('option', { value: n, selected: n === F.pageSize }, `${n} / page`))),
      h('button', { class: 'btn sm', disabled: F.page <= 1, onClick: () => { F.page--; refresh(); } }, 'Previous'),
      h('button', { class: 'btn sm', disabled: F.page >= pages, onClick: () => { F.page++; refresh(); } }, 'Next'));
  }

  const refresh = guard(async () => {
    const r = await call(CH.LEADS_QUERY, F); rows = r.rows; total = r.total;
    renderHead(); renderBody(); renderBulk(); renderPager();
  });

  const doExport = guard(async (ch, extra) => {
    const r = await call(ch, extra || { filters: F });
    if (!r.canceled) toast(`Exported ${r.count} lead${r.count === 1 ? '' : 's'}`);
  });

  const chk = (label, key) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: F[key], onChange: e => { F[key] = e.target.checked; F.page = 1; refresh(); } }), label);

  const liveRefresh = debounce(() => {
    if (F.page === 1 && !F.search && !F.status && !F.category) refresh();
  }, 500);

  const unlisten = api.on(CH.SCRAPE_EVENT, evt => {
    if (evt.type === 'lead' || evt.type === 'lead_updated') liveRefresh();
  });

  table.append(tbody);

  const webFilterSel = h('select', { class: 'input', 'aria-label': 'Website filter', onChange: e => { F.websiteFilter = e.target.value; F.page = 1; refresh(); } },
    [['', 'All websites'], ['has', 'With website'], ['none', 'No website']].map(([v, l]) => h('option', { value: v, selected: v === F.websiteFilter }, l)));

  const rateFilterSel = h('select', { class: 'input', 'aria-label': 'Rating filter', onChange: e => { F.ratingFilter = e.target.value; F.page = 1; refresh(); } },
    [['', 'All ratings'], ['high', '4.5+ Stars'], ['low', 'Under 4.0 Stars']].map(([v, l]) => h('option', { value: v, selected: v === F.ratingFilter }, l)));

  const header = h('div', { class: 'pipeline-header' },
    h('div', {},
      h('h1', {}, 'Pipeline'),
      h('p', { class: 'sub' }, 'Every lead discovered. Filter by website or rating, reach out via WhatsApp/Email pitch, and manage follow-ups.')),
    h('div', { class: 'row', style: 'gap: 8px;' },
      h('button', {
        class: 'btn',
        onClick: guard(async () => {
          const res = await call(CH.IMPORT_CSV);
          if (!res.canceled) {
            toast(`Imported ${res.added} new lead${res.added === 1 ? '' : 's'} (${res.duplicates} duplicates skipped)`);
            refresh();
          }
        })
      }, icon('upload', { size: 13 }), ' Import CSV'),
      h('button', { class: 'btn sm', onClick: () => doExport(CH.EXPORT_CSV) }, 'Export CSV'),
      h('button', { class: 'btn sm', onClick: () => doExport(CH.EXPORT_JSON) }, 'JSON'),
      h('button', { class: 'btn sm', onClick: () => doExport(CH.EXPORT_PDF) }, 'PDF')
    ));

  const toolbar = h('div', { class: 'toolbar' },
    h('input', { class: 'input search', type: 'search', placeholder: 'Search name, domain, city, phone…', value: F.search, 'aria-label': 'Search leads', onInput: debounce(e => { F.search = e.target.value.trim(); F.page = 1; refresh(); }, 250) }),
    h('select', { class: 'input', 'aria-label': 'Status filter', onChange: e => { F.status = e.target.value; F.page = 1; refresh(); } }, h('option', { value: '' }, 'All statuses'), STATUSES.map(s => h('option', { selected: s === F.status }, s))),
    catSel,
    webFilterSel,
    rateFilterSel,
    h('select', { class: 'input', 'aria-label': 'Sort by', onChange: e => { F.sort = e.target.value; F.dir = e.target.value === 'name' ? 'asc' : 'desc'; refresh(); } },
      [['discovered_at', 'Date added'], ['name', 'Name (A–Z)'], ['rating', 'Rating'], ['review_count', 'Review count']].map(([v, l]) => h('option', { value: v, selected: v === F.sort }, l))),
    chk('Has email', 'hasEmail'), chk('Has owner', 'hasOwner'), chk('Has social', 'hasSocial'), chk('Due follow-ups', 'followUpDue'),
    h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: compact, onChange: e => { compact = e.target.checked; table.classList.toggle('compact', compact); } }), 'Compact rows'));

  const tableWrap = h('div', { class: 'table-wrap' }, table);
  const pipelinePage = h('div', { class: 'pipeline-page' }, header, toolbar, bulk, tableWrap, pager);
  root.replaceChildren(pipelinePage);
  refresh();
  return () => { unlisten?.(); };
}

// ---------- Lead detail drawer ----------
export async function openDrawer(id, onChange) {
  const back = h('div', { class: 'drawer-backdrop' });
  const close = () => { back.remove(); onChange?.(); };
  back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  document.getElementById('modal-root').append(back);

  const render = ({ lead, logs }) => {
    if (!lead) return back.replaceChildren(h('aside', { class: 'drawer' }, h('p', {}, 'Lead not found.'), h('button', { class: 'btn', onClick: close }, 'Close')));
    const owner = h('input', { class: 'input', value: lead.owner_name || '' }), title = h('input', { class: 'input', value: lead.owner_title || '' });
    const email = h('input', { class: 'input', value: lead.email || '', type: 'email' }), notes = h('textarea', { class: 'input' }, lead.notes || '');
    notes.value = lead.notes || '';
    const act = h('select', { class: 'input' }, ACTION_TYPES.map(a => h('option', {}, a))), when = h('input', { class: 'input', type: 'date', value: lead.follow_up_date || '' }), logNote = h('textarea', { class: 'input', placeholder: 'What happened?' });
    const kv = (k, v) => (v ? [h('dt', {}, k), h('dd', {}, v)] : []);
    const today = new Date().toISOString().slice(0, 10);
    const isDue = lead.follow_up_date && lead.follow_up_date <= today;

    back.replaceChildren(h('aside', { class: 'drawer', role: 'dialog', 'aria-label': lead.name },
      lead.thumbnail ? h('div', { class: 'drawer-hero-banner', style: `background-image: url('${lead.thumbnail}')` }) : null,
      h('div', { class: 'row' },
        h('div', {},
          h('h1', {}, lead.name),
          h('div', { class: 'row', style: 'gap: 6px; margin-top: 4px; flex-wrap: wrap;' },
            lead.category ? h('span', { class: 'pill' }, lead.category) : null,
            lead.price_range ? h('span', { class: 'pill price-pill' }, lead.price_range) : null,
            lead.opening_hours ? h('span', { class: 'pill open-pill' }, [icon('clock', { size: 10 }), ` ${lead.opening_hours}`]) : null
          )
        ),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn', onClick: close }, 'Close')
      ),
      statusSelect(lead),
      h('section', {}, h('h2', {}, 'Business identity'), h('dl', { class: 'kv' },
        kv('Overview', lead.description ? h('div', { class: 'lead-desc-box' }, lead.description) : ''),
        kv('Price tier', lead.price_range),
        kv('Opening hours', lead.opening_hours ? [icon('clock', { size: 12 }), ` ${lead.opening_hours}`] : ''),
        kv('Address', [lead.address, lead.postal_code && !lead.address?.includes(lead.postal_code) ? lead.postal_code : ''].filter(Boolean).join(' ')),
        kv('Plus code', lead.plus_code ? [icon('pin', { size: 12 }), ` ${lead.plus_code}`] : ''),
        kv('Location', [lead.city, lead.state, lead.country].filter(Boolean).join(', ')), kv('Place ID', lead.place_id),
        kv('Rating', lead.rating ? [icon('star', { size: 12, fill: '#f59e0b', stroke: '#f59e0b' }), ` ${lead.rating} (${lead.review_count} reviews)`] : ''),
        kv('Discovered', fmtDate(lead.discovered_at)),
        kv('Follow-up Date', lead.follow_up_date ? [
          icon('calendar', { size: 12 }),
          ` ${lead.follow_up_date}`,
          isDue ? h('span', { class: 'pill danger', style: 'margin-left: 6px;' }, 'Due Today') : null
        ] : 'None scheduled'),
        kv('Last contacted', lead.last_contacted_at ? fmtDate(lead.last_contacted_at) : ''))),

      h('section', {},
        h('h2', {}, 'Direct outreach & action'),
        h('div', { class: 'row', style: 'gap: 8px; flex-wrap: wrap;' },
          lead.phone ? ext('tel:' + lead.phone, [icon('phone', { size: 13 }), ` Call ${lead.phone}`], { class: 'btn' }) : null,
          lead.phone ? h('button', { class: 'btn btn-wa', onClick: () => openWhatsApp(lead, () => call(CH.LEADS_GET, { id }).then(render)) }, icon('whatsapp', { size: 14 }), ' Send WhatsApp') : null,
          lead.email ? h('button', { class: 'btn', onClick: () => openPitchComposer(lead, () => call(CH.LEADS_GET, { id }).then(render)) }, icon('mail', { size: 13 }), ' Compose Email Pitch') : null,
          lead.website ? ext(lead.website, [icon('external', { size: 13 }), ' Open website'], { class: 'btn' }) : null
        )
      ),

      h('section', {},
        h('h2', {}, 'Custom tags'),
        h('div', { class: 'tag-chips-row', style: 'display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 6px;' },
          QUICK_TAGS.map(tagText => {
            const hasTag = (lead.tags || '').split(',').map(s => s.trim()).includes(tagText);
            return h('button', {
              class: `btn sm tag-btn ${hasTag ? 'active' : ''}`,
              type: 'button',
              onClick: guard(async () => {
                let current = (lead.tags || '').split(',').map(s => s.trim()).filter(Boolean);
                if (hasTag) current = current.filter(t => t !== tagText);
                else current.push(tagText);
                const updated = current.join(', ');
                const fresh = await call(CH.LEADS_FIELDS, { id, fields: { tags: updated } });
                lead.tags = updated;
                render(fresh);
                toast(`Tag ${hasTag ? 'removed' : 'added'}: ${tagText}`);
              })
            }, icon('tag', { size: 11 }), ' ' + tagText);
          })
        ),
        h('span', { class: 'muted', style: 'font-size: 11px;' }, 'Click to toggle color-coded tags on this lead.')
      ),

      h('section', {}, h('h2', {}, 'Decision maker'), h('div', { class: 'grid cols2' }, field('Name', owner), field('Title', title)), field('Email', email),
        h('div', { class: 'row', style: '' }, h('button', { class: 'btn primary', onClick: guard(async () => { render(await call(CH.LEADS_FIELDS, { id, fields: { owner_name: owner.value, owner_title: title.value, email: email.value, notes: notes.value } })); toast('Saved'); }) }, 'Save details'))),
      h('section', {}, h('h2', {}, 'Social matrix'), SOCIALS.some(([k]) => lead['social_' + k]) ? h('div', { class: 'chips' }, SOCIALS.filter(([k]) => lead['social_' + k]).map(([k, n]) => ext(lead['social_' + k], [icon(k, { size: 14 }), ' ' + n], { class: 'btn sm', 'aria-label': n, title: n }))) : h('p', { class: 'muted' }, 'No social profiles found.')),
      h('section', {}, h('h2', {}, 'Notes'), notes),
      h('section', {}, h('h2', {}, 'Activity & outreach'),
        h('div', { class: 'grid cols2' }, field('Action', act), field('Follow-up date', when)), field('Notes', logNote),
        h('div', { class: 'row', style: '' }, h('button', { class: 'btn primary', onClick: guard(async () => { render(await call(CH.LOGS_ADD, { business_id: id, action_type: act.value, notes: logNote.value, followUpDate: when.value })); toast('Logged'); }) }, 'Log activity')),
        h('ul', { class: 'timeline' }, logs.length ? logs.map(l => h('li', {}, h('b', {}, l.action_type), h('div', {}, l.notes), h('small', {}, fmtDate(l.timestamp)))) : h('li', { class: 'muted' }, 'No activity yet.')))));
  };
  try { render(await call(CH.LEADS_GET, { id })); } catch (e) { toast(errText(e)); close(); }
}
