/* Shared client for the Trove Skill scripts — calls the running app's tool endpoints.
   Env: TROVE_URL (default http://localhost:3000), TROVE_ID (the person's trove id). */
export const BASE = process.env.TROVE_URL || 'http://localhost:3000';
export const TROVE_ID = process.env.TROVE_ID || 'nana-example';

export async function tool(name, args = {}) {
  const res = await fetch(`${BASE}/api/mcp/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ troveId: TROVE_ID, ...args }),
  });
  const text = await res.text();
  if (!res.ok) { console.error(`error ${res.status}: ${text}`); process.exit(1); }
  try { return JSON.parse(text); } catch { return text; }
}

export function out(obj) {
  console.log(JSON.stringify(obj, null, 2));
}
