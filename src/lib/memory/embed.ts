/* The vector index Trove owns. By default this is a REAL local lexical embedding
   (the feature-hashing trick: token + bigram frequencies hashed into a fixed-dim,
   L2-normalised vector) with cosine similarity — a genuine, deterministic vector index
   that needs no credential, so budgeted recall works fully offline. When a Qwen key is
   present, `text-embedding-v4` produces richer embeddings behind the SAME interface
   (see llm/qwen.ts → embed), stored on the same field. */

export const LOCAL_DIM = 512;
export const LOCAL_MODEL = 'trove-local-hash-v1';

const STOP = new Set(
  ('a an the of to in on at for and or but if then else with without into onto from by as is are was ' +
   'were be been being it its this that these those i you he she they we me him her them us my your ' +
   'his their our do does did done has have had will would shall should can could may might must not no ' +
   'yes so than too very just about over under out up down off again once here there when where who whom ' +
   'which what why how all any both each few more most other some such only own same s t re ve ll d m').split(/\s+/),
);

function stem(w: string): string {
  // extremely light suffix trimming — enough to collapse plurals/tenses for lexical recall
  return w
    .replace(/'s$/, '')
    .replace(/(ing|edly|edness)$/, '')
    .replace(/(ed|es|ly|er)$/, '')
    .replace(/s$/, '')
    .replace(/(.)\1{2,}$/, '$1$1');
}

export function tokenize(text: string): string[] {
  const raw = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  for (const w of raw) {
    if (w.length < 2 || STOP.has(w)) continue;
    const s = stem(w);
    if (s.length < 2 || STOP.has(s)) continue;
    out.push(s);
  }
  return out;
}

// FNV-1a hash → bucket
function bucket(token: string, dim: number): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < token.length; i++) { h ^= token.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % dim;
}
// sign hash (so collisions can cancel rather than always add) — the signed hashing trick
function sign(token: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < token.length; i++) { h ^= token.charCodeAt(i) + 7; h = Math.imul(h, 16777619); }
  return (h >>> 0) & 1 ? 1 : -1;
}

/** Deterministic local embedding: unigrams + bigrams, feature-hashed and L2-normalised. */
export function localEmbed(text: string, dim = LOCAL_DIM): number[] {
  const toks = tokenize(text);
  const v = new Array(dim).fill(0);
  const add = (tok: string, w: number) => { const b = bucket(tok, dim); v[b] += sign(tok) * w; };
  for (let i = 0; i < toks.length; i++) {
    add(toks[i], 1);
    if (i > 0) add(toks[i - 1] + '_' + toks[i], 0.7); // bigram context
  }
  let norm = 0;
  for (let i = 0; i < dim; i++) { const s = v[i]; const d = Math.sign(s) * Math.log1p(Math.abs(s)); v[i] = d; norm += d * d; }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) v[i] /= norm;
  return v;
}

export function cosine(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(-1, Math.min(1, dot));
}

/** distinct query tokens — for a length-independent lexical-overlap signal. */
export function queryTokens(text: string): Set<string> {
  return new Set(tokenize(text));
}

/** share of the query's distinct tokens present in a tile's text. Complements cosine (which
    dilutes a short query against a long tile) so a distinctive keyword ("dog") lands a real hit. */
export function overlapScore(qTok: Set<string>, text: string): number {
  if (qTok.size === 0) return 0;
  const t = new Set(tokenize(text));
  let shared = 0;
  for (const q of qTok) if (t.has(q)) shared++;
  return shared / qTok.size;
}

/** The text we embed for a tessera — its type, name, detail, subject and her words. Including the
    subject lets a question about "the dog" find "Biscuit" even when the label doesn't say "dog". */
export function tesseraEmbedText(t: { type: string; name: string; detail: string; quote?: string; subject?: string; value?: string }): string {
  return `${t.type}: ${t.name}. ${t.detail}${t.subject ? ' ' + t.subject : ''}${t.value ? ' ' + t.value : ''}${t.quote ? ' ' + t.quote : ''}`;
}
