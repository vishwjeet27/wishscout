/**
 * WishScout — Local Business Discovery & Intelligence
 * Copyright (C) 2026 Vishwjeet Singh Vilkhu (Original Creator & Architect)
 * Licensed under the GNU GPL-3.0. See LICENSE and NOTICE; attribution must be preserved (GPL-3.0 §7).
 */
import { call, h, toast, field, modal, confirmBox, icon } from './util.js';
import { CH } from '../../shared/channels.js';

const errText = e => String(e.message).replace(/^Error invoking remote method '[^']+': Error: /, '');

export async function showAbout() {
  const [info, legal] = await Promise.all([call(CH.APP_INFO), call(CH.LEGAL_GET)]);
  const close = modal([
    h('img', { class: 'hero-logo logo-img', src: '../../assets/logo-mark.png', alt: 'WishScout' }),
    h('h1', { style: '' }, 'About WishScout'),
    h('p', { class: 'sec' }, `Version ${info.version} · Local Business Discovery & Intelligence`),
    h('p', {}, 'Created & Architected by ', h('b', {}, 'Vishwjeet Singh Vilkhu')),
    h('p', { class: 'sec' }, 'Licensed under the GNU General Public License v3.0 (GPL-3.0). Under Section 7, forks and derivatives must keep this attribution, the NOTICE file and source headers.'),
    h('pre', {}, legal.notice),
    h('div', { class: 'actions' }, h('button', { class: 'btn primary', onClick: () => close() }, 'Close'))
  ]);
}

export async function showTerms() {
  const legal = await call(CH.LEGAL_GET);
  return new Promise(() => {
    const agree = h('input', { type: 'checkbox', onChange: () => (accept.disabled = !agree.checked) });
    const accept = h('button', { class: 'btn primary', disabled: true, onClick: async () => { await call(CH.TERMS_ACCEPT); close(); location.reload(); } }, 'Accept & continue');
    const close = modal([
      h('img', { class: 'hero-logo logo-img', src: '../../assets/logo-mark.png', alt: '' }),
      h('h1', {}, 'Welcome to WishScout'),
      h('p', { class: 'sec' }, 'Responsible use & legal compliance. WishScout gathers publicly available B2B business data directly on your computer. As the operator, you agree to:'),
      h('ul', {}, h('li', {}, 'Respect target website rate limits and avoid server flooding.'),
        h('li', {}, 'Comply with regional anti-spam and cold-outreach laws (CAN-SPAM, GDPR, TCPA, PECR, DPDP).'),
        h('li', {}, 'Accept that the author assumes no liability for your outreach practices or gathered records.')),
      h('details', {}, h('summary', {}, 'Read the full legal disclaimer'), h('pre', {}, legal.disclaimer)),
      h('label', { class: 'chk', style: '' }, agree, 'I have read and agree to the Terms of Use & Legal Disclaimer'),
      h('div', { class: 'actions' }, h('button', { class: 'btn', onClick: () => call(CH.TERMS_DECLINE) }, 'Decline & exit'), accept)
    ], { dismissable: false });
  });
}

export function openTemplateEditor(tpl = null, onSaved = null) {
  const isEdit = !!(tpl && tpl.id);
  const nameInput = h('input', {
    class: 'input',
    placeholder: 'e.g. Website Redesign Pitch',
    value: tpl?.name || ''
  });
  const chanSel = h('select', { class: 'input' },
    h('option', { value: 'email', selected: (tpl?.channel || 'email') === 'email' }, 'Email Outreach'),
    h('option', { value: 'whatsapp', selected: tpl?.channel === 'whatsapp' }, 'WhatsApp Message')
  );
  const subjInput = h('input', {
    class: 'input',
    placeholder: "e.g. Quick inquiry regarding {name}'s online presence",
    value: tpl?.subject || ''
  });
  const subjLabel = field('Email Subject Line', subjInput);

  const bodyInput = h('textarea', {
    class: 'input',
    style: 'min-height: 180px; font-family: inherit; line-height: 1.5;',
    placeholder: 'Hi {name} team,\n\nI was looking up {category} in {city}...'
  }, tpl?.body || '');
  const bodyLabel = field('Message Body', bodyInput);

  let activeInput = bodyInput;
  subjInput.addEventListener('focus', () => { activeInput = subjInput; });
  bodyInput.addEventListener('focus', () => { activeInput = bodyInput; });

  const updateChanVisibility = () => {
    if (chanSel.value === 'whatsapp') {
      subjLabel.style.display = 'none';
    } else {
      subjLabel.style.display = 'flex';
    }
  };
  chanSel.addEventListener('change', updateChanVisibility);
  updateChanVisibility();

  const insertVar = v => {
    const target = activeInput || bodyInput;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const text = target.value;
    target.value = text.slice(0, start) + v + text.slice(end);
    target.focus();
    target.selectionStart = target.selectionEnd = start + v.length;
  };

  const VARS = [
    { tag: '{name}', label: 'Business Name' },
    { tag: '{city}', label: 'City' },
    { tag: '{category}', label: 'Category' },
    { tag: '{owner_name}', label: 'Contact Person' },
    { tag: '{website}', label: 'Website' },
    { tag: '{phone}', label: 'Phone' }
  ];

  const varChips = h('div', { class: 'row', style: 'gap: 6px; margin: 4px 0 10px; flex-wrap: wrap;' },
    VARS.map(v => h('button', {
      type: 'button',
      class: 'template-var-chip',
      title: `Insert ${v.label} placeholder`,
      onClick: e => { e.preventDefault(); insertVar(v.tag); }
    }, icon('tag', { size: 10 }), v.tag))
  );

  const saveBtn = h('button', {
    class: 'btn primary',
    onClick: async () => {
      const name = nameInput.value.trim();
      const channel = chanSel.value;
      const subject = subjInput.value.trim();
      const body = bodyInput.value.trim();

      if (!name) return toast('Please enter a template name');
      if (channel === 'email' && !subject) return toast('Please enter an email subject line');
      if (!body) return toast('Please enter a message body');

      try {
        await call(CH.TEMPLATES_SAVE, {
          id: tpl?.id || undefined,
          name, channel, subject, body
        });
        toast(isEdit ? 'Template updated successfully' : 'Template created successfully');
        closeModal();
        onSaved?.();
      } catch (e) {
        toast(errText(e));
      }
    }
  }, isEdit ? 'Save Changes' : 'Create Template');

  const closeModal = modal([
    h('div', { class: 'row', style: 'justify-content: space-between; align-items: center;' },
      h('h1', {}, isEdit ? `Edit: ${tpl.name}` : 'Create Outreach Template'),
      h('button', { class: 'btn sm', onClick: () => closeModal() }, 'Cancel')
    ),
    h('p', { class: 'sec' }, 'Use placeholders to automatically personalize each pitch with lead data.'),
    h('div', { class: 'row' },
      field('Template Name', nameInput),
      field('Channel', chanSel)
    ),
    subjLabel,
    h('div', { style: 'margin-top: 6px;' },
      h('span', { class: 'sec', style: 'font-size: 11px; font-weight: 500; display: block; margin-bottom: 4px;' }, 'Click variable to insert at cursor:'),
      varChips
    ),
    bodyLabel,
    h('div', { class: 'actions' },
      h('button', { class: 'btn', onClick: () => closeModal() }, 'Cancel'),
      saveBtn
    )
  ]);
}

export async function mountSettings(root) {
  const s = await call(CH.SETTINGS_GET), legal = await call(CH.LEGAL_GET);
  const conc = h('input', { class: 'input', type: 'range', min: 1, max: 5, value: s.concurrency, onInput: () => (concOut.textContent = conc.value) });
  const concOut = h('b', {}, s.concurrency);
  const dmin = h('input', { class: 'input', type: 'number', min: 500, step: 100, value: s.delayMin });
  const dmax = h('input', { class: 'input', type: 'number', min: 500, step: 100, value: s.delayMax });
  const proxy = h('textarea', {
    class: 'input',
    style: 'min-height: 72px; font-family: var(--font-mono); font-size: 12px; line-height: 1.4;',
    placeholder: 'http://proxy1:port\nhttp://proxy2:port\nsocks5://user:pass@host:port\n(Enter 1 or more proxies, one per line)'
  }, s.proxy || '');

  const getProxyCount = text => (text || '').split(/[\r\n,;]+/).map(st => st.trim()).filter(Boolean).length;
  const initialCount = getProxyCount(s.proxy);
  const proxyCountBadge = h('span', { class: 'pill', style: 'margin-left: 8px;' },
    `${initialCount} ${initialCount === 1 ? 'proxy' : 'proxies'} in pool`
  );
  proxy.addEventListener('input', () => {
    const c = getProxyCount(proxy.value);
    proxyCountBadge.textContent = `${c} ${c === 1 ? 'proxy' : 'proxies'} in pool`;
  });

  const proxyField = h('div', { class: 'field', style: 'width: 100%;' },
    h('div', { class: 'row', style: 'justify-content: space-between; align-items: center;' },
      h('span', {}, 'Rotating Proxy Pool (HTTP / SOCKS5)'),
      proxyCountBadge
    ),
    proxy,
    h('small', { class: 'muted', style: 'display: block; margin-top: 4px;' },
      'Paste one or multiple proxies (one per line). WishScout rotates IPs in round-robin order for crawlers to prevent rate limits.'
    )
  );

  const headfulCheck = h('input', { type: 'checkbox', checked: s.headless === false });
  const headfulBox = h('div', { style: 'margin-top: 12px;' },
    h('label', { class: 'chk', style: 'cursor: pointer;' }, headfulCheck, h('b', {}, 'Show browser window during discovery (Headful mode)')),
    h('small', { class: 'muted', style: 'display: block; margin-top: 4px; margin-left: 20px;' },
      'Keep unchecked for silent background scraping. Enable if you want to watch the crawler in real time or manually solve CAPTCHAs if prompted.')
  );
  const run = async fn => { try { await fn(); } catch (e) { toast(errText(e)); } };

  // Templates Management Section
  let currentChannelFilter = 'all';
  const templatesContainer = h('div', { class: 'template-grid' });
  const filterTabAll = h('button', { class: 'filter-tab active' }, 'All (0)');
  const filterTabEmail = h('button', { class: 'filter-tab' }, icon('mail', { size: 12 }), ' Email (0)');
  const filterTabWA = h('button', { class: 'filter-tab' }, icon('whatsapp', { size: 12 }), ' WhatsApp (0)');

  const refreshTemplates = async () => {
    try {
      const allTemplates = await call(CH.TEMPLATES_GET);
      const emailCount = allTemplates.filter(t => t.channel === 'email').length;
      const waCount = allTemplates.filter(t => t.channel === 'whatsapp').length;

      filterTabAll.textContent = `All (${allTemplates.length})`;
      filterTabEmail.replaceChildren(icon('mail', { size: 12 }), ` Email (${emailCount})`);
      filterTabWA.replaceChildren(icon('whatsapp', { size: 12 }), ` WhatsApp (${waCount})`);

      const filtered = currentChannelFilter === 'all'
        ? allTemplates
        : allTemplates.filter(t => t.channel === currentChannelFilter);

      templatesContainer.replaceChildren();

      if (filtered.length === 0) {
        templatesContainer.replaceChildren(
          h('div', { class: 'card empty', style: 'grid-column: 1 / -1; padding: 32px 16px; text-align: center;' },
            h('p', { class: 'sec' }, `No ${currentChannelFilter === 'all' ? '' : currentChannelFilter} templates found.`),
            h('button', { class: 'btn primary sm', style: 'margin-top: 10px;', onClick: () => openTemplateEditor({ channel: currentChannelFilter === 'whatsapp' ? 'whatsapp' : 'email' }, refreshTemplates) },
              icon('plus', { size: 13 }), ' Create Template'
            )
          )
        );
        return;
      }

      for (const t of filtered) {
        const isEmail = t.channel === 'email';
        const badge = h('span', { class: `template-badge ${isEmail ? 'email' : 'whatsapp'}` },
          icon(isEmail ? 'mail' : 'whatsapp', { size: 11 }),
          isEmail ? 'Email' : 'WhatsApp'
        );

        const editBtn = h('button', {
          class: 'btn sm',
          title: 'Edit template',
          onClick: () => openTemplateEditor(t, refreshTemplates)
        }, icon('edit', { size: 12 }), ' Edit');

        const delBtn = h('button', {
          class: 'btn sm danger',
          title: 'Delete template',
          onClick: async () => {
            if (await confirmBox('Delete Template?', `Are you sure you want to delete "${t.name}"?`, 'Delete')) {
              await call(CH.TEMPLATES_DELETE, { id: t.id });
              toast('Template deleted');
              refreshTemplates();
            }
          }
        }, icon('trash', { size: 12 }));

        const card = h('div', { class: 'template-card' },
          h('div', { class: 'template-header' },
            h('div', { class: 'template-title-wrap' },
              h('span', { class: 'template-name', title: t.name }, t.name),
              badge
            ),
            h('div', { class: 'template-actions' }, editBtn, delBtn)
          ),
          isEmail && t.subject ? h('div', { class: 'template-subject', title: t.subject }, `Subject: ${t.subject}`) : null,
          h('div', { class: 'template-body-preview' }, t.body)
        );

        templatesContainer.appendChild(card);
      }
    } catch (e) {
      toast(errText(e));
    }
  };

  const setFilter = f => {
    currentChannelFilter = f;
    filterTabAll.classList.toggle('active', f === 'all');
    filterTabEmail.classList.toggle('active', f === 'email');
    filterTabWA.classList.toggle('active', f === 'whatsapp');
    refreshTemplates();
  };

  filterTabAll.addEventListener('click', () => setFilter('all'));
  filterTabEmail.addEventListener('click', () => setFilter('email'));
  filterTabWA.addEventListener('click', () => setFilter('whatsapp'));

  const newTplBtn = h('button', {
    class: 'btn primary sm',
    onClick: () => openTemplateEditor({ channel: currentChannelFilter === 'whatsapp' ? 'whatsapp' : 'email' }, refreshTemplates)
  }, icon('plus', { size: 13 }), ' New Template');

  const resetTplBtn = h('button', {
    class: 'btn sm',
    onClick: async () => {
      if (await confirmBox('Reset Templates to Defaults?', 'This will replace all templates with the WishScout default outreach templates.', 'Reset Defaults')) {
        await call(CH.TEMPLATES_RESET);
        toast('Templates reset to defaults');
        refreshTemplates();
      }
    }
  }, icon('refresh', { size: 13 }), ' Reset Defaults');

  const templatesCard = h('div', { class: 'card' },
    h('div', { class: 'row', style: 'justify-content: space-between; align-items: flex-start; gap: 12px;' },
      h('div', {},
        h('h2', { style: 'margin-bottom: 2px;' }, 'Outreach & Pitch Templates'),
        h('p', { class: 'sec', style: 'margin: 0; font-size: 12px;' }, 'Create and manage unlimited custom WhatsApp and Email pitch templates with dynamic variable tags.')
      ),
      h('div', { class: 'row', style: 'gap: 8px;' }, resetTplBtn, newTplBtn)
    ),
    h('div', { class: 'row filter-tabs', style: 'margin-top: 14px; margin-bottom: 4px;' },
      filterTabAll, filterTabEmail, filterTabWA
    ),
    templatesContainer
  );

  refreshTemplates();

  root.replaceChildren(
    h('h1', {}, 'Settings'),
    h('p', { class: 'sub' }, 'Control how gently WishScout crawls, and manage your local data.'),
    h('div', { class: 'card' }, h('h2', {}, 'Scraper & Browser Engine'),
      h('div', { class: 'row' }, field('Parallel website crawlers (1–5)', h('div', { class: 'row' }, conc, concOut)),
        field('Min delay (ms)', dmin), field('Max delay (ms)', dmax)),
      h('div', { class: 'row', style: 'margin-top: 12px;' }, proxyField),
      headfulBox,
      h('div', { class: 'row', style: 'margin-top: 14px;' }, h('button', { class: 'btn primary', onClick: () => run(async () => {
        await call(CH.SETTINGS_SAVE, { concurrency: +conc.value, delayMin: +dmin.value, delayMax: +dmax.value, proxy: proxy.value.trim(), headless: !headfulCheck.checked }); toast('Settings saved');
      }) }, 'Save settings'))),
    templatesCard,
    h('div', { class: 'card', style: '' }, h('h2', {}, 'Database'),
      h('p', { class: 'sec' }, 'Everything is stored locally. Nothing is sent to any server.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onClick: () => run(async () => { const r = await call(CH.DB_BACKUP); if (!r.canceled) toast('Backup saved'); }) }, 'Back up database'),
        h('button', { class: 'btn danger', onClick: () => run(async () => {
          if (await confirmBox('Wipe all data?', 'This permanently deletes every lead, note and search record. It cannot be undone.', 'Wipe everything')) { await call(CH.DB_WIPE); toast('Database wiped'); }
        }) }, 'Wipe database'))),
    h('div', { class: 'card', style: '' }, h('h2', {}, 'Legal'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onClick: showAbout }, 'About WishScout')),
      h('details', { style: '' }, h('summary', {}, 'Legal disclaimer & responsible use policy'), h('pre', { style: '' }, legal.disclaimer))));
}
