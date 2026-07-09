'use client';
/* Download the seed-locked portrait as a PNG — the same face that's on screen (persistence made
   visible). Builds a self-contained SVG (the shared <defs> inlined so gold-leaf gradients survive)
   and rasterises it at 2×. */
import { defs, portrait } from '@/lib/mosaic/engine';

function inner(svg: string): string {
  return svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
}

export async function downloadPortraitPNG(seed: number, filename: string, coverage = 1): Promise<void> {
  const W = 760, H = 920;
  const pSvg = portrait({ seed, coverage, w: W, h: H, tile: 14 });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${inner(defs())}${inner(pSvg)}</svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'sync';
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('svg load')); img.src = url; });
    const scale = 2;
    const cv = document.createElement('canvas');
    cv.width = W * scale; cv.height = H * scale;
    const ctx = cv.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, W, H);
    await new Promise<void>((res) => cv.toBlob((b) => {
      if (b) { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
      res();
    }, 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function copyLink(): Promise<boolean> {
  try { await navigator.clipboard.writeText(window.location.href); return true; } catch { return false; }
}
