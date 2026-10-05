/**
 * WishScout — Local Business Discovery & Intelligence
 * Copyright (C) 2026 Vishwjeet Singh Vilkhu (Original Creator & Architect)
 * Licensed under the GNU GPL-3.0. See LICENSE and NOTICE; attribution must be preserved (GPL-3.0 §7).
 */
// Phase 9 verification: syntax-check every source file and make sure the preload allow-list matches the IPC registry.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CH } from '../src/shared/channels.js';

const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
let failed = false;
for (const f of walk('src').filter(f => /\.(c|m)?js$/.test(f))) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { failed = true; console.error('SYNTAX ERROR', f, String(e.stderr)); }
}
const preload = fs.readFileSync('src/main/preload.cjs', 'utf8');
for (const v of Object.values(CH)) if (!preload.includes(`'${v}'`)) { failed = true; console.error('Missing from preload allow-list:', v); }
for (const f of ['NOTICE', 'DISCLAIMER.md', 'LICENSE', 'assets/icon.ico', 'assets/favicon.png']) if (!fs.existsSync(f)) { failed = true; console.error('Missing', f); }
console.log(failed ? 'CHECK FAILED' : 'All checks passed');
process.exit(failed ? 1 : 0);
