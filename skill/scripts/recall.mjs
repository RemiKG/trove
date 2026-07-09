#!/usr/bin/env node
/* recall a person's critical memories for a question, under a hard token budget. */
import { tool, out } from './_client.mjs';
const query = process.argv.slice(2).join(' ');
if (!query) { console.error('usage: recall.mjs "<question>"'); process.exit(1); }
out(await tool('recall', { query }));
