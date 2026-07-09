'use client';
/* Typed fetch helpers for the UI. No hardcoded host — always same-origin relative paths. */
import type { TroveView } from '../server/view';

async function jf<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  if (!res.ok) throw new Error((await res.text().catch(() => '')) || `${res.status}`);
  return res.json() as Promise<T>;
}

export type { TroveView };

export interface TroveSummary {
  id: string; personName: string; fullName: string; relationship: string; seed: number;
  bornYear?: number; diedYear?: number; currentSession: number; tesseraeSet: number;
  gilded: number; dusted: number; openContradictions: number; example: boolean; lastOpenedAt: number;
}

export const api = {
  mode: () => jf<any>('/api/mode'),
  listTroves: () => jf<{ troves: TroveSummary[] }>('/api/troves'),
  ensureExample: () => jf<{ id: string; view: TroveView }>('/api/example'),
  resetExample: () => jf<{ id: string }>('/api/example', { method: 'POST' }),
  createTrove: (personName: string, relationship?: string, fullName?: string) =>
    jf<{ id: string }>('/api/troves', { method: 'POST', body: JSON.stringify({ personName, relationship, fullName }) }),
  deleteTrove: (id: string) => jf<{ ok: boolean }>(`/api/troves/${id}`, { method: 'DELETE' }),
  view: (id: string) => jf<TroveView>(`/api/troves/${id}`),
  telling: (id: string, text: string) => jf<any>(`/api/troves/${id}/telling`, { method: 'POST', body: JSON.stringify({ text }) }),
  ask: (id: string, question: string, memoryOn?: boolean) =>
    jf<any>(`/api/troves/${id}/ask`, { method: 'POST', body: JSON.stringify({ question, memoryOn }) }),
  reconcile: (id: string, contradictionId: string, value: string) =>
    jf<any>(`/api/troves/${id}/reconcile`, { method: 'POST', body: JSON.stringify({ contradictionId, value }) }),
  tessera: (id: string, tid: string, action: 'gild' | 'lift' | 'brush') =>
    jf<any>(`/api/troves/${id}/tessera/${tid}`, { method: 'POST', body: JSON.stringify({ action }) }),
  settings: (id: string, body: { forgetting?: number; memoryOn?: boolean }) =>
    jf<any>(`/api/troves/${id}/settings`, { method: 'POST', body: JSON.stringify(body) }),
  previewForget: (id: string, forgetting: number) =>
    jf<{ preview: { dusted: number; gilded: number; set: number } }>(`/api/troves/${id}/settings?forgetting=${forgetting}`),
  proof: (id: string, q?: string) => jf<any>(`/api/troves/${id}/proof${q ? `?q=${encodeURIComponent(q)}` : ''}`),
};

export function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

export function relTime(ms: number): string {
  const d = Date.now() - ms;
  const day = 86400000;
  if (d < day) return 'today';
  const days = Math.round(d / day);
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 9) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

export function whoSub(v: TroveView): string {
  return `her trove · ${v.trove.currentSession} sessions · last opened ${relTime(v.trove.lastOpenedAt)}`;
}
