/**
 * WishScout — Local Business Discovery & Intelligence
 * Copyright (C) 2026 Vishwjeet Singh Vilkhu (Original Creator & Architect)
 * Licensed under the GNU GPL-3.0. See LICENSE and NOTICE; attribution must be preserved (GPL-3.0 §7).
 */
// Single source of truth for IPC channel names. scripts/check.mjs verifies preload.cjs allow-lists every entry.
export const CH = Object.freeze({
  APP_INFO: 'app:info', LEGAL_GET: 'legal:get',
  TERMS_STATUS: 'terms:status', TERMS_ACCEPT: 'terms:accept', TERMS_DECLINE: 'terms:decline',
  SETTINGS_GET: 'settings:get', SETTINGS_SAVE: 'settings:save',
  SCRAPE_START: 'scrape:start', SCRAPE_PAUSE: 'scrape:pause', SCRAPE_RESUME: 'scrape:resume',
  SCRAPE_CANCEL: 'scrape:cancel', SCRAPE_STATE: 'scrape:state', SCRAPE_EVENT: 'scrape:event',
  GOSOM_CHECK: 'gosom:check', GOSOM_START: 'gosom:start', GOSOM_STOP: 'gosom:stop',
  GOSOM_STATE: 'gosom:state', GOSOM_IMPORT: 'gosom:import', GOSOM_EVENT: 'gosom:event',
  LEADS_QUERY: 'leads:query', LEADS_GET: 'leads:get', LEADS_STATUS: 'leads:status',
  LEADS_FIELDS: 'leads:fields', LEADS_DELETE: 'leads:delete', LEADS_BULK_STATUS: 'leads:bulk-status',
  LEADS_FACETS: 'leads:facets', LEADS_DUPLICATES: 'leads:duplicates', LEADS_MERGE: 'leads:merge',
  LOGS_ADD: 'logs:add', ANALYTICS_GET: 'analytics:get',
  EXPORT_CSV: 'export:csv', EXPORT_JSON: 'export:json', EXPORT_PDF: 'export:pdf',
  IMPORT_CSV: 'import:csv', SEARCH_HISTORY: 'search:history', REMINDERS_GET: 'reminders:get',
  TEMPLATES_GET: 'templates:get', TEMPLATES_SAVE: 'templates:save',
  TEMPLATES_DELETE: 'templates:delete', TEMPLATES_RESET: 'templates:reset',
  DB_BACKUP: 'db:backup', DB_WIPE: 'db:wipe', OPEN_EXTERNAL: 'shell:open-external'
});
export const STATUSES = ['New Lead', 'Contacted', 'Follow-up Scheduled', 'Interested', 'Converted', 'Disqualified'];
export const ACTION_TYPES = ['Email Sent', 'Call Placed', 'WhatsApp Sent', 'LinkedIn InMail', 'Meeting Scheduled', 'Follow-up Scheduled', 'Note'];
