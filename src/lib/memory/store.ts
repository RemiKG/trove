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
   Blob is a shared, strongly-consistent object store, so a stranger's own trove survives cold
   starts on the hosted URL. Activates the moment BLOB_READ_WRITE_TOKEN is set (Vercel sets it
   automatically once a Blob store is connected). `@vercel/blob` is imported dynamically so the
   file-store default never loads it. One JSON blob per trove, under the `troves/` prefix. */
class BlobStore implements TroveStore {
  private token = process.env.BLOB_READ_WRITE_TOKEN;
  private key(id: string) {
    const safe = id.replace(/[^a-zA-Z0-9_-]/g, '');
    return `troves/${safe}.json`;
  }
  private async put(key: string, body: string): Promise<void> {
    const { put } = await import('@vercel/blob');
    await put(key, body, {
      access: 'public', token: this.token, addRandomSuffix: false,
      allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 0,
    });
  }
  // Read via list()+fetch with a cache-buster + no-store so an overwritten blob is never served
  // stale from the edge CDN — recall must see the just-saved bundle.
  private async read(key: string): Promise<string | null> {
    const { list } = await import('@vercel/blob');
    const { blobs } = await list({ prefix: key, limit: 1, token: this.token });
    const hit = blobs.find((b) => b.pathname === key) || blobs[0];
    if (!hit) return null;
    const r = await fetch(`${hit.url}${hit.url.includes('?') ? '&' : '?'}v=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.text();
  }
  async list(): Promise<TroveSummary[]> {
    const { list } = await import('@vercel/blob');
    const { blobs } = await list({ prefix: 'troves/', limit: 1000, token: this.token });
    const out: TroveSummary[] = [];
    for (const b of blobs) {
      try {
        const raw = await this.read(b.pathname);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as TroveBundle;
        if (parsed?.trove?.id) out.push(summarize(parsed));
      } catch { /* skip unreadable */ }
    }
    return out.sort((a, z) => z.updatedAt - a.updatedAt);
  }
  async get(id: string): Promise<TroveBundle | null> {
    try {
      const raw = await this.read(this.key(id));
      return raw ? (JSON.parse(raw) as TroveBundle) : null;
    } catch { return null; }
  }
  async save(bundle: TroveBundle): Promise<void> {
    bundle.trove.updatedAt = Date.now();
    await this.put(this.key(bundle.trove.id), JSON.stringify(bundle));
  }
  async delete(id: string): Promise<void> {
    try {
      const { del } = await import('@vercel/blob');
      await del(this.key(id), { token: this.token });
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
