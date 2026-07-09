'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import Wordmark from '@/components/mosaic/Wordmark';
import Portrait from '@/components/mosaic/Portrait';
import { MicIcon, BrainBadge } from '@/components/ui';
import { useSpeech } from '@/lib/client/speech';
import { api, fmt, type TroveView, type TroveSummary } from '@/lib/client/api';

export default function Door() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [example, setExample] = useState<TroveView | null>(null);
  const [mine, setMine] = useState<TroveSummary[]>([]);
  const [mode, setMode] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const speech = useSpeech((t) => setName((p) => (p ? p + ' ' : '') + t));

  useEffect(() => {
    api.ensureExample().then((r) => setExample(r.view)).catch(() => {});
    api.listTroves().then((r) => setMine(r.troves.filter((t) => !t.example))).catch(() => {});
    api.mode().then(setMode).catch(() => {});
  }, []);

  async function begin() {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    try {
      const { id } = await api.createTrove(n);
      router.push(`/trove/${id}/telling?fresh=1`);
    } catch {
      setBusy(false);
    }
  }

  const ex = example?.trove;
  const et = example?.totals;

  return (
    <div className="page">
      <div className="grain soft" />
      <div className="stage">
        <header className="topbar">
          <Wordmark size={27} />
          <div className="spacer" />
          {mode && <BrainBadge mode={mode} />}
          <span className="label-mono" style={{ marginLeft: 14 }}>an oral-history memory agent</span>
        </header>

        <div className="wrap" style={{ paddingTop: 'clamp(28px,6vh,72px)', paddingBottom: 40 }}>
          <div className="grid-2" style={{ alignItems: 'center', gap: 'clamp(24px,5vw,64px)' }}>
            {/* Left — the pitch + start */}
            <div>
              <div className="eyebrow">Everyone you love is a library</div>
              <h1 className="h-emo" style={{ fontSize: 'clamp(40px,6vw,64px)', margin: '18px 0 20px', lineHeight: 1.02 }}>
                Who are you afraid<br />of forgetting?
              </h1>
              <p className="muted" style={{ fontSize: 19, lineHeight: 1.6, maxWidth: 560 }}>
                Sit them down and just let them talk. Trove keeps every name, every place, every
                story — even the ones told twice — reconciles the tellings that don’t match, learns
                what to ask next, and lays a whole life out as a{' '}
                <b style={{ color: 'var(--gold-ink)' }}>mosaic in gold</b>. Years from now, you can
                still ask it anything.
              </p>

              <div className="field" style={{ marginTop: 26, maxWidth: 640 }}>
                <input
                  value={speech.listening && speech.interim ? name + ' ' + speech.interim : name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && begin()}
                  placeholder="My grandmother, Nana…"
                  aria-label="Who are you keeping?"
                />
                <button
                  className={`mic ${speech.listening ? 'live' : ''}`}
                  onMouseDown={speech.start}
                  onMouseUp={speech.stop}
                  onMouseLeave={() => speech.listening && speech.stop()}
                  onTouchStart={(e) => { e.preventDefault(); speech.start(); }}
                  onTouchEnd={(e) => { e.preventDefault(); speech.stop(); }}
                  title={speech.supported ? 'Hold to talk' : 'Speech capture needs Chrome / Edge / Safari — you can type instead'}
                  aria-label="Hold to talk"
                >
                  <span className="ring" />
                  <MicIcon />
                </button>
                <button className="btn gold" onClick={begin} disabled={busy || !name.trim()}>
                  {busy ? <span className="spinner" /> : 'Begin →'}
                </button>
              </div>
              <div className="label-mono" style={{ marginTop: 8, marginLeft: 6 }}>
                {speech.listening ? '● listening — let them talk' : 'hold to talk · or type'}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 26, maxWidth: 560 }}>
                <span className="dot lapis" style={{ marginTop: 6, flex: 'none' }} />
                <p className="muted" style={{ fontSize: 14.5, lineHeight: 1.55, margin: 0 }}>
                  <b style={{ color: 'var(--grout)' }}>Only what they actually said.</b> Trove never
                  invents a memory to fill a gap — it marks the gap and asks. It keeps a record; it is
                  not a séance.
                </p>
              </div>
            </div>

            {/* Right — the example */}
            <div>
              <div className="card" style={{ padding: 22 }}>
                <div className="tag-example" style={{ marginBottom: 16 }}>Example · a life already told</div>
                <div style={{ display: 'flex', gap: 20 }}>
                  <div style={{ width: 168, flex: 'none' }}>
                    <div className="portrait-frame" style={{ padding: 6 }}>
                      <div className="inner">
                        <Portrait seed={42} coverage={1} w={340} h={420} tile={13} />
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 className="h-emo" style={{ fontSize: 30, margin: '0 0 8px' }}>Meet Nana.</h2>
                    <p className="muted" style={{ fontSize: 15.5, lineHeight: 1.5, margin: '0 0 16px' }}>
                      Fourteen sessions in, richly gilded — a whole life reconstructed from her own
                      stories. Walk up and ask her anything.
                    </p>
                    <Link className="btn ghost" href={`/trove/${example?.trove.id ?? 'nana-example'}`}>
                      Open Nana’s trove →
                    </Link>
                  </div>
                </div>
                <hr className="hair" style={{ margin: '18px 0 14px' }} />
                <div className="label-mono" style={{ letterSpacing: '.02em', textTransform: 'none', fontSize: 12.5 }}>
                  {ex ? (
                    <>
                      {ex.currentSession} sessions · {fmt(et!.tesseraeSet)} tesserae · {et!.gilded} gilded ·{' '}
                      {et!.openContradictions} open contradiction{et!.openContradictions === 1 ? '' : 's'}
                    </>
                  ) : (
                    'loading the example…'
                  )}
                </div>
              </div>

              {mine.length > 0 && (
                <div className="card" style={{ padding: 18, marginTop: 16 }}>
                  <div className="eyebrow" style={{ marginBottom: 10 }}>Your troves</div>
                  <div className="stack" style={{ gap: 8 }}>
                    {mine.slice(0, 4).map((t) => (
                      <Link key={t.id} href={`/trove/${t.id}`} className="between" style={{ textDecoration: 'none', padding: '8px 4px', borderRadius: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="face" style={{ width: 30, height: 30 }}><Portrait seed={t.seed} coverage={1} w={140} h={140} tile={12} /></span>
                          <b style={{ fontFamily: 'var(--display)', fontWeight: 560, fontSize: 17 }}>{t.personName}</b>
                        </span>
                        <span className="label-mono" style={{ textTransform: 'none' }}>{fmt(t.tesseraeSet)} set · {t.gilded} gilded</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="label-mono" style={{ textAlign: 'center', marginTop: 'clamp(32px,6vh,64px)', letterSpacing: '.06em' }}>
            a whole life never loads at once&nbsp;&nbsp;·&nbsp;&nbsp;recall is hard-budgeted to 4,096 tokens&nbsp;&nbsp;·&nbsp;&nbsp;gilded canon first
          </div>
        </div>
      </div>
    </div>
  );
}
