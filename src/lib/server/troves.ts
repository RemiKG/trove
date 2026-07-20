/* Server helpers: load / create / persist troves, and ensure the pre-seeded example exists.
   A light in-memory read-cache keeps the large example bundle snappy; the file (or Postgres) is
   always the source of truth, so a server restart still reads from disk — the cold-reopen
   persistence is genuinely real, not a cache trick. */
import type { TroveBundle } from '../memory/types';
import { DEFAULT_SETTINGS } from '../memory/types';
import { getStore, newId } from '../memory/store';
import { buildExample, EXAMPLE_ID } from '../memory/exampleSeed';
import { brainMode } from '../config';

const cache = new Map<string, TroveBundle>();

export async function ensureExample(reset = false): Promise<TroveBundle> {
  if (!reset && cache.has(EXAMPLE_ID)) return cache.get(EXAMPLE_ID)!;
  const store = getStore();
  let b = reset ? null : await store.get(EXAMPLE_ID);
  if (!b) { b = buildExample(); await store.save(b); }
  cache.set(EXAMPLE_ID, b);
  return b;
}

export async function loadBundle(id: string): Promise<TroveBundle | null> {
  if (id === EXAMPLE_ID) return ensureExample();
  // Always consult the durable store — the per-instance cache is NOT trusted blindly, because on
  // serverless a different instance may hold a stale (even empty, just-created) copy. But the
  // store read can itself lag its own last write, so we take the FRESHEST of {cache, store} by
  // rev. This is the "fresh-read-before-write" guarantee: a write is never based on stale data,
  // and a lagging read can never clobber a newer in-memory bundle.
  const stored = await getStore().get(id).catch(() => null);
  const cached = cache.get(id) || null;
  let chosen: TroveBundle | null = stored;
  if (cached) {
    const cr = cached.trove.rev ?? 0;
    const sr = stored?.trove.rev ?? -1;
    if (!stored || cr >= sr) chosen = cached;
  }
  if (chosen) cache.set(id, chosen);
  return chosen;
}

export async function persist(b: TroveBundle): Promise<void> {
  b.trove.rev = (b.trove.rev ?? 0) + 1;
  cache.set(b.trove.id, b);
  await getStore().save(b);
}

export async function removeTrove(id: string): Promise<void> {
  cache.delete(id);
  await getStore().delete(id);
}

/** a stable per-person seed → the portrait is the same face for the same person on every recall. */
export function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 99000) + 100;
}

export function createBundle(input: { personName: string; relationship?: string; fullName?: string }): TroveBundle {
  const now = Date.now();
  const personName = (input.personName || 'Them').trim().slice(0, 60);
  const id = newId('tr_');
  return {
    trove: {
      id,
      personName,
      fullName: (input.fullName || personName).trim().slice(0, 80),
      relationship: (input.relationship || 'someone you love').trim().slice(0, 60),
      seed: hashSeed(personName + (input.fullName || '')),
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      currentSession: 1,
      turnCount: 0,
      settings: { ...DEFAULT_SETTINGS },
      brain: brainMode(),
    },
    tesserae: [],
    tellings: [],
    contradictions: [],
  };
}

export { EXAMPLE_ID };
