/* The persistent life-memory store Trove OWNS.
   Default adapter: a file-backed store (one JSON bundle per trove) that genuinely survives a
   closed tab, a fresh browser, and a cold model context — for years. It is deliberately
   decoupled behind `TroveStore` so a Postgres/pgvector adapter drops in for serverless /
   multi-instance deploys (e.g. Alibaba Cloud RDS, Neon) via DATABASE_URL. We own the store
   rather than lean on Qwen's server-side memory precisely because Qwen's conversation items
   expire after 7 days — fatal for an archive meant to outlive a person. */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { TroveBundle, Tessera } from './types';

export interface TroveSummary {
  id: string;
  personName: string;
  fullName: string;
  relationship: string;
  seed: number;
  bornYear?: number;
  diedYear?: number;
  currentSession: number;
  turnCount: number;
  tesseraeSet: number;
  gilded: number;
  dusted: number;
  openContradictions: number;
  updatedAt: number;
  lastOpenedAt: number;
  example: boolean;
}

export interface TroveStore {
  list(): Promise<TroveSummary[]>;
  get(id: string): Promise<TroveBundle | null>;
  save(bundle: TroveBundle): Promise<void>;
  delete(id: string): Promise<void>;
}

export function newId(prefix = ''): string {
  return prefix + crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}

export function summarize(b: TroveBundle): TroveSummary {
  const live = b.tesserae.filter((t) => !t.superseded);
  return {
    id: b.trove.id,
    personName: b.trove.personName,
    fullName: b.trove.fullName,
    relationship: b.trove.relationship,
    seed: b.trove.seed,
    bornYear: b.trove.bornYear,
    diedYear: b.trove.diedYear,
    currentSession: b.trove.currentSession,
    turnCount: b.trove.turnCount,
    tesseraeSet: live.filter((t) => !t.dusted).length,
    gilded: live.filter((t) => t.canonical && !t.dusted).length,
    dusted: b.tesserae.filter((t) => t.dusted && !t.superseded).length,
    openContradictions: b.contradictions.filter((c) => c.status === 'open').length,
    updatedAt: b.trove.updatedAt,
    lastOpenedAt: b.trove.lastOpenedAt,
    example: !!b.trove.example,
  };
}

class FileStore implements TroveStore {
  private dir: string;
  private ready: Promise<void>;

  constructor(dir: string) {
    this.dir = dir;
    this.ready = fs.mkdir(dir, { recursive: true }).then(() => undefined);
  }

  private file(id: string) {
    // guard against path traversal from a trove id
    const safe = id.replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(this.dir, `${safe}.json`);
  }

  async list(): Promise<TroveSummary[]> {
    await this.ready;
    let names: string[];
    try {
      names = await fs.readdir(this.dir);
    } catch {
      return [];
    }
    const out: TroveSummary[] = [];
    for (const n of names) {
      if (!n.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(this.dir, n), 'utf8');
        const b = JSON.parse(raw) as TroveBundle;
        if (b?.trove?.id) out.push(summarize(b));
      } catch {
        /* skip unreadable / partial files */
      }
    }
    return out.sort((a, z) => z.updatedAt - a.updatedAt);
  }

  async get(id: string): Promise<TroveBundle | null> {
    await this.ready;
    try {
      const raw = await fs.readFile(this.file(id), 'utf8');
      return JSON.parse(raw) as TroveBundle;
    } catch {
      return null;
    }
  }

  async save(bundle: TroveBundle): Promise<void> {
    await this.ready;
    bundle.trove.updatedAt = Date.now();
    const target = this.file(bundle.trove.id);
    const tmp = `${target}.tmp-${crypto.randomUUID().slice(0, 8)}`;
    const data = JSON.stringify(bundle);
    await fs.writeFile(tmp, data, 'utf8');
    await fs.rename(tmp, target); // atomic on the same volume
  }

  async delete(id: string): Promise<void> {
    await this.ready;
    try { await fs.unlink(this.file(id)); } catch { /* ignore */ }
  }
}

/* Postgres adapter — the durable store for serverless / multi-instance deploys (Alibaba Cloud
   RDS for PostgreSQL, Neon, etc.). Activates the moment DATABASE_URL is set. Stores each trove
   bundle as one jsonb row. `pg` is imported dynamically so the file-store default needs no
   native deps. */
class PgStore implements TroveStore {
  private pool: any;
  private ready: Promise<void>;
  constructor(url: string) {
    this.ready = this.init(url);
  }
  private async init(url: string) {
    const pg: any = await import('pg');
    const Pool = pg.Pool || pg.default?.Pool;
    const ssl = /sslmode=require/.test(url) || !/localhost|127\.0\.0\.1/.test(url) ? { rejectUnauthorized: false } : undefined;
    this.pool = new Pool({ connectionString: url, max: 3, ssl });
    await this.pool.query('CREATE TABLE IF NOT EXISTS trove_troves (id text primary key, updated_at bigint, bundle jsonb not null)');
  }
  async list(): Promise<TroveSummary[]> {
    await this.ready;
    const r = await this.pool.query('select bundle from trove_troves order by updated_at desc');
    return r.rows.map((row: any) => summarize(row.bundle as TroveBundle)).filter((s: TroveSummary) => s.id);
  }
  async get(id: string): Promise<TroveBundle | null> {
    await this.ready;
    const r = await this.pool.query('select bundle from trove_troves where id = $1', [id]);
    return (r.rows[0]?.bundle as TroveBundle) ?? null;
  }
  async save(bundle: TroveBundle): Promise<void> {
    await this.ready;
    bundle.trove.updatedAt = Date.now();
    await this.pool.query(
      'insert into trove_troves (id, updated_at, bundle) values ($1, $2, $3::jsonb) on conflict (id) do update set updated_at = excluded.updated_at, bundle = excluded.bundle',
      [bundle.trove.id, bundle.trove.updatedAt, JSON.stringify(bundle)],
    );
  }
  async delete(id: string): Promise<void> {
    await this.ready;
    await this.pool.query('delete from trove_troves where id = $1', [id]);
  }
}

/* Vercel Blob adapter — the durable store for the serverless Vercel deploy. Serverless splits
   route handlers and renders across separate function instances that do NOT share a /tmp disk,
   so the file store loses a fresh trove between the create request and the very next telling.
   Activates the moment BLOB_READ_WRITE_TOKEN is set (Vercel sets it automatically once a Blob
   store is connected). `@vercel/blob` is imported dynamically so the file-store default never
   loads it.

   CONSISTENCY — this is the load-bearing part. Vercel Blob is NOT read-after-write consistent
   when you OVERWRITE a blob at a fixed pathname: per Vercel's docs an overwrite "may take up to
   60 seconds to propagate", and public reads go through the CDN. A single `troves/<id>.json`
   blob rewritten on every save therefore lets a later read (a cold instance, the mosaic view,
   the next telling) see a stale — often the empty just-created — bundle. Worse, any read that
   then writes back (bumping lastOpenedAt) persisted that stale bundle and permanently dropped
   every memory. Two writers racing on the same blob also lose updates outright.

   The fix follows Vercel's own guidance to TREAT BLOBS AS IMMUTABLE: every save writes a brand
   new, never-overwritten snapshot at `troves/<id>/<rev>-<rand>.json`. Immutable blobs have no
   overwrite-propagation window, so reading one back is consistent. A read reconstructs the
   trove by listing that trove's snapshots and taking the highest `rev`; the freshest of
   {in-memory cache, store} is chosen by the loader (see loadBundle), so a lagging `list()` can
   never surface an older-than-cache snapshot. Old snapshots are pruned best-effort. */
class BlobStore implements TroveStore {
  private token = process.env.BLOB_READ_WRITE_TOKEN;
  private static lastStamp = 0;

  private safe(id: string) { return id.replace(/[^a-zA-Z0-9_-]/g, ''); }
  private prefix(id: string) { return `troves/${this.safe(id)}/`; }
  private snapKey(id: string, rev: number) {
    return `${this.prefix(id)}${String(rev).padStart(12, '0')}-${crypto.randomUUID().slice(0, 8)}.json`;
  }
  /** parse the rev encoded as the leading, zero-padded number of a snapshot filename. */
  private revOf(pathname: string): number {
    const file = pathname.split('/').pop() || '';
    const n = parseInt(file.split('-')[0], 10);
    return Number.isFinite(n) ? n : 0;
  }
  private cacheBust(url: string) { return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`; }

  private async put(key: string, body: string): Promise<void> {
    const { put } = await import('@vercel/blob');
    await put(key, body, {
      access: 'public', token: this.token, addRandomSuffix: false,
      allowOverwrite: false, contentType: 'application/json', cacheControlMaxAge: 0,
    });
  }
  private async fetchText(url: string): Promise<string | null> {
    const r = await fetch(this.cacheBust(url), { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.text();
  }
  /** the freshest snapshot blob for a trove (highest rev; uploadedAt breaks ties). */
  private async latestBlob(id: string): Promise<{ url: string; rev: number } | null> {
    const { list } = await import('@vercel/blob');
    const { blobs } = await list({ prefix: this.prefix(id), limit: 1000, token: this.token });
    let best: { url: string; rev: number; at: number } | null = null;
    for (const b of blobs) {
      const rev = this.revOf(b.pathname);
      const at = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
      if (!best || rev > best.rev || (rev === best.rev && at > best.at)) best = { url: b.url, rev, at };
    }
    return best ? { url: best.url, rev: best.rev } : null;
  }
  /** delete every snapshot for a trove older than the newest two revs — best effort. */
  private async prune(id: string, keepFromRev: number): Promise<void> {
    try {
      const { list, del } = await import('@vercel/blob');
      const { blobs } = await list({ prefix: this.prefix(id), limit: 1000, token: this.token });
      const stale = blobs.filter((b) => this.revOf(b.pathname) <= keepFromRev - 2).map((b) => b.url);
      if (stale.length) await del(stale, { token: this.token });
    } catch { /* pruning is optional; leftover snapshots are harmless */ }
  }

  async list(): Promise<TroveSummary[]> {
    const { list } = await import('@vercel/blob');
    const { blobs } = await list({ prefix: 'troves/', limit: 1000, token: this.token });
    // group by trove id, keep the highest-rev snapshot of each
    const newest = new Map<string, { url: string; rev: number; at: number }>();
    for (const b of blobs) {
      const parts = b.pathname.split('/'); // ['troves', <id>, '<rev>-<rand>.json']
      if (parts.length < 3) continue;
      const id = parts[1];
      const rev = this.revOf(b.pathname);
      const at = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
      const cur = newest.get(id);
      if (!cur || rev > cur.rev || (rev === cur.rev && at > cur.at)) newest.set(id, { url: b.url, rev, at });
    }
    const out: TroveSummary[] = [];
    for (const { url } of newest.values()) {
      try {
        const raw = await this.fetchText(url);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as TroveBundle;
        if (parsed?.trove?.id) out.push(summarize(parsed));
      } catch { /* skip unreadable */ }
    }
    return out.sort((a, z) => z.updatedAt - a.updatedAt);
  }
  async get(id: string): Promise<TroveBundle | null> {
    try {
      const hit = await this.latestBlob(id);
      if (!hit) return null;
      const raw = await this.fetchText(hit.url);
      return raw ? (JSON.parse(raw) as TroveBundle) : null;
    } catch { return null; }
  }
  async save(bundle: TroveBundle): Promise<void> {
    // strictly-increasing stamp so two saves in the same millisecond still order deterministically
    const now = Math.max(Date.now(), BlobStore.lastStamp + 1);
    BlobStore.lastStamp = now;
    bundle.trove.updatedAt = now;
    const rev = (bundle.trove.rev ?? 0) || 1;
    await this.put(this.snapKey(bundle.trove.id, rev), JSON.stringify(bundle));
    await this.prune(bundle.trove.id, rev);
  }
  async delete(id: string): Promise<void> {
    try {
      const { list, del } = await import('@vercel/blob');
      const { blobs } = await list({ prefix: this.prefix(id), limit: 1000, token: this.token });
      const urls = blobs.map((b) => b.url);
      if (urls.length) await del(urls, { token: this.token });
    } catch { /* ignore */ }
  }
}

let _store: TroveStore | null = null;

export function getStore(): TroveStore {
  if (_store) return _store;
  if (process.env.DATABASE_URL) {
    _store = new PgStore(process.env.DATABASE_URL);
  } else if (process.env.BLOB_READ_WRITE_TOKEN) {
    _store = new BlobStore();
  } else {
    const dir = path.resolve(process.env.TROVE_DATA_DIR || './.trove-data');
    _store = new FileStore(dir);
  }
  return _store;
}

export function tesseraById(bundle: TroveBundle, id: string): Tessera | undefined {
  return bundle.tesserae.find((t) => t.id === id);
}
