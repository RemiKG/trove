'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import Swatch from '@/components/mosaic/Swatch';
import BrushGlyph from '@/components/mosaic/BrushCursor';
import { Chip, LoadFailed } from '@/components/ui';
import { api, fmt, type TroveView } from '@/lib/client/api';

export default function RestorationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [view, setView] = useState<TroveView | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [contras, setContras] = useState<any[]>([]);
  const [forgetting, setForgetting] = useState(0.55);
  const [preview, setPreview] = useState<any>(null);
  const [memoryOn, setMemoryOn] = useState(true);
  const [tools, setTools] = useState<any[]>([]);
  const [failed, setFailed] = useState(false);
  const pvT = useRef<any>(null);

  useEffect(() => {
    api.view(id).then((v) => {
      setView(v); setRows(v.rows); setTotals(v.totals); setContras(v.contradictions);
      setForgetting(v.trove.settings.forgetting); setMemoryOn(v.trove.settings.memoryOn);
      setPreview({ dusted: v.totals.dusted, gilded: v.totals.gilded });
      setTools(v.toolLog);
    }).catch(() => setFailed(true));
  }, [id]);

  async function act(tid: string, action: 'gild' | 'lift' | 'brush') {
    const r = await api.tessera(id, tid, action);
    setRows((rs) => rs.map((row) => row.id === tid ? { ...row, canonical: r.tile.canonical, dusted: r.tile.dusted, status: r.tile.status } : row));
    setTotals(r.totals);
  }
  async function resolve(cId: string, value: string) {
    const r = await api.reconcile(id, cId, value);
    setContras(r.contradictions); setTotals(r.totals);
    // reflect the gilded/dusted change in the rows
    api.view(id).then((v) => setRows(v.rows));
  }
  function onSlide(val: number) {
    setForgetting(val);
    clearTimeout(pvT.current);
    pvT.current = setTimeout(async () => {
      const r = await api.previewForget(id, val);
      setPreview({ dusted: r.preview.dusted, gilded: r.preview.gilded });
    }, 120);
  }
  async function commitForget() {
    const r = await api.settings(id, { forgetting });
    setTotals(r.totals); setPreview({ dusted: r.totals.dusted, gilded: r.totals.gilded });
    api.view(id).then((v) => setRows(v.rows));
  }
  async function toggleMemory(on: boolean) {
    setMemoryOn(on);
    await api.settings(id, { memoryOn: on });
  }

  if (failed) return <LoadFailed />;
  if (!view || !totals) return <div className="page"><div className="wrap section" style={{ textAlign: 'center', paddingTop: 120 }}><span className="spinner" style={{ width: 28, height: 28 }} /></div></div>;
  const t = view.trove;

  return (
    <div className="page">
      <div className="grain soft" />
      <div className="stage">
        <TopBar active="restoration" troveId={id} who={{ personName: t.personName, seed: t.seed, sub: 'her trove · power-user room' }} />
        <div className="wrap section">
          <div className="eyebrow">The Restoration</div>
          <h1 className="h-emo" style={{ fontSize: 'clamp(34px,5vw,46px)', margin: '10px 0 12px' }}>Tend the mosaic.</h1>
          <p className="muted" style={{ maxWidth: 720, fontSize: 16, lineHeight: 1.55 }}>
            Nothing about the model is hidden. Watch Trove remember, reconcile, and forget — and
            overrule it by hand. Gild what matters, lift what shouldn’t be kept, brush the dust off
            what you want back. Nothing is ever destroyed.
          </p>

          <div className="grid-2" style={{ gridTemplateColumns: '1.35fr 1fr', marginTop: 26, alignItems: 'start' }}>
            {/* Left: table + tool log */}
            <div className="stack" style={{ gap: 20 }}>
              <div className="card pad">
                <div className="between" style={{ marginBottom: 8 }}>
                  <span className="label-mono">Every tessera she holds · sorted by corroboration</span>
                  <span className="label-mono" style={{ textTransform: 'none' }}>{fmt(view.rowsTotal)} total</span>
                </div>
                <div className="trow head"><span /><span>Memory</span><span>Type</span><span>Told</span><span className="col-hide">Salience</span><span /></div>
                <div className="stack" style={{ gap: 8, maxHeight: '52vh', overflowY: 'auto' }}>
                  {rows.map((r) => (
                    <div key={r.id} className={`trow z ${r.dusted ? 'dusted' : ''}`}>
                      <span className="cchip"><Swatch state={r.status} size={34} seed={r.id.length * 3 + 5} /></span>
                      <span className="mem">{r.name}</span>
                      <span className="col-hide"><Chip type={r.type} label={r.type} /></span>
                      <span className="corr col-hide">×{r.corroborationCount}</span>
                      <span className="salbar col-hide"><i style={{ width: `${Math.round(r.salience * 100)}%` }} /></span>
                      <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {r.dusted ? (
                          <button className="iconbtn" onClick={() => act(r.id, 'brush')}><BrushGlyph size={16} /> Brush off</button>
                        ) : r.canonical ? (
                          <span className="pill-gild">✦ gilded</span>
                        ) : (
                          <>
                            <button className="iconbtn gild" onClick={() => act(r.id, 'gild')}>Gild</button>
                            <button className="iconbtn" onClick={() => act(r.id, 'lift')}>Lift</button>
                          </>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card pad">
                <div className="between" style={{ marginBottom: 10 }}>
                  <span className="label-mono">Exposed as a tool surface · custom Qwen Skill + MCP server</span>
                  <span className="label-mono" style={{ textTransform: 'none', color: 'var(--gold-ink)' }}>● trove-memory · sse · live</span>
                </div>
                <div className="toollog">
                  {tools.map((l, i) => (
                    <div key={i}><span className="fn">{l.fn}</span>(<span className="ar">{l.args}</span>) <span className="ar">→</span> <span className="g">{l.result}</span></div>
                  ))}
                </div>
                <div className="label-mono" style={{ textTransform: 'none', marginTop: 10 }}>
                  remember · recall · reconcile · next-question · gild · forget — any agent can call her memory.
                </div>
              </div>
            </div>

            {/* Right: contradictions, forgetting, memory, export */}
            <div className="stack" style={{ gap: 18 }}>
              <div className="card pad">
                <div className="between" style={{ marginBottom: 12 }}>
                  <span className="label-mono">Open contradictions</span>
                  <span className="label-mono" style={{ textTransform: 'none' }}>{contras.length} waiting</span>
                </div>
                {contras.length === 0 && <div className="muted" style={{ fontSize: 14 }}>None waiting — every telling reconciled.</div>}
                {contras.map((c) => (
                  <div key={c.id} className="catch" style={{ marginBottom: 10 }}>
                    <div className="lead"><b>{c.subject}</b> — {c.options.map((o: any) => o.value).join(' vs ')}</div>
                    <div className="tag-mono" style={{ margin: '6px 0' }}>held side by side · never silently merged</div>
                    <div className="pick">
                      {c.options.map((o: any) => <button key={o.value} className="opt" onClick={() => resolve(c.id, o.value)}>{o.value}</button>)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="card pad">
                <div className="label-mono" style={{ marginBottom: 4 }}>Forgetting policy</div>
                <div className="h-emo" style={{ fontSize: 22, margin: '4px 0 16px' }}>How aggressively should the mosaic forget?</div>
                <div className="slider">
                  <input type="range" min={0} max={1} step={0.01} value={forgetting}
                    onChange={(e) => onSlide(Number(e.target.value))} onMouseUp={commitForget} onTouchEnd={commitForget} />
                  <span className="knob" style={{ left: `${forgetting * 100}%` }} />
                </div>
                <div className="between" style={{ marginTop: 8 }}>
                  <span className="label-mono" style={{ textTransform: 'none' }}>Keep everything</span>
                  <span className="label-mono" style={{ textTransform: 'none' }}>Gild only the corroborated</span>
                </div>
                <div className="readout" style={{ marginTop: 14 }}>
                  <div className="r"><span>at this setting → dusted</span><b>{fmt(preview?.dusted ?? totals.dusted)}</b></div>
                  <div className="r"><span>gilded · kept forever</span><b className="gold">{fmt(preview?.gilded ?? totals.gilded)}</b></div>
                  <div className="r"><span>forgetting-precision</span><b>{totals.forgettingPrecision.toFixed(2)}</b></div>
                </div>
                <div className="tag-mono" style={{ marginTop: 10 }}>No memory is destroyed — a dusted tile can always be brushed back.</div>
              </div>

              <div className="card pad">
                <div className="between">
                  <div style={{ maxWidth: '62%' }}>
                    <div className="label-mono" style={{ marginBottom: 6 }}>Memory</div>
                    <div className="muted" style={{ fontSize: 14, lineHeight: 1.45 }}>Turn it <b>off</b> and Trove becomes a plain recorder — no persistence, no reconciliation, no budgeted recall. <Link href={`/trove/${id}/proof`} style={{ color: 'var(--gold-ink)' }}>Flip it to feel the difference →</Link></div>
                  </div>
                  <div className="mtoggle" role="switch" aria-checked={memoryOn}>
                    <span className={`seg ${memoryOn ? 'on' : ''}`} onClick={() => toggleMemory(true)}>ON</span>
                    <span className={`seg ${!memoryOn ? 'off-on' : ''}`} onClick={() => toggleMemory(false)}>OFF</span>
                  </div>
                </div>
              </div>

              <div className="card gold-edge pad">
                <div className="label-mono" style={{ marginBottom: 6 }}>When you’re ready</div>
                <div className="h-emo" style={{ fontSize: 24, marginBottom: 6 }}>Hand it to family.</div>
                <p className="muted" style={{ fontSize: 14.5, lineHeight: 1.5, marginTop: 0 }}>
                  Export the finished portrait and her life, in her own words — a keepsake the family passes around.
                </p>
                <button className="btn gold" onClick={() => router.push(`/trove/${id}/keepsake`)}>Make a keepsake →</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
