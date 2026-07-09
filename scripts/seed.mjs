#!/usr/bin/env node
/* Seed (or reset) the pre-seeded "Nana" example trove into the store.
   The app also auto-seeds the example on first access; this is a convenience for a fresh deploy.
   Requires the app to be running (npm run dev / npm start). Env: TROVE_URL (default :3000). */
const BASE = process.env.TROVE_URL || `http://localhost:${process.env.PORT || 3000}`;
try {
  const res = await fetch(`${BASE}/api/example`, { method: 'POST' });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const j = await res.json();
  console.log(`Seeded example trove "${j.id}" — ${j.view.totals.tesseraeSet} set · ${j.view.totals.gilded} gilded · ${j.view.totals.dusted} dusted · ${j.view.totals.openContradictions} open.`);
} catch (e) {
  console.error(`Could not reach Trove at ${BASE}. Start it first (npm run dev), then re-run.\n${String(e?.message || e)}`);
  process.exit(1);
}
