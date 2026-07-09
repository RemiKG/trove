/* A single tessera swatch in a given state — for the surface=status ramp and legends.
   Deterministic string; safe on the server. */
import { tessera } from '@/lib/mosaic/engine';

const FILL: Record<string, number[]> = {
  set: [198, 144, 95], gild: [201, 162, 39], lit: [240, 216, 136],
  unset: [228, 219, 201], dust: [158, 151, 140],
};

export default function Swatch({
  state = 'gild',
  size = 44,
  seed = 7,
}: { state?: 'unset' | 'set' | 'gild' | 'dust' | 'lit'; size?: number; seed?: number }) {
  return (
    <span
      className="sw"
      style={{ width: size, height: size, display: 'inline-block' }}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: tessera(state, { size, seed, fill: FILL[state] }) }}
    />
  );
}
