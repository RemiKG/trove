#!/usr/bin/env node
/* Trove MCP server — exposes Trove's persistent life-memory as reusable tools for ANY agent:
     remember · recall · reconcile · next-question · gild · forget
   It proxies to the running Trove app's tool endpoints (one real engine, one source of truth), so
   an external agent (e.g. a Qwen agent via the Responses API's MCP support) shares the exact same
   owned store the Biographer uses. SSE-hostable behind a reverse proxy; stdio for local clients.

   Run:  TROVE_URL=http://localhost:3000  npm run mcp
   Then point an MCP client at this stdio server (or wrap it with an SSE bridge for Qwen). */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const BASE = process.env.TROVE_URL || `http://localhost:${process.env.PORT || 3000}`;

const TOOLS = [
  {
    name: 'recall',
    description: 'Recall the most relevant memories for a question, under a hard token budget — gilded canon first. Reads the persistent life-store, not the transcript.',
    inputSchema: {
      type: 'object',
      properties: {
        troveId: { type: 'string', description: 'the trove id (a person)' },
        query: { type: 'string', description: 'the question / scene text' },
        budget: { type: 'number', description: 'optional token budget (default 4096)' },
      },
      required: ['troveId', 'query'],
    },
  },
  {
    name: 'remember',
    description: 'Write typed life-records into the store. Each record: {type, name, detail, quote?, subject?, value?, canonical?}.',
    inputSchema: {
      type: 'object',
      properties: {
        troveId: { type: 'string' },
        records: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['person', 'place', 'event', 'date', 'object', 'saying', 'value', 'relationship'] },
              name: { type: 'string' }, detail: { type: 'string' }, quote: { type: 'string' },
              subject: { type: 'string' }, value: { type: 'string' }, canonical: { type: 'boolean' },
            },
            required: ['type', 'name', 'detail'],
          },
        },
      },
      required: ['troveId', 'records'],
    },
  },
  {
    name: 'reconcile',
    description: 'Detect contradictions, or resolve one to the true version (gild the truth, dust the slip). Pass contradictionId + value to resolve; omit to just list open conflicts.',
    inputSchema: {
      type: 'object',
      properties: { troveId: { type: 'string' }, contradictionId: { type: 'string' }, value: { type: 'string' } },
      required: ['troveId'],
    },
  },
  {
    name: 'next-question',
    description: 'Decide the next best interview question — the one that fills the biggest hole in the life.',
    inputSchema: { type: 'object', properties: { troveId: { type: 'string' } }, required: ['troveId'] },
  },
  {
    name: 'gild',
    description: 'Gild a memory as canon (always recalled, never forgotten), by tesseraId or name.',
    inputSchema: { type: 'object', properties: { troveId: { type: 'string' }, tesseraId: { type: 'string' }, name: { type: 'string' } }, required: ['troveId'] },
  },
  {
    name: 'forget',
    description: 'Forget a memory: pass tesseraId to lift one to dust, or omit to run the decay pass over the store. Reversible.',
    inputSchema: { type: 'object', properties: { troveId: { type: 'string' }, tesseraId: { type: 'string' } }, required: ['troveId'] },
  },
];

const server = new Server({ name: 'trove-memory', version: '1.0.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    const res = await fetch(`${BASE}/api/mcp/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {}),
    });
    const text = await res.text();
    if (!res.ok) return { isError: true, content: [{ type: 'text', text: `error ${res.status}: ${text}` }] };
    return { content: [{ type: 'text', text }] };
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: `Could not reach Trove at ${BASE}. Start it first (npm run dev). ${String(e?.message || e)}` }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`Trove MCP server up (stdio) → proxying ${BASE}/api/mcp/*`);
