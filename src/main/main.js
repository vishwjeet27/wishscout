/**
 * WishScout — Local Business Discovery & Intelligence
 * Copyright (C) 2026 Vishwjeet Singh Vilkhu (Original Creator & Architect)
 * Licensed under the GNU GPL-3.0. See LICENSE and NOTICE; attribution must be preserved (GPL-3.0 §7).
 */
import { app, BrowserWindow, Menu, dialog, ipcMain, shell, Notification } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CH, STATUSES, ACTION_TYPES } from '../shared/channels.js';
import { createStore } from './db.js';
import { ScraperManager } from './scraperManager.js';
import { GosomManager } from './gosomManager.js';
import { toCsv, dossierHtml, renderPdf } from './exporter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
let win, store, scraper, gosom;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700, backgroundColor: '#09090b', title: 'WishScout',
    icon: path.join(ROOT, 'assets/icon.png'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.on('console-message', (e, level, msg, line, src) => {
    console.error(`[RENDERER CONSOLE ${level}] (${src}:${line}) ${msg}`);
  });
  win.loadFile(path.join(ROOT, 'src/renderer/index.html'));
}

const handle = (channel, fn) => ipcMain.handle(channel, async (e, payload) => {
  if (!e.senderFrame?.url?.startsWith('file://')) throw new Error('Untrusted IPC sender');
  return fn(payload ?? {});
});
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const ids = v => { if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) throw new Error('Invalid id list'); return v; };
const stamp = () => new Date().toISOString().slice(0, 10);

async function saveAs(defaultName, filterName, ext) {
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), defaultName), filters: [{ name: filterName, extensions: [ext] }] });
  return r.canceled ? null : r.filePath;
}

function parseCsvText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const parseLine = line => {
    const result = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const findCol = (...keys) => headers.findIndex(h => keys.some(k => h === k || h.includes(k)));

  const colMap = {
    name: findCol('name', 'businessname', 'company', 'title'),
    phone: findCol('phone', 'tel', 'mobile', 'cell'),
    email: findCol('email', 'mail'),
    website: findCol('website', 'url', 'web', 'link', 'domain'),
    address: findCol('address', 'street', 'location'),
    city: findCol('city', 'town'),
    state: findCol('state', 'province', 'region'),
    postal_code: findCol('postal', 'zip', 'zipcode', 'postcode'),
    country: findCol('country'),
    category: findCol('category', 'industry', 'type'),
    notes: findCol('notes', 'note', 'comment', 'description'),
    tags: findCol('tags', 'tag')
  };

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const getVal = key => (colMap[key] >= 0 ? cols[colMap[key]] || '' : '');
    const name = getVal('name');
    if (!name) continue;
    rows.push({
      name,
      phone: getVal('phone'),
      email: getVal('email'),
      website: getVal('website'),
      address: getVal('address'),
      city: getVal('city') || 'Unknown',
      state: getVal('state'),
      postal_code: getVal('postal_code'),
      country: getVal('country') || 'Unknown',
      category: getVal('category') || 'Uncategorized',
      notes: getVal('notes'),
      tags: getVal('tags')
    });
  }
  return rows;
}

function checkFollowUpReminders() {
  try {
    if (!store || !Notification.isSupported()) return;
    const due = store.getDueFollowUps();
    if (due.length > 0) {
      new Notification({
        title: 'WishScout — Follow-up Reminder',
        body: `You have ${due.length} lead${due.length === 1 ? '' : 's'} scheduled for follow-up today!`,
        icon: path.join(ROOT, 'assets/icon.png')
      }).show();
    }
  } catch { /* noop */ }
}

function registerIpc() {
  handle(CH.APP_INFO, () => ({ version: app.getVersion(), platform: process.platform }));
  handle(CH.LEGAL_GET, () => ({
    disclaimer: fs.readFileSync(path.join(ROOT, 'DISCLAIMER.md'), 'utf8'), notice: fs.readFileSync(path.join(ROOT, 'NOTICE'), 'utf8')
  }));
  handle(CH.TERMS_STATUS, () => { const at = store.getFlag('terms_accepted_at'); return { accepted: !!at, at: at ? Number(at) : null }; });
  handle(CH.TERMS_ACCEPT, () => { store.setFlag('terms_accepted_at', Date.now()); return { ok: true }; });
  handle(CH.TERMS_DECLINE, () => { app.quit(); return { ok: true }; });
  handle(CH.SETTINGS_GET, () => store.getSettings());
  handle(CH.SETTINGS_SAVE, p => store.saveSettings(p));
  handle(CH.TEMPLATES_GET, p => store.getTemplates(p?.channel));
  handle(CH.TEMPLATES_SAVE, p => store.saveTemplate(p));
  handle(CH.TEMPLATES_DELETE, p => store.deleteTemplate(str(p.id)));
  handle(CH.TEMPLATES_RESET, () => store.resetTemplates());

  handle(CH.SCRAPE_START, p => {
    if (!store.getFlag('terms_accepted_at')) throw new Error('Accept the Responsible Use Agreement first.');
    const location = str(p.location, 120), category = str(p.category, 120);
    if (location.length < 2 || category.length < 2) throw new Error('Enter a location and a business category.');
    const limit = Math.min(1000, Math.max(1, Math.trunc(Number(p.limit)) || 50));
    const radius = Math.min(200, Math.max(0, Number(p.radius) || 0));
    const sources = Array.isArray(p.sources) && p.sources.length ? p.sources : ['google', 'bing', 'yellowpages', 'yelp'];
    scraper.start({
      location, category, limit, radius, sources,
      websiteFilter: p.websiteFilter || 'all',
      phoneRequired: !!p.phoneRequired,
      ratingFilter: p.ratingFilter || 'all'
    });
    return scraper.snapshot();
  });
  handle(CH.SCRAPE_PAUSE, () => { scraper.pause(); return scraper.snapshot(); });
  handle(CH.SCRAPE_RESUME, () => { scraper.resume(); return scraper.snapshot(); });
  handle(CH.SCRAPE_CANCEL, () => { scraper.cancel(); return scraper.snapshot(); });
  handle(CH.SCRAPE_STATE, () => scraper.snapshot());

  handle(CH.GOSOM_CHECK, () => gosom.checkPrerequisites());
  handle(CH.GOSOM_START, p => {
    if (!store.getFlag('terms_accepted_at')) throw new Error('Accept the Responsible Use Agreement first.');
    return gosom.start(p, app.getPath('temp'));
  });
  handle(CH.GOSOM_STOP, () => gosom.stop());
  handle(CH.GOSOM_STATE, () => gosom.snapshot());
  handle(CH.GOSOM_IMPORT, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Import Gosom Output Results (JSON / CSV)',
      filters: [
        { name: 'Gosom Output (*.json, *.csv)', extensions: ['json', 'csv'] },
        { name: 'JSON file', extensions: ['json'] },
        { name: 'CSV file', extensions: ['csv'] }
      ],
      properties: ['openFile']
    });
    if (canceled || !filePaths.length) return { canceled: true };
    const res = gosom.importFile(filePaths[0]);
    return { ...res, canceled: false };
  });

  handle(CH.LEADS_QUERY, p => store.query(p));
  handle(CH.LEADS_GET, p => store.get(str(p.id)));
  handle(CH.LEADS_FACETS, () => store.facets());
  handle(CH.LEADS_DUPLICATES, () => store.findPotentialDuplicates());
  handle(CH.LEADS_MERGE, p => store.mergeLeads(str(p.primaryId), str(p.secondaryId)));
  handle(CH.LEADS_STATUS, p => { store.setStatus(str(p.id), str(p.status)); return { ok: true }; });
  handle(CH.LEADS_BULK_STATUS, p => { store.bulkStatus(ids(p.ids), str(p.status)); return { ok: true }; });
  handle(CH.LEADS_FIELDS, p => { store.updateFields(str(p.id), p.fields); return store.get(str(p.id)); });
  handle(CH.LEADS_DELETE, p => ({ deleted: store.deleteMany(ids(p.ids)) }));
  handle(CH.LOGS_ADD, p => {
    if (!ACTION_TYPES.includes(p.action_type)) throw new Error('Invalid action type');
    return store.addLog({ business_id: str(p.business_id), action_type: p.action_type, notes: str(p.notes, 5000), followUpDate: str(p.followUpDate, 20) });
  });
  handle(CH.ANALYTICS_GET, () => store.analytics());
  handle(CH.SEARCH_HISTORY, p => store.getRecentSearches(p?.limit || 10));
  handle(CH.REMINDERS_GET, () => store.getDueFollowUps());

  handle(CH.IMPORT_CSV, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Import Leads from CSV',
      filters: [{ name: 'CSV File', extensions: ['csv'] }],
      properties: ['openFile']
    });
    if (canceled || !filePaths.length) return { canceled: true };
    const filePath = filePaths[0];
    const text = fs.readFileSync(filePath, 'utf8');
    const rows = parseCsvText(text);
    const result = store.importRows(rows);
    return { ...result, canceled: false, filename: path.basename(filePath) };
  });

  handle(CH.EXPORT_CSV, async p => {
    const rows = store.exportRows(p); const file = await saveAs(`wishscout-leads-${stamp()}.csv`, 'CSV (Excel)', 'csv');
    if (!file) return { canceled: true };
    fs.writeFileSync(file, toCsv(rows), 'utf8'); return { path: file, count: rows.length };
  });
  handle(CH.EXPORT_JSON, async p => {
    const file = await saveAs(`wishscout-export-${stamp()}.json`, 'JSON', 'json');
    if (!file) return { canceled: true };
    const hasSel = Array.isArray(p.ids) && p.ids.length;
    const businesses = store.exportRows(p);
    const dump = { exportedAt: new Date().toISOString(), generator: 'WishScout', businesses,
      ...(hasSel ? {} : { outreach_logs: store.raw.prepare('SELECT * FROM outreach_logs').all(), search_history: store.raw.prepare('SELECT * FROM search_history').all() }) };
    fs.writeFileSync(file, JSON.stringify(dump, null, 2), 'utf8'); return { path: file, count: businesses.length };
  });
  handle(CH.EXPORT_PDF, async p => {
    const rows = store.exportRows(p).slice(0, 500); const file = await saveAs(`wishscout-dossier-${stamp()}.pdf`, 'PDF', 'pdf');
    if (!file) return { canceled: true };
    const html = dossierHtml(rows, path.join(ROOT, 'assets/icon.png'), p.branding || {});
    fs.writeFileSync(file, await renderPdf(html, app.getPath('temp'))); return { path: file, count: rows.length };
  });

  handle(CH.DB_BACKUP, async () => {
    const file = await saveAs(`wishscout-backup-${stamp()}.db`, 'SQLite database', 'db');
    if (!file) return { canceled: true };
    await store.backup(file); return { path: file };
  });
  handle(CH.DB_WIPE, () => { store.wipe(); return { ok: true }; });
  handle(CH.OPEN_EXTERNAL, async p => {
    const raw = str(p.url, 2000);
    if (/^tel:[+0-9\s-]+$/i.test(raw)) {
      await shell.openExternal(raw);
      return { ok: true };
    }
    if (/^whatsapp:\/\//i.test(raw)) {
      await shell.openExternal(raw);
      return { ok: true };
    }
    let u;
    try {
      u = new URL(/^[a-z]+:/i.test(raw) ? raw : 'https://' + raw);
    } catch {
      throw new Error('Invalid URL format');
    }
    if (!['http:', 'https:', 'mailto:', 'tel:', 'whatsapp:'].includes(u.protocol)) throw new Error('Blocked URL scheme');
    await shell.openExternal(u.href); return { ok: true };
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  store = createStore(path.join(app.getPath('userData'), 'leads.db'));
  createWindow();
  scraper = new ScraperManager({
    store, workerPath: path.join(ROOT, 'src/scraper/discoveryWorker.js'),
    emit: evt => { if (win && !win.isDestroyed()) win.webContents.send(CH.SCRAPE_EVENT, evt); }
  });
  gosom = new GosomManager({
    store,
    emit: evt => { if (win && !win.isDestroyed()) win.webContents.send(CH.GOSOM_EVENT, evt); }
  });
  registerIpc();
  setTimeout(checkFollowUpReminders, 5000);
  setInterval(checkFollowUpReminders, 30 * 60 * 1000);
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('before-quit', () => {
  scraper?.shutdown();
  gosom?.stop();
});
app.on('window-all-closed', () => { try { store?.close(); } catch { /* noop */ } app.quit(); });
