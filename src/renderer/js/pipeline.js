/**
 * WishScout — Local Business Discovery & Intelligence
 * Copyright (C) 2026 Vishwjeet Singh Vilkhu (Original Creator & Architect)
 * Licensed under the GNU GPL-3.0. See LICENSE and NOTICE; attribution must be preserved (GPL-3.0 §7).
 */
import { api, call, h, ext, toast, copy, debounce, confirmBox, field, fmtDate, icon, modal } from './util.js';
import { CH, STATUSES, ACTION_TYPES } from '../../shared/channels.js';
import { QRCode } from './qrcode.min.js';

const F = {
  search: '', status: '', category: '', sort: 'discovered_at', dir: 'desc',
  page: 1, pageSize: 25, hasEmail: false, hasOwner: false, hasSocial: false,
  websiteFilter: '', ratingFilter: '', followUpDue: false
};
const sel = new Set();
let viewMode = localStorage.getItem('ws-view-mode') || 'comfortable';
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
      const mode = localStorage.getItem('ws-whatsapp-mode') || 'web';
      const url = mode === 'desktop'
        ? `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
        : `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
      await call(CH.OPEN_EXTERNAL, { url });
      await call(CH.LOGS_ADD, {
        business_id: lead.id,
        action_type: 'WhatsApp Sent',
        notes: `WhatsApp message (${mode}): "${currentTpl.name}"`
      });
      toast(`WhatsApp opened via ${mode === 'desktop' ? 'Desktop App' : 'Web'}`);
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

export function openCallModal(lead) {
  if (!lead.phone) return toast('No phone number recorded for this business');
  const digits = String(lead.phone).replace(/\D/g, '');
  const dialPhone = (digits.length === 10 && (lead.country === 'India' || !lead.country)) ? '+91' + digits : (lead.phone.startsWith('+') ? lead.phone : '+' + digits);
  const telUrl = `tel:${dialPhone}`;

  const qrContainer = h('div', {
    class: 'qr-frame',
    style: 'background: #ffffff; padding: 12px; border-radius: 12px; width: 172px; height: 172px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 18px rgba(0,0,0,0.2); margin: 0 auto;'
  });

  setTimeout(() => {
    try {
      new QRCode(qrContainer, {
        text: telUrl,
        width: 148,
        height: 148,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
    } catch (e) {
      console.error('QR code generation error:', e);
    }
  }, 40);

  const pcCallBtn = h('button', {
    class: 'btn primary',
    style: 'width: 100%;',
    onClick: guard(async () => {
      await call(CH.OPEN_EXTERNAL, { url: telUrl });
      await call(CH.LOGS_ADD, {
        business_id: lead.id,
        action_type: 'Called on Phone',
        notes: `Placed VoIP / PC softphone call to ${dialPhone}`
      });
      toast(`Initiated call to ${dialPhone}`);
    })
  }, icon('phone', { size: 14 }), ' Call via PC Softphone / VoIP');

  const copyPhoneBtn = h('button', {
    class: 'btn',
    onClick: () => copy(dialPhone)
  }, icon('copy', { size: 13 }), ' Copy Number');

  const logCallBtn = h('button', {
    class: 'btn',
    onClick: guard(async () => {
      await call(CH.LOGS_ADD, {
        business_id: lead.id,
        action_type: 'Called on Phone',
        notes: `Phone call logged: ${dialPhone}`
      });
      toast('Call logged to timeline');
      closeModal();
    })
  }, icon('check', { size: 13 }), ' Log as Called');

  const modalBox = [
    h('div', { class: 'row', style: 'justify-content: space-between; align-items: center;' },
      h('div', { class: 'row', style: 'gap: 8px;' },
        icon('phone', { size: 16 }),
        h('h1', { style: 'font-size: 16px; margin: 0;' }, 'Direct Click-to-Call & Mobile QR Dial')
      ),
      h('button', { class: 'btn sm', onClick: () => closeModal() }, 'Close')
    ),
    h('p', { class: 'sec', style: 'font-size: 12.5px; margin: 6px 0 14px;' },
      `Contacting: ${lead.name} (${dialPhone})`
    ),
    h('div', { class: 'grid cols2', style: 'gap: 16px; align-items: center;' },
      h('div', { style: 'text-align: center;' },
        qrContainer,
        h('div', { class: 'row', style: 'justify-content: center; align-items: center; gap: 6px; margin-top: 8px;' },
          icon('camera', { size: 12 }),
          h('span', { class: 'sec', style: 'font-size: 11.5px;' }, 'Scan with phone camera to dial instantly')
        )
      ),
      h('div', { style: 'display: flex; flex-direction: column; gap: 10px;' },
        h('b', { style: 'font-size: 15px;' }, dialPhone),
        h('p', { class: 'muted', style: 'font-size: 12px; margin: 0; line-height: 1.45;' },
          'Launches Windows Phone Link, Skype, or default softphone on PC, or scan the QR code to ring straight from your mobile handset.'
        ),
        pcCallBtn,
        h('div', { class: 'row', style: 'gap: 8px;' }, copyPhoneBtn, logCallBtn)
      )
    )
  ];

  const closeModal = modal(modalBox);
}

export async function openDeduplicationModal(onMerged) {
  let duplicates = [];
  try {
    duplicates = await call(CH.LEADS_DUPLICATES);
  } catch (e) {
    return toast('Failed to check duplicates: ' + (e?.message || e));
  }

  if (!duplicates || !duplicates.length) {
    return toast('Zero duplicate candidates found. Your lead database is clean!');
  }

  let index = 0;

  function renderCurrent(closeModal) {
    if (index >= duplicates.length) {
      toast('All duplicate candidates reviewed!');
      closeModal();
      onMerged?.();
      return;
    }

    const item = duplicates[index];
    const a = item.primary;
    const b = item.secondary;

    const renderCard = (lead, isA) => h('div', {
      class: 'merge-lead-card',
      style: 'background: var(--bg-canvas); border: 1px solid var(--border-subtle); border-radius: var(--radius); padding: 12px; flex: 1;'
    },
      h('div', { class: 'row', style: 'justify-content: space-between; align-items: flex-start; margin-bottom: 8px;' },
        h('b', { style: 'font-size: 14px;' }, lead.name),
        h('span', { class: 'pill' }, isA ? 'Record A (Primary)' : 'Record B (Secondary)')
      ),
      h('div', { style: 'font-size: 12px; display: flex; flex-direction: column; gap: 4px; color: var(--text-secondary);' },
        h('div', {}, h('span', { class: 'muted' }, 'Phone: '), lead.phone || '—'),
        h('div', {}, h('span', { class: 'muted' }, 'Email: '), lead.email || '—'),
        h('div', {}, h('span', { class: 'muted' }, 'Website: '), lead.website || lead.domain || '—'),
        h('div', {}, h('span', { class: 'muted' }, 'Location: '), [lead.city, lead.state, lead.country].filter(Boolean).join(', ') || '—'),
        h('div', { class: 'row', style: 'gap: 4px; margin: 0; align-items: center;' },
          h('span', { class: 'muted' }, 'Rating: '),
          lead.rating ? [icon('star', { size: 12, fill: '#f59e0b', stroke: '#f59e0b' }), ` ${lead.rating} (${lead.review_count || 0})`] : '—'
        ),
        h('div', {}, h('span', { class: 'muted' }, 'Category: '), lead.category || '—'),
        h('div', {}, h('span', { class: 'muted' }, 'Discovered: '), fmtDate(lead.discovered_at))
      )
    );

    const btnMergeA = h('button', {
      class: 'btn primary',
      onClick: guard(async () => {
        await call(CH.LEADS_MERGE, { primaryId: a.id, secondaryId: b.id });
        toast(`Merged Record B into Record A (${a.name})`);
        index++;
        renderCurrent(closeModal);
      })
    }, icon('merge', { size: 13 }), ` Merge into Record A`);

    const btnMergeB = h('button', {
      class: 'btn',
      onClick: guard(async () => {
        await call(CH.LEADS_MERGE, { primaryId: b.id, secondaryId: a.id });
        toast(`Merged Record A into Record B (${b.name})`);
        index++;
        renderCurrent(closeModal);
      })
    }, icon('merge', { size: 13 }), ` Merge into Record B`);

    const btnSkip = h('button', {
      class: 'btn',
      onClick: () => {
        index++;
        renderCurrent(closeModal);
      }
    }, 'Keep Separate');

    contentBox.replaceChildren(
      h('div', { class: 'row', style: 'justify-content: space-between; align-items: center;' },
        h('div', { class: 'row', style: 'gap: 8px;' },
          icon('merge', { size: 16 }),
          h('h1', { style: 'font-size: 16px; margin: 0;' }, `Duplicate Review Assistant (${index + 1} of ${duplicates.length})`)
        ),
        h('button', { class: 'btn sm', onClick: () => { closeModal(); onMerged?.(); } }, 'Close')
      ),
      h('p', { class: 'sec', style: 'font-size: 12.5px; margin: 6px 0 14px;' },
        `Matched via: `, h('b', {}, item.matchedOn.toUpperCase()), ` = `, h('code', {}, item.matchValue),
        `. Non-destructive merge preserves contacts, ratings, tags, and combines activity logs.`
      ),
      h('div', { class: 'grid cols2', style: 'gap: 14px; margin-bottom: 16px;' },
        renderCard(a, true),
        renderCard(b, false)
      ),
      h('div', { class: 'row', style: 'justify-content: space-between; align-items: center;' },
        btnSkip,
        h('div', { class: 'row', style: 'gap: 8px;' },
          btnMergeB,
          btnMergeA
        )
      )
    );
  }

  const contentBox = h('div', {});
  const closeModal = modal([contentBox]);
  renderCurrent(closeModal);
}

export function openPdfBrandingModal({ onExport }) {
  const savedAgency = localStorage.getItem('ws-pdf-agency') || 'WishScout Intelligence';
  const savedTitle = localStorage.getItem('ws-pdf-title') || 'Local Business Discovery & Lead Dossier';
  const savedSubtitle = localStorage.getItem('ws-pdf-subtitle') || 'Confidential Market Analysis & Growth Opportunities';
  const savedColor = localStorage.getItem('ws-pdf-color') || '#4f46e5';
  const savedThumbs = localStorage.getItem('ws-pdf-thumbs') !== 'false';

  const inpAgency = h('input', { class: 'input', value: savedAgency, placeholder: 'e.g. Acme Growth Agency' });
  const inpTitle = h('input', { class: 'input', value: savedTitle, placeholder: 'e.g. Market Expansion Dossier' });
  const inpSubtitle = h('input', { class: 'input', value: savedSubtitle, placeholder: 'e.g. Prepared for Client Pitch' });
  const inpColor = h('input', { type: 'color', class: 'input', value: savedColor, style: 'width: 44px; height: 36px; padding: 2px; cursor: pointer;' });
  const chkThumbs = h('input', { type: 'checkbox', checked: savedThumbs });

  const COLOR_PRESETS = [
    { label: 'Indigo', val: '#4f46e5' },
    { label: 'Emerald', val: '#059669' },
    { label: 'Sapphire', val: '#2563eb' },
    { label: 'Rose', val: '#e11d48' },
    { label: 'Amber', val: '#d97706' }
  ];

  const presetSwatches = h('div', { class: 'row', style: 'gap: 6px; align-items: center;' },
    COLOR_PRESETS.map(p => h('button', {
      type: 'button',
      class: 'btn sm',
      style: `background: ${p.val}; color: #fff; border: none; padding: 4px 8px; font-size: 11px;`,
      onClick: () => { inpColor.value = p.val; }
    }, p.label))
  );

  const btnExportBranded = h('button', {
    class: 'btn primary',
    onClick: guard(async () => {
      const branding = {
        agencyName: inpAgency.value.trim() || 'WishScout Intelligence',
        reportTitle: inpTitle.value.trim() || 'Local Business Discovery & Lead Dossier',
        clientSubtitle: inpSubtitle.value.trim(),
        accentColor: inpColor.value || '#4f46e5',
        includeThumbnails: chkThumbs.checked
      };
      localStorage.setItem('ws-pdf-agency', branding.agencyName);
      localStorage.setItem('ws-pdf-title', branding.reportTitle);
      localStorage.setItem('ws-pdf-subtitle', branding.clientSubtitle);
      localStorage.setItem('ws-pdf-color', branding.accentColor);
      localStorage.setItem('ws-pdf-thumbs', String(branding.includeThumbnails));

      closeModal();
      await onExport(branding);
    })
  }, icon('download', { size: 14 }), ' Generate Branded PDF');

  const btnExportDefault = h('button', {
    class: 'btn',
    onClick: guard(async () => {
      closeModal();
      await onExport(null);
    })
  }, 'Quick Default Export');

  const modalBox = [
    h('div', { class: 'row', style: 'justify-content: space-between; align-items: center;' },
      h('div', { class: 'row', style: 'gap: 8px;' },
        icon('download', { size: 16 }),
        h('h1', { style: 'font-size: 16px; margin: 0;' }, 'White-Label Branded PDF Dossier')
      ),
      h('button', { class: 'btn sm', onClick: () => closeModal() }, 'Close')
    ),
    h('p', { class: 'sec', style: 'font-size: 12.5px; margin: 6px 0 14px;' },
      'Customize your company name, report title, and brand accent colors before exporting a proposal-ready lead roster.'
    ),
    h('div', { class: 'grid cols2', style: 'gap: 12px;' },
      field('Agency / Company Name', inpAgency),
      field('Proposal / Report Title', inpTitle)
    ),
    h('div', { style: 'margin-top: 10px;' },
      field('Client Name or Subtitle (Optional)', inpSubtitle)
    ),
    h('div', { class: 'row', style: 'margin-top: 12px; gap: 14px; align-items: center;' },
      field('Brand Accent Color', h('div', { class: 'row', style: 'gap: 8px; align-items: center;' }, inpColor, presetSwatches))
    ),
    h('div', { style: 'margin-top: 12px;' },
      h('label', { class: 'chk' }, chkThumbs, h('span', {}, 'Include Business Photo Thumbnails in report'))
    ),
    h('div', { class: 'row', style: 'justify-content: flex-end; gap: 8px; margin-top: 18px;' },
      btnExportDefault,
      btnExportBranded
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
  if (viewMode === 'compact') F.pageSize = 50;
  const tbody = h('tbody'), pager = h('div', { class: 'pager' }), bulk = h('div');
  const table = h('table', { class: 'data ' + viewMode });
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
            r.thumbnail ? h('img', {
              src: r.thumbnail,
              class: 'lead-thumb-mini',
              alt: '',
              loading: 'lazy',
              referrerPolicy: 'no-referrer',
              onError: e => { e.target.style.display = 'none'; }
            }) : null,
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
            h('button', {
              class: 'btn-phone-dial',
              type: 'button',
              title: 'Click to Call via PC VoIP or Scan Smartphone QR',
              onClick: () => openCallModal(r)
            }, icon('phone', { size: 11 }), ' ' + r.phone),
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
  const unlistenGosom = api.on(CH.GOSOM_EVENT, evt => {
    if (evt.type === 'lead' || evt.type === 'lead_updated' || evt.type === 'done') liveRefresh();
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
      h('button', {
        class: 'btn sm',
        title: 'Detect and resolve duplicate business listings',
        onClick: () => openDeduplicationModal(refresh)
      }, icon('merge', { size: 12 }), ' Deduplication Assistant'),
      h('button', { class: 'btn sm', onClick: () => doExport(CH.EXPORT_CSV) }, 'Export CSV'),
      h('button', { class: 'btn sm', onClick: () => doExport(CH.EXPORT_JSON) }, 'JSON'),
      h('button', {
        class: 'btn sm primary',
        title: 'Generate White-Label Branded Client Proposal PDF',
        onClick: () => openPdfBrandingModal({
          onExport: branding => doExport(CH.EXPORT_PDF, { filters: F, branding })
        })
      }, icon('download', { size: 12 }), ' PDF Dossier')
    ));

  const viewModeSeg = h('div', { class: 'segmented-control' },
    h('button', {
      type: 'button',
      class: 'seg-btn' + (viewMode === 'compact' ? ' active' : ''),
      title: 'Compact Mode: 50 rows at a glance for laptops',
      onClick: () => {
        viewMode = 'compact';
        localStorage.setItem('ws-view-mode', 'compact');
        viewModeSeg.children[0].classList.add('active');
        viewModeSeg.children[1].classList.remove('active');
        table.className = 'data compact';
        F.pageSize = 50;
        F.page = 1;
        refresh();
      }
    }, icon('list', { size: 12 }), ' Compact (50)'),
    h('button', {
      type: 'button',
      class: 'seg-btn' + (viewMode === 'comfortable' ? ' active' : ''),
      title: 'Comfortable Mode: High visual clarity with big photos & category tags',
      onClick: () => {
        viewMode = 'comfortable';
        localStorage.setItem('ws-view-mode', 'comfortable');
        viewModeSeg.children[0].classList.remove('active');
        viewModeSeg.children[1].classList.add('active');
        table.className = 'data comfortable';
        F.pageSize = 25;
        F.page = 1;
        refresh();
      }
    }, icon('layers', { size: 12 }), ' Comfortable')
  );

  const toolbar = h('div', { class: 'toolbar' },
    h('input', { class: 'input search', type: 'search', placeholder: 'Search name, domain, city, phone…', value: F.search, 'aria-label': 'Search leads', onInput: debounce(e => { F.search = e.target.value.trim(); F.page = 1; refresh(); }, 250) }),
    h('select', { class: 'input', 'aria-label': 'Status filter', onChange: e => { F.status = e.target.value; F.page = 1; refresh(); } }, h('option', { value: '' }, 'All statuses'), STATUSES.map(s => h('option', { selected: s === F.status }, s))),
    catSel,
    webFilterSel,
    rateFilterSel,
    h('select', { class: 'input', 'aria-label': 'Sort by', onChange: e => { F.sort = e.target.value; F.dir = e.target.value === 'name' ? 'asc' : 'desc'; refresh(); } },
      [['discovered_at', 'Date added'], ['name', 'Name (A–Z)'], ['rating', 'Rating'], ['review_count', 'Review count']].map(([v, l]) => h('option', { value: v, selected: v === F.sort }, l))),
    chk('Has email', 'hasEmail'), chk('Has owner', 'hasOwner'), chk('Has social', 'hasSocial'), chk('Due follow-ups', 'followUpDue'),
    viewModeSeg
  );

  const tableWrap = h('div', { class: 'table-wrap' }, table);
  const pipelinePage = h('div', { class: 'pipeline-page' }, header, toolbar, bulk, tableWrap, pager);
  root.replaceChildren(pipelinePage);
  refresh();
  return () => { unlisten?.(); unlistenGosom?.(); };
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

    // Multi-Channel Outreach Status Checklist
    const CHANNELS = [
      { key: 'wa', label: 'WhatsApp Sent', iconName: 'whatsapp', logType: 'WhatsApp Sent' },
      { key: 'email', label: 'Email Sent', iconName: 'mail', logType: 'Email Sent' },
      { key: 'call', label: 'Called on Phone', iconName: 'phone', logType: 'Called on Phone' },
      { key: 'dm', label: 'Instagram DM', iconName: 'instagram', logType: 'Social DM' }
    ];

    const currentTags = (lead.tags || '').split(',').map(s => s.trim());
    const hasAction = action => logs.some(l => l.action_type === action);

    let completedCount = 0;
    CHANNELS.forEach(c => {
      if (currentTags.includes(c.label) || hasAction(c.logType)) completedCount++;
    });

    const checklistSection = h('section', {},
      h('div', { class: 'row', style: 'justify-content: space-between; align-items: center; margin-bottom: 8px;' },
        h('h2', { style: 'margin: 0;' }, 'Multi-Channel Outreach Checklist'),
        h('span', { class: 'pill ' + (completedCount === 4 ? 'ok' : 'info') }, `${completedCount} of 4 Contacted (${completedCount * 25}%)`)
      ),
      h('div', { class: 'grid cols2', style: 'gap: 8px; margin-top: 8px;' },
        CHANNELS.map(c => {
          const isDone = currentTags.includes(c.label) || hasAction(c.logType);
          const chkBox = h('input', {
            type: 'checkbox',
            checked: isDone,
            onChange: guard(async e => {
              let tags = (lead.tags || '').split(',').map(s => s.trim()).filter(Boolean);
              if (e.target.checked) {
                if (!tags.includes(c.label)) tags.push(c.label);
                await call(CH.LOGS_ADD, {
                  business_id: id,
                  action_type: c.logType,
                  notes: `Outreach completed via ${c.label}`
                });
              } else {
                tags = tags.filter(t => t !== c.label);
              }
              const updatedTags = tags.join(', ');
              const fresh = await call(CH.LEADS_FIELDS, { id, fields: { tags: updatedTags } });
              lead.tags = updatedTags;
              render(fresh);
              toast(`${c.label} marked as ${e.target.checked ? 'completed' : 'pending'}`);
            })
          });
          return h('label', {
            class: `chk-card ${isDone ? 'done' : ''}`,
            style: 'display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--bg-canvas); border: 1px solid var(--border-subtle); border-radius: var(--radius); cursor: pointer;'
          },
            chkBox,
            icon(c.iconName, { size: 13 }),
            h('span', { style: 'font-size: 12.5px; font-weight: 500;' }, c.label)
          );
        })
      )
    );

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

      checklistSection,

      h('section', {},
        h('h2', {}, 'Direct outreach & action'),
        h('div', { class: 'row', style: 'gap: 8px; flex-wrap: wrap;' },
          lead.phone ? h('button', { class: 'btn', onClick: () => openCallModal(lead) }, icon('phone', { size: 13 }), ` Call ${lead.phone} (VoIP / QR)`) : null,
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
