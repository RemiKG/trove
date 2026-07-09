/* The restorer's-brush glyph — the one permitted "character," a tool not a mascot. Used on the
   "brush off the dust" (restore) action. Deterministic string. */
import { brush } from '@/lib/mosaic/engine';

export default function BrushGlyph({ size = 22 }: { size?: number }) {
  return (
    <span
      style={{ width: size, height: size, display: 'inline-flex' }}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: brush({ size }) }}
    />
  );
}
