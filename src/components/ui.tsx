'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Swatch from './mosaic/Swatch';

export function Chip({ type, label }: { type: string; label: string }) {
  return (
    <span className={`chip ${type}`}>
      <i />
      {label}
    </span>
  );
}

const RAMP: { state: 'unset' | 'set' | 'gild' | 'dust' | 'lit'; nm: string }[] = [
  { state: 'unset', nm: 'unset' },
  { state: 'set', nm: 'set' },
  { state: 'gild', nm: 'gilded' },
  { state: 'dust', nm: 'dusted' },
  { state: 'lit', nm: 'lit' },
];

export function RampLegend({ size = 44 }: { size?: number }) {
  return (
    <div className="ramp">
      {RAMP.map((r) => (
        <div className="st" key={r.state}>
          <div className="sw"><Swatch state={r.state} size={size} seed={r.state.length * 7 + 3} /></div>
          <div className="nm">{r.nm}</div>
        </div>
      ))}
    </div>
  );
}

export function BrainBadge({ mode }: { mode: { brain: string; note: string } }) {
  const offline = mode.brain !== 'qwen';
  return (
    <span className={`brain-badge ${offline ? 'offline' : ''}`} title={mode.note}>
      <span className="d" />
      {offline ? 'offline brain' : 'live on Qwen Cloud'}
    </span>
  );
}

export function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="#3B2E0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" fill="#3B2E0A" stroke="none" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  );
}

/** a small formatted mono number */
export function Num({ children }: { children: React.ReactNode }) {
  return <span className="num">{children}</span>;
}

/** honest note shown ONLY on the hosted serverless mirror, where the file store is ephemeral. */
export function EphemeralNote({ mode }: { mode: { ephemeral?: boolean; durableUrl?: string | null } | null }) {
  if (!mode?.ephemeral) return null;
  return (
    <div className="card" style={{ padding: '12px 18px', marginTop: 16, borderLeft: '3px solid var(--gold-ink)' }}>
      <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>
        <b style={{ color: 'var(--grout)' }}>Hosted demo mirror.</b> This instance keeps troves on
        ephemeral serverless storage, so a trove made here may not survive between visits. The
        durable deployment keeps every trove on a real disk
        {mode.durableUrl ? <> — <a href={mode.durableUrl} style={{ color: 'var(--gold-ink)' }}>{mode.durableUrl.replace(/^https?:\/\//, '')}</a></> : null}.
      </p>
    </div>
  );
}

/** a visible dead-end instead of an endless spinner when a trove can't be loaded. */
export function LoadFailed() {
  const [mode, setMode] = useState<any>(null);
  useEffect(() => {
    fetch('/api/mode').then((r) => r.json()).then(setMode).catch(() => {});
  }, []);
  return (
    <div className="page"><div className="stage"><div className="wrap section" style={{ maxWidth: 620, paddingTop: 100 }}>
      <div className="card pad">
        <div className="h-emo" style={{ fontSize: 26, marginBottom: 10 }}>This trove couldn’t be opened.</div>
        <p className="muted" style={{ fontSize: 15.5, lineHeight: 1.55, margin: 0 }}>
          {mode?.ephemeral
            ? 'This hosted mirror keeps troves on ephemeral serverless storage, so a trove made here can be lost between visits. Nothing you can do differently — it’s a limit of the mirror, not of Trove.'
            : 'It may have been removed, or the link is wrong.'}
        </p>
        {mode?.ephemeral && mode?.durableUrl && (
          <p className="muted" style={{ fontSize: 15.5, lineHeight: 1.55, marginTop: 10 }}>
            The durable deployment keeps every trove on a real disk:{' '}
            <a href={mode.durableUrl} style={{ color: 'var(--gold-ink)' }}>{mode.durableUrl.replace(/^https?:\/\//, '')}</a>
          </p>
        )}
        <div style={{ marginTop: 18 }}>
          <Link className="btn ghost" href="/">← Back to the door</Link>
        </div>
      </div>
    </div></div></div>
  );
}
