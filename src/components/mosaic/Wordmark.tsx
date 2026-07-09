/* The Trove wordmark — "Tr[o]ve", the "o" a single hand-cut gilded tessera. Deterministic
   (seeded), so it renders identically on server and client. Legibility of the word always wins;
   the tile sits at the x-height. */
import { wordO } from '@/lib/mosaic/engine';

export default function Wordmark({
  size = 30,
  reverse = false,
  seed = 9,
  className = '',
}: { size?: number; reverse?: boolean; seed?: number; className?: string }) {
  return (
    <span className={`wm ${reverse ? 'rev' : ''} ${className}`} style={{ fontSize: size }} aria-label="Trove">
      Tr
      <span className="wm-o" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: wordO({ size: 120, seed, reverse }) }} />
      ve
    </span>
  );
}
