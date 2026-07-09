'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import TopBar from '@/components/TopBar';
import Portrait from '@/components/mosaic/Portrait';
import { Chip, RampLegend, LoadFailed } from '@/components/ui';
import { api, fmt, whoSub, type TroveView } from '@/lib/client/api';

const CHIP_LABEL: Record<string, string> = {
  person: 'person', place: 'place', event: 'event', date: 'date',
  object: 'object', saying: 'saying', value: 'value', relationship: 'relationship',
};

export default function MosaicPage() {
  const { id } = useParams<{ id: string }>();
  const [view, setView] = useState<TroveView | null>(null);
  const [q, setQ] = useState('');
  const [ans, setAns] = useState<any>(null);
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  const auto = useRef(false);

  useEffect(() => {
    api.view(id).then((v) => {
      setView(v);
      if (v.trove.example && !auto.current) {
        auto.current = true;
        const dq = "What was the name of Nana's dog?";
        setQ(dq);
        doAsk(dq);
      }
    }).catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function doAsk(question: string) {
    if (!question.trim()) return;
    setAsking(true);
    try {
      setAns(await api.ask(id, question));
    } catch {
      setAns({ error: true, answer: 'That question didn’t make it through — the recall call failed. Please ask again.' });
    } finally { setAsking(false); }
  }

  if (failed) return <LoadFailed />;
  if (!view) return <Loading />;
  const t = view.trove;
  const occ = t.occasion;
  const om = (t as any).occasionMeta;
  const tile = ans?.answerTile;
  const lit = tile?.lit ? [tile.lit] : undefined;

  return (
    <div className="page">
      <div className="grain soft" />
      <div className="stage">
        <TopBar active="mosaic" troveId={id} who={{ personName: t.personName, seed: t.seed, sub: whoSub(view) }} />
        <div className="wrap section">
          {occ && (
            <div className="card gold-edge between" style={{ padding: '16px 22px', marginBottom: 22, alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 7, overflow: 'hidden' }}>
                  <Portrait seed={t.seed} coverage={1} w={140} h={140} tile={11} />
                </span>
                <div>
                  <div className="h-emo" style={{ fontSize: 22 }}>{occ.title}</div>
                  <div className="muted" style={{ fontSize: 15, marginTop: 2 }}>{occ.detail}</div>
                </div>
              </div>
              <div className="label-mono" style={{ textAlign: 'right', textTransform: 'none', whiteSpace: 'nowrap' }}>
                surfaced unprompted<br />
                {om ? `corroborated ×${om.corroboration} · ${om.tokens} tok` : 'corroborated'}
              </div>
            </div>
          )}

          <div className="grid-2" style={{ gridTemplateColumns: 'minmax(300px, 440px) 1fr', alignItems: 'start' }}>
            {/* Portrait */}
            <div className="portrait-frame">
              <div className="inner" style={{ position: 'relative' }}>
                <Portrait seed={t.seed} coverage={view.coverage} w={620} h={760} tile={12} lit={lit} />
                {tile?.lit && (
                  <span
                    className="recall-leader"
                    style={{ left: `${(tile.lit.x / 760) * 100}%`, top: `${(tile.lit.y / 920) * 100}%`, transform: 'translate(-50%,-50%)' }}
                  >
                    <span className="dot gild" /> {shortName(tile.name)} — recalled
                  </span>
                )}
                <div className="nameplate">
                  <div className="nm">{t.personName}</div>
                  <div className="dt">{t.fullName}{t.bornYear ? ` · ${t.bornYear}–${t.diedYear ?? ''}` : ''}</div>
                </div>
              </div>
            </div>

            {/* Ask + answer + totals */}
            <div className="stack" style={{ gap: 18 }}>
              <div className="label-mono">Ask her trove anything</div>
              <div className="askbar">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && doAsk(q)}
                  placeholder={`What was ${t.personName}'s…`}
                />
                <button className="btn gold" onClick={() => doAsk(q)} disabled={asking || !q.trim()}>
                  {asking ? <span className="spinner" /> : 'Ask'}
                </button>
              </div>

              {ans && ans.error && (
                <div className="card pad">
                  <div className="inscription" style={{ fontSize: 18 }}>{ans.answer}</div>
                </div>
              )}

              {ans && !ans.error && (
                <div className="card pad">
                  <div className="qrow" style={{ marginBottom: 12 }}>
                    <span className="bul"><span className="dot gild" /></span>
                    <div className="q">
                      {ans.memoryOn
                        ? 'Trove found a memory under budget — it didn’t replay the tape.'
                        : 'Memory is off — Trove is a plain recorder now.'}
                    </div>
                  </div>
                  <div className="inscription" style={{ fontSize: 20 }}>{ans.answer}</div>
                  {tile && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 4px' }}>
                      <Chip type={tile.type} label={`${CHIP_LABEL[tile.type] || tile.type} · ${shortName(tile.name)}`} />
                      {tile.canonical && <span className="chip gold">✦ gilded canon</span>}
                    </div>
                  )}
                  <hr className="hair" style={{ margin: '14px 0' }} />
                  <div className="readout">
                    {ans.memoryOn ? (
                      <>
                        <div className="r"><span>recalled from</span><b>{ans.oldestSession ? `session ${ans.oldestSession}` : '—'}{tile ? ` · ${tile.corroborationCount} tellings` : ''}</b></div>
                        <div className="r"><span>tokens spent this query</span><b className="gold">{ans.tokensRecalled} / {fmt(ans.budget)}</b></div>
                        <div className="r"><span>transcripts replayed</span><b>0</b></div>
                        {ans.reranked && <div className="r"><span>reranked on</span><b>qwen3-rerank</b></div>}
                      </>
                    ) : (
                      <>
                        <div className="r"><span>recall</span><b>replayed the whole transcript · {fmt(ans.tokensRecalled)} tok</b></div>
                        <div className="r"><span>transcripts replayed</span><b>1</b></div>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="card pad">
                <div className="label-mono" style={{ marginBottom: 14 }}>{t.personName} — the whole life, kept</div>
                <div className="grid-2" style={{ gap: '4px 28px' }}>
                  <Stat k="tesserae set" v={fmt(view.totals.tesseraeSet)} />
                  <Stat k="dusted · let go" v={fmt(view.totals.dusted)} />
                  <Stat k="gilded · canon" v={fmt(view.totals.gilded)} gold />
                  <Stat k="open contradictions" v={String(view.totals.openContradictions)} />
                </div>
                <hr className="hair" style={{ margin: '16px 0' }} />
                <div className="between" style={{ alignItems: 'flex-end' }}>
                  <RampLegend size={38} />
                  <div className="label-mono" style={{ textTransform: 'none' }}>
                    forgetting-precision <b className="num" style={{ color: 'var(--gold-ink)', fontSize: 15 }}>{view.totals.forgettingPrecision.toFixed(2)}</b>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v, gold }: { k: string; v: string; gold?: boolean }) {
  return (
    <div className="between" style={{ padding: '7px 0', borderBottom: '1px solid var(--hair)' }}>
      <span className="muted" style={{ fontSize: 13.5 }}>{k}</span>
      <b className="num" style={{ fontSize: 16, color: gold ? 'var(--gold-ink)' : 'var(--grout)' }}>{v}</b>
    </div>
  );
}

function shortName(name: string): string {
  return name.replace(/\s*[—-]\s.*$/, '').replace(/[.:]$/, '').trim();
}

function Loading() {
  return (
    <div className="page"><div className="stage"><div className="wrap section" style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}><span className="spinner" style={{ width: 28, height: 28 }} /></div></div></div>
  );
}
