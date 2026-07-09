/* The shared SVG <defs> (gold-leaf gradients, glint/dust filters, plaster grain) that every
   mosaic SVG references by id. Mounted once at the app root. Deterministic string → safe to
   render on the server; no hydration mismatch. */
import { defs } from '@/lib/mosaic/engine';

export default function MosaicDefs() {
  return <div aria-hidden suppressHydrationWarning dangerouslySetInnerHTML={{ __html: defs() }} />;
}
