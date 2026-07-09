#!/usr/bin/env node
/* decide the next best interview question — the biggest hole in the life. */
import { tool, out } from './_client.mjs';
out(await tool('next-question'));
