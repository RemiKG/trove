'use client';
/* The living portrait — a life reconstructed as a photomosaic, seed-locked so the same person
   renders the same face on every recall. Client-only (the base face is drawn to an offscreen
   <canvas>, then sampled + palette-snapped). Recomputes only when its inputs change. */
import { useEffect, useRef, useState, useMemo } from 'react';
import { portrait } from '@/lib/mosaic/engine';

export interface LitTile { x: number; y: number; r?: number }

export default function Portrait({
  seed = 42,
  coverage = 1,
  w = 760,
  h = 920,
  tile = 16,
  lit,
  dust,
  className = '',
  style,
}: {
  seed?: number; coverage?: number; w?: number; h?: number; tile?: number;
  lit?: LitTile[]; dust?: LitTile[]; className?: string; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  // stable key so we only re-render the SVG when a real input changes
  const key = useMemo(
    () => JSON.stringify({ seed, coverage, w, h, tile, lit, dust }),
    [seed, coverage, w, h, tile, lit, dust],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // next frame so layout settles; portrait() is pure + deterministic
    const id = requestAnimationFrame(() => {
      el.innerHTML = portrait({ seed, coverage, w, h, tile, lit, dust });
      setReady(true);
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div
      ref={ref}
      className={`portrait ${ready ? 'is-ready' : ''} ${className}`}
      style={{ aspectRatio: `${w} / ${h}`, background: '#3B322A', ...style }}
      suppressHydrationWarning
      aria-label="A memorial mosaic portrait, assembled tessera by tessera"
      role="img"
    />
  );
}
