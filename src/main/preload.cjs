/**
 * WishScout — Local Business Discovery & Intelligence
 * Copyright (C) 2026 Vishwjeet Singh Vilkhu (Original Creator & Architect)
 * Licensed under the GNU GPL-3.0. See LICENSE and NOTICE; attribution must be preserved (GPL-3.0 §7).
 */
'use strict';
// Sandboxed preload: exposes ONLY allow-listed channels. Keep in sync with src/shared/channels.js (checked by `npm run check`).
const { contextBridge, ipcRenderer } = require('electron');

const INVOKE = new Set([
  'app:info', 'legal:get', 'terms:status', 'terms:accept', 'terms:decline',
  'settings:get', 'settings:save',
  'scrape:start', 'scrape:pause', 'scrape:resume', 'scrape:cancel', 'scrape:state',
  'gosom:check', 'gosom:start', 'gosom:stop', 'gosom:state', 'gosom:import',
  'leads:query', 'leads:get', 'leads:status', 'leads:fields', 'leads:delete', 'leads:bulk-status', 'leads:facets',
  'leads:duplicates', 'leads:merge',
  'logs:add', 'analytics:get', 'export:csv', 'export:json', 'export:pdf',
  'import:csv', 'search:history', 'reminders:get',
  'templates:get', 'templates:save', 'templates:delete', 'templates:reset',
  'db:backup', 'db:wipe', 'shell:open-external'
]);
const EVENTS = new Set(['scrape:event', 'gosom:event']);

contextBridge.exposeInMainWorld('wishScoutApi', Object.freeze({
  invoke: (channel, payload) =>
    INVOKE.has(channel) ? ipcRenderer.invoke(channel, payload) : Promise.reject(new Error('Blocked IPC channel: ' + channel)),
  on: (channel, callback) => {
    if (!EVENTS.has(channel)) throw new Error('Blocked IPC event: ' + channel);
    const handler = (_e, data) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  }
}));
