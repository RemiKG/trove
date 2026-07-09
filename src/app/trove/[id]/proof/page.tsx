'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { LoadFailed } from '@/components/ui';
import { api, fmt, whoSub, type TroveView } from '@/lib/client/api';

export default function ProofPage() {
  const { id } = useParams<{ id: string }>();
  const [view, setView] = useState<TroveView | null>(null);
  const [proof, setProof] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run() {
    setRunning(true);
    try { setProof(await api.proof(id)); } catch { /* the view failure screen covers a missing trove */ } finally { setRunning(false); }
  }
  useEffect(() => { api.view(id).then(setView).catch(() => setFailed(true)); run(); /* eslint-disable-next-line */ }, [id]);

  if (failed) return <LoadFailed />;
  if (!view) return <div className="page"><div className="wrap section" style={{ textAlign: 'center', paddingTop: 120 }}><span className="spinner" style={{ width: 28, height: 28 }} /></div></div>;
  const t = view.trove;
  const on = proof?.on, off = proof?.off;

  return (
    <div className="page">
      <div className="grain soft" />
      <div className="stage">
        <TopBar troveId={id} who={{ personName: t.personName, seed: t.seed, sub: whoSub(view) }} />
        <div className="wrap section" style={{ textAlign: 'center' }}>
          <div className="eyebrow">A live proof you can run</div>
          <h1 className="h-emo" style={{ fontSize: 'clamp(34px,5vw,50px)', margin: '12px 0 10px' }}>The same trove. One flip.</h1>
          <p className="muted" style={{ maxWidth: 620, margin: '0 auto', fontSize: 16, lineHeight: 1.5 }}>
            Ask {t.personName}’s trove the same question with memory <b>off</b>, then <b>on</b>. The
            difference is the entire value of the track, in thirty seconds.
          </p>
          {proof && <div className="tag-mono" style={{ marginTop: 12 }}>question: <span style={{ color: 'var(--grout-70)' }}>{proof.question}</span> &nbsp;·&nbsp; <button className="iconbtn" style={{ padding: '3px 10px' }} onClick={run} disabled={running}>{running ? 'running…' : 'run again ↻'}</button></div>}

          <div className="grid-2" style={{ marginTop: 34, textAlign: 'left', gap: 'clamp(18px,3vw,34px)' }}>
            {/* OFF */}
            <div className="card sunk pad" style={{ background: 'color-mix(in srgb, var(--ash) 12%, var(--plaster-lo))' }}>
              <div className="between" style={{ marginBottom: 18 }}>
                <span className="carved" style={{ letterSpacing: '.14em', fontSize: 15, color: 'var(--grout-60)' }}>Memory — off</span>
                <div className="mtoggle"><span className="seg">ON</span><span className="seg off-on">OFF</span></div>
              </div>
              {off && (
                <>
                  <Lines lines={off.lines} muted />
                  <hr className="hair" style={{ margin: '14px 0' }} />
                  <div className="readout">
                    <div className="r"><span>questions re-asked</span><b>{off.questionsReasked}</b></div>
                    <div className="r"><span>contradictions caught</span><b>{off.reconciled}</b></div>
                    <div className="r"><span>recall</span><b>replayed the whole transcript · {fmt(off.tokens)} tok</b></div>
                  </div>
                </>
              )}
            </div>

            {/* ON */}
            <div className="card gold-edge pad">
              <div className="between" style={{ marginBottom: 18 }}>
                <span className="carved" style={{ letterSpacing: '.14em', fontSize: 15, color: 'var(--gold-ink)' }}>Memory — on</span>
                <div className="mtoggle"><span className="seg on">ON</span><span className="seg">OFF</span></div>
              </div>
              {on && (
                <>
                  <Lines lines={on.lines} />
                  <hr className="hair" style={{ margin: '14px 0' }} />
                  <div className="readout">
                    <div className="r"><span>questions re-asked</span><b>0</b></div>
                    <div className="r"><span>contradictions reconciled</span><b className="gold">{on.reconciled} → truth</b></div>
                    <div className="r"><span>recall</span><b className="gold">gilded canon · {fmt(on.tokens)} tok</b></div>
                  </div>
                </>
              )}
            </div>
          </div>

          <p className="quote" style={{ fontStyle: 'italic', textAlign: 'center', marginTop: 34, fontSize: 22, color: 'var(--grout-70)' }}>
            Persistence · reconciliation · timely forgetting — together, or it isn’t memory.
          </p>
        </div>
      </div>
    </div>
  );
}

function Lines({ lines, muted }: { lines: string[]; muted?: boolean }) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      {lines.map((l: string, i: number) => (
        <div key={i} style={{ display: 'flex', gap: 12 }}>
          <span className="dot" style={{ marginTop: 8, flex: 'none', background: muted ? 'var(--ash)' : 'var(--gold)', boxShadow: muted ? 'none' : 'var(--glint-sm)' }} />
          <span className={i === 0 ? 'inscription' : ''} style={i === 0 ? { border: 0, padding: 0, fontSize: 19, color: muted ? 'var(--grout-45)' : 'var(--grout)' } : { fontSize: 15, color: 'var(--grout-60)', lineHeight: 1.45 }}>{l}</span>
        </div>
      ))}
    </div>
  );
}
