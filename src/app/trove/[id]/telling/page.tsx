'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import TopBar from '@/components/TopBar';
import Portrait from '@/components/mosaic/Portrait';
import { Chip, RampLegend, MicIcon, LoadFailed } from '@/components/ui';
import { useSpeech } from '@/lib/client/speech';
import { api, fmt, type TroveView } from '@/lib/client/api';

interface Line { role: 'trove' | 'teller'; text: string; chips?: { type: string; name: string }[]; setCount?: number }

export default function TellingPage() {
  const { id } = useParams<{ id: string }>();
  const [view, setView] = useState<TroveView | null>(null);
  const [convo, setConvo] = useState<Line[]>([]);
  const [question, setQuestion] = useState('');
  const [gap, setGap] = useState('');
  const [pendingCatch, setPendingCatch] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [totals, setTotals] = useState<any>(null);
  const [coverage, setCoverage] = useState(0.5);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const speech = useSpeech((t) => setDraft((p) => (p ? p + ' ' : '') + t));

  useEffect(() => {
    api.view(id).then((v) => {
      setView(v);
      const seeded = v.tellings.filter((t) => !t.text.startsWith('ask:')).slice(-4).map((t): Line => ({ role: t.role, text: t.text }));
      setConvo(seeded);
      setQuestion(v.nextQuestion.question);
      setGap(v.nextQuestion.gap);
      setPendingCatch(v.contradictions[0] || null);
      setSession(v.session);
      setTotals(v.totals);
      setCoverage(v.coverage);
    }).catch(() => setFailed(true));
  }, [id]);

  useEffect(() => { railRef.current?.scrollTo({ top: railRef.current.scrollHeight, behavior: 'smooth' }); }, [convo]);

  async function submit() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    if (speech.listening) speech.stop();
    // show the question + her words immediately
    setConvo((c) => [...c, { role: 'trove', text: question }, { role: 'teller', text }]);
    setDraft('');
    try {
      const r = await api.telling(id, text);
      setConvo((c) => {
        const next = [...c];
        // attach chips to the last teller line
        for (let i = next.length - 1; i >= 0; i--) if (next[i].role === 'teller') { next[i] = { ...next[i], chips: r.set.map((s: any) => ({ type: s.type, name: s.name })), setCount: r.setCount }; break; }
        return next;
      });
      setPendingCatch(r.catch || null);
      setQuestion(r.nextQuestion.question);
      setGap(r.nextQuestion.gap);
      setSession(r.session);
      setTotals(r.totals);
      setCoverage(r.coverage);
    } catch {
      setConvo((c) => [...c, { role: 'trove', text: 'That telling didn’t make it into the mosaic — the call failed. Your words are still in the box below if you want to try again.' }]);
      setDraft(text);
    } finally { setBusy(false); }
  }

  async function resolve(cId: string, value: string) {
    try {
      const r = await api.reconcile(id, cId, value);
      setPendingCatch(r.contradictions[0] || null);
      setTotals(r.totals);
      setConvo((c) => [...c, { role: 'trove', text: `Kept "${value}" as canon, and dusted the slip. Thank you.` }]);
    } catch {
      setConvo((c) => [...c, { role: 'trove', text: 'That reconciliation didn’t save — please pick again.' }]);
    }
  }

  if (failed) return <LoadFailed />;
  if (!view) return <div className="page"><div className="wrap section" style={{ textAlign: 'center', paddingTop: 120 }}><span className="spinner" style={{ width: 28, height: 28 }} /></div></div>;
  const t = view.trove;

  return (
    <div className="page">
      <div className="grain soft" />
      <div className="stage">
        <TopBar active="telling" troveId={id} who={{ personName: t.personName, seed: t.seed, sub: `session ${t.currentSession} · she's talking` }} />
        <div className="wrap section">
          <div className="grid-tell">
            {/* conversation rail */}
            <div>
              <div ref={railRef} className="stack" style={{ gap: 18, maxHeight: '64vh', overflowY: 'auto', paddingRight: 6 }}>
                {convo.map((l, i) => l.role === 'trove' ? (
                  <div className="qrow" key={i} style={{ opacity: i < convo.length - 6 ? 0.5 : 1 }}>
                    <span className="bul"><span className="dot gild" /></span>
                    <div className="q" dangerouslySetInnerHTML={{ __html: bold(l.text) }} />
                  </div>
                ) : (
                  <div key={i}>
                    <div className="inscription">{l.text}</div>
                    {l.chips && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                        <span className="tag-mono" style={{ color: 'var(--gold-ink)' }}>+{l.setCount} set</span>
                        {l.chips.slice(0, 4).map((ch, j) => <Chip key={j} type={ch.type} label={`${ch.type} · ${shortName(ch.name)}`} />)}
                      </div>
                    )}
                  </div>
                ))}

                {busy && (
                  <div className="qrow">
                    <span className="bul"><span className="spinner" style={{ width: 14, height: 14 }} /></span>
                    <div className="q" style={{ color: 'var(--grout-70)' }}>listening — setting that into the mosaic…</div>
                  </div>
                )}

                {/* the catch */}
                {pendingCatch && (
                  <div className="catch">
                    <div className="lead">
                      A moment ago you said {pendingCatch.subject.toLowerCase()} was{' '}
                      <b>{pendingCatch.options[0].value}</b> — another telling says{' '}
                      <b>{pendingCatch.options[1]?.value}</b>. Trove won’t quietly keep both. Which should it keep?
                    </div>
                    <div className="pick">
                      {pendingCatch.options.map((o: any) => (
                        <button key={o.value} className="opt" onClick={() => resolve(pendingCatch.id, o.value)}>{o.value}</button>
                      ))}
                      <button className="opt" onClick={() => setPendingCatch(null)}>not sure — hold both</button>
                    </div>
                  </div>
                )}

                {/* next-best question */}
                <div className="stack" style={{ gap: 10 }}>
                  <span className="gap-flag">◆ next-best question · the biggest hole in the life{gap ? ` · ${gap}` : ''}</span>
                  <div className="qrow">
                    <span className="bul"><span className="dot gild" /></span>
                    <div className="q" dangerouslySetInnerHTML={{ __html: bold(question) }} />
                  </div>
                </div>
              </div>

              {/* live capture bar */}
              <div className="card pad" style={{ marginTop: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, minHeight: 26 }}>
                  {speech.listening && <span className="tag-mono" style={{ color: 'var(--gold-ink)' }}>● listening</span>}
                  <span className="inscription" style={{ border: 0, padding: 0, fontSize: 17, color: 'var(--grout-70)' }}>
                    {speech.listening && speech.interim ? `…${speech.interim}▍` : (draft ? '' : ' ')}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <button
                    className={`mic ${speech.listening ? 'live' : ''}`} style={{ width: 56, height: 56 }}
                    onMouseDown={speech.start} onMouseUp={speech.stop} onMouseLeave={() => speech.listening && speech.stop()}
                    onTouchStart={(e) => { e.preventDefault(); speech.start(); }} onTouchEnd={(e) => { e.preventDefault(); speech.stop(); }}
                    title={speech.supported ? 'Hold to talk' : 'Type instead'}
                  ><span className="ring" /><MicIcon /></button>
                  <input
                    value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()}
                    placeholder="…tell me. Or type here."
                    style={{ flex: 1, border: 0, outline: 0, background: 'transparent', fontFamily: 'var(--quote)', fontStyle: 'italic', fontSize: 18, color: 'var(--grout)', minWidth: 0 }}
                  />
                  {speech.listening && <span className="waveform">{[10, 16, 8, 20, 12, 18, 9].map((h, i) => <i key={i} style={{ height: h, animationDelay: `${i * 0.08}s` }} />)}</span>}
                  <button className="btn gold sm" onClick={submit} disabled={busy || !draft.trim()}>{busy ? <span className="spinner" /> : 'Set →'}</button>
                </div>
                <div className="label-mono" style={{ marginTop: 8 }}>hold to talk · or type</div>
              </div>
            </div>

            {/* the assembling mosaic */}
            <div className="stack" style={{ gap: 16 }}>
              <div className="between">
                <span className="label-mono">The mosaic, assembling</span>
                <span className="label-mono" style={{ textTransform: 'none' }}>coverage {Math.round(coverage * 100)}%</span>
              </div>
              <div className="portrait-frame" style={{ padding: 8 }}>
                <div className="inner"><Portrait seed={t.seed} coverage={coverage} w={560} h={620} tile={13} /></div>
              </div>
              <div className="card pad">
                <div className="label-mono" style={{ marginBottom: 8 }}>This session</div>
                {session && (
                  <div className="readout">
                    <div className="r"><span>tesserae set</span><b>{session.set}</b></div>
                    <div className="r"><span>gilded · corroborated</span><b className="gold">{session.gilded}</b></div>
                    <div className="r"><span>contradictions reconciled</span><b>{session.reconciled}</b></div>
                    <div className="r"><span>dusted · tangents let go</span><b>{session.dusted}</b></div>
                    <div className="r"><span>recalled to stay in context</span><b>{session.recalledTokens} / {fmt(session.budget)} tok</b></div>
                  </div>
                )}
                <div style={{ marginTop: 16 }}><RampLegend size={34} /></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function bold(s: string): string {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}
function escapeHtml(s: string): string { return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!)); }
function shortName(name: string): string { return name.replace(/\s*[—-]\s.*$/, '').replace(/[.:]$/, '').trim(); }
