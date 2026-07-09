#!/usr/bin/env node
/* lift a memory to dust (reversible), or run the decay pass: forget.mjs [<tesseraId>] */
import { tool, out } from './_client.mjs';
const tesseraId = process.argv[2];
out(await tool('forget', tesseraId ? { tesseraId } : {}));
