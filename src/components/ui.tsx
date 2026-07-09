'use client';
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
