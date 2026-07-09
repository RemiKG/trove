#!/usr/bin/env node
/* write typed life-records into the store. arg = JSON array of records. */
import { tool, out } from './_client.mjs';
const raw = process.argv[2];
if (!raw) { console.error('usage: remember.mjs \'[{"type","name","detail"}]\''); process.exit(1); }
let records;
try { records = JSON.parse(raw); } catch { console.error('records must be valid JSON'); process.exit(1); }
out(await tool('remember', { records: Array.isArray(records) ? records : [records] }));
