/* Reconciliation — the intelligence a tape recorder cannot do.
   Trove never silently keeps both tellings or overwrites. When two live tesserae describe the
   SAME subject with DIFFERENT specific values (the bakery on Elm vs Oak; born '62 vs '63; "my
   brother" vs "my cousin"), it holds them side by side and raises a contradiction to be surfaced
   as a question. On the answer, the true tile is gilded and the slip is dusted + superseded.

   Detection is real and deterministic: group active tesserae by a normalised subject key, then
   look for ≥2 distinct value keys within a group. Qwen can also mark `subject`/`value` at
   extraction time (richer); the offline extractor derives them heuristically. */
import type { TroveBundle, Tessera, Contradiction } from './types';
import { newId } from './store';

const LEAD = /^(the|a|an|her|his|their|my|your|our)\s+/i;

/** the entity a claim is about — for grouping. Prefer an explicit subject; else the name head. */
export function subjectKey(t: { name: string; subject?: string; type: string }): string {
  const raw = (t.subject || t.name || '').toLowerCase().replace(LEAD, '').trim();
  // collapse to the salient head words, dropping a trailing specific value (street/year/etc.)
  const words = raw.split(/[\s,–-]+/).filter(Boolean);
  const head = words.filter((w) => !/^\d{2,4}$/.test(w) && !STREETY.has(w)).slice(0, 3).join(' ');
  return (head || raw).trim();
}

const STREETY = new Set(['street', 'st', 'road', 'rd', 'avenue', 'ave', 'lane', 'ln', 'way', 'drive', 'dr']);

/** the specific claim carried by a tessera — for detecting divergence within a subject. */
export function valueKey(t: { name: string; detail: string; value?: string; type: string }): string {
  if (t.value) return t.value.toLowerCase().replace(LEAD, '').trim();
  const text = `${t.name} ${t.detail}`;
  // a street name
  const street = text.match(/\b([A-Z][a-z]+)\s+(?:street|st|road|rd|avenue|ave|lane|ln)\b/);
  if (street) return street[1].toLowerCase();
  // a year
  const year = text.match(/\b(1[89]\d{2}|20\d{2})\b/);
  if (year && (t.type === 'date' || t.type === 'event')) return year[1];
  // a relation word
  const rel = text.match(/\b(brother|sister|cousin|uncle|aunt|father|mother|friend|neighbou?r)\b/i);
  if (rel && (t.type === 'relationship' || t.type === 'person')) return rel[1].toLowerCase();
  return '';
}

/** Detect and register NEW open contradictions in the store. Returns the newly-raised ones. */
export function detectContradictions(bundle: TroveBundle, askedInSession: number): Contradiction[] {
  const active = bundle.tesserae.filter((t) => !t.superseded && !t.dusted);
  const groups = new Map<string, Tessera[]>();
  for (const t of active) {
    const key = subjectKey(t);
    if (!key || key.length < 3) continue;
    (groups.get(key) || groups.set(key, []).get(key)!).push(t);
  }

  const raised: Contradiction[] = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    // distinct, non-empty values within the same subject & compatible type
    const byValue = new Map<string, Tessera[]>();
    for (const t of group) {
      const v = valueKey(t);
      if (!v) continue;
      (byValue.get(v) || byValue.set(v, []).get(v)!).push(t);
    }
    if (byValue.size < 2) continue;

    // already tracked (open or resolved) for this subject? skip.
    const existing = bundle.contradictions.find(
      (c) => c.subject.toLowerCase().replace(LEAD, '').includes(key) || key.includes(c.subject.toLowerCase().replace(LEAD, '')),
    );
    if (existing) continue;

    const options = [...byValue.entries()].map(([value, tiles]) => ({
      value: cap(value),
      tesseraId: tiles.sort((a, b) => b.lastToldT - a.lastToldT)[0].id,
      tellings: tiles.reduce((n, t) => n + Math.max(1, t.corroborationCount), 0),
    }));
    if (options.length < 2) continue;

    const c: Contradiction = {
      id: newId('c_'),
      troveId: bundle.trove.id,
      subject: subjectLabel(group[0]),
      type: group[0].type,
      options,
      status: 'open',
      askedInSession,
      createdAt: Date.now(),
    };
    bundle.contradictions.push(c);
    raised.push(c);
  }
  return raised;
}

function subjectLabel(t: Tessera): string {
  if (t.subject) return cap(t.subject);
  // a readable label from the name head
  const head = t.name.replace(LEAD, '').split(/[\s,–-]+/).slice(0, 3).join(' ');
  return cap(head || t.name);
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

export function openContradictions(bundle: TroveBundle): Contradiction[] {
  return bundle.contradictions.filter((c) => c.status === 'open');
}
