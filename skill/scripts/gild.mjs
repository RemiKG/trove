#!/usr/bin/env node
/* gild a memory as canon (never forgotten), by name or tesseraId. */
import { tool, out } from './_client.mjs';
const arg = process.argv.slice(2).join(' ');
if (!arg) { console.error('usage: gild.mjs "<name or tesseraId>"'); process.exit(1); }
out(await tool('gild', arg.startsWith('t_') ? { tesseraId: arg } : { name: arg }));
