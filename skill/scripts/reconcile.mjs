#!/usr/bin/env node
/* list open contradictions, or resolve one: reconcile.mjs <contradictionId> <value> */
import { tool, out } from './_client.mjs';
const [contradictionId, value] = process.argv.slice(2);
out(await tool('reconcile', contradictionId && value ? { contradictionId, value } : {}));
