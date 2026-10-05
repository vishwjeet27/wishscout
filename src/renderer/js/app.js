/**
 * WishScout — Local Business Discovery & Intelligence
 * Copyright (C) 2026 Vishwjeet Singh Vilkhu (Original Creator & Architect)
 * Licensed under the GNU GPL-3.0. See LICENSE and NOTICE; attribution must be preserved (GPL-3.0 §7).
 */
import { call, h, $, icon } from './util.js';
import { CH } from '../../shared/channels.js';
import { initDiscovery, mountDiscovery } from './discovery.js';
import { mountPipeline } from './pipeline.js';
import { mountAnalytics } from './analytics.js';
import { mountSettings, showAbout, showTerms } from './settings.js';

const VIEWS = [['discovery', 'Discovery', mountDiscovery], ['pipeline', 'Pipeline', mountPipeline], ['analytics', 'Analytics', mountAnalytics], ['settings', 'Settings', mountSettings]];
const VIEW_ICONS = { discovery: 'search', pipeline: 'layers', analytics: 'chart', settings: 'settings' };
let cleanup = null;

function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('ws-theme', t); } catch { /* storage unavailable */ }
  const btn = $('#theme-toggle');
  if (btn) {
    btn.replaceChildren(icon(t === 'dark' ? 'sun' : 'moon', { size: 14 }), document.createTextNode(t === 'dark' ? ' Switch to light mode' : ' Switch to dark mode'));
  }
}

async function go(name) {
  cleanup?.(); cleanup = null;
  for (const b of document.querySelectorAll('#nav .nav-btn')) {
    if (b.dataset.view === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  const mount = VIEWS.find(v => v[0] === name)[2];
  const view = $('#view'); view.scrollTop = 0;
  const r = await mount(view);
  if (typeof r === 'function') cleanup = r;
}
window.navigateTo = go;

async function boot() {
  let theme = 'dark'; try { theme = localStorage.getItem('ws-theme') || 'dark'; } catch { /* noop */ }
  applyTheme(theme);
  $('#theme-toggle').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  $('#footer-about').addEventListener('click', showAbout);
  $('#nav').append(...VIEWS.map(([k, label]) => h('button', { class: 'nav-btn', type: 'button', 'data-view': k, onClick: () => go(k) },
    icon(VIEW_ICONS[k] || 'star', { size: 15 }),
    document.createTextNode(' ' + label)
  )));

  if (!(await call(CH.TERMS_STATUS)).accepted) { showTerms(); return; } // blocks workbench until accepted
  initDiscovery();
  go('discovery');
}
boot();
