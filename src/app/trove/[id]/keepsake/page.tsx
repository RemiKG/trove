'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Wordmark from '@/components/mosaic/Wordmark';
import Portrait from '@/components/mosaic/Portrait';
import { LoadFailed } from '@/components/ui';
import { api, type TroveView } from '@/lib/client/api';
import { downloadPortraitPNG, copyLink } from '@/lib/client/download';

export default function KeepsakePage() {
  const { id } = useParams<{ id: string }>();
  const [view, setView] = useState<TroveView | null>(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => { api.view(id).then(setView).catch(() => setFailed(true)); }, [id]);
  if (failed) return <LoadFailed />;
  if (!view) return <div className="page"><div className="wrap section" style={{ textAlign: 'center', paddingTop: 120 }}><span className="spinner" style={{ width: 28, height: 28 }} /></div></div>;
  const t = view.trove;
  const k = view.keepsake;

  return (
    <div className="page">
      <div className="grain soft" />
      <div className="stage">
        <header className="topbar">
          <Link href="/" style={{ textDecoration: 'none' }}><Wordmark size={27} /></Link>
          <span className="carved" style={{ marginLeft: 12, fontSize: 12, color: 'var(--grout-45)' }}>The Keepsake</span>
          <div className="spacer" />
          <button className="btn ghost sm" onClick={() => window.print()}>Print</button>
          <button className="btn ghost sm" onClick={async () => { setCopied(await copyLink()); setTimeout(() => setCopied(false), 1600); }}>{copied ? 'Link copied ✓' : 'Share a link'}</button>
          <button className="btn gold sm" onClick={() => downloadPortraitPNG(t.seed, `${t.personName}-trove.png`)}>Download the portrait ↓</button>
        </header>

        <div className="wrap section" style={{ display: 'flex', justifyContent: 'center' }}>
          <div className="plate" id="keepsake-plate" style={{ maxWidth: 1040, width: '100%', padding: 'clamp(20px,3vw,34px)' }}>
            <div className="grid-2" style={{ gridTemplateColumns: 'minmax(260px,360px) 1fr', gap: 'clamp(22px,4vw,52px)', alignItems: 'center' }}>
              <div className="portrait-frame" style={{ padding: 7 }}>
                <div className="inner"><Portrait seed={t.seed} coverage={1} w={520} h={640} tile={12} /></div>
              </div>
              <div>
                <div className="carved" style={{ fontSize: 12.5, color: 'var(--grout-45)', letterSpacing: '.18em' }}>Her life, in her words</div>
                <h1 className="carved" style={{ fontSize: 'clamp(30px,4.4vw,46px)', margin: '10px 0 4px', letterSpacing: '.04em', color: 'var(--grout)' }}>
                  {keepsakeName(t.fullName, t.personName)}
                </h1>
                <div className="num" style={{ color: 'var(--gold-ink)', fontSize: 16, letterSpacing: '.14em', marginBottom: 22 }}>
                  {t.bornYear ?? '—'} &nbsp;—&nbsp; {t.diedYear ?? '—'}
                </div>
                <div className="stack" style={{ gap: 16 }}>
                  {(k.quotes.length ? k.quotes : ['Her own words are still being gathered — come back after a few tellings.']).map((qq: string, i: number) => (
                    <div key={i} className="inscription" style={{ fontSize: 21, borderLeftWidth: 3, paddingLeft: 18 }}>{quoted(qq)}</div>
                  ))}
                </div>
                <p className="label-mono" style={{ textTransform: 'none', lineHeight: 1.7, marginTop: 26, letterSpacing: 0 }}>{k.caption}</p>
                <div className="carved" style={{ marginTop: 16, color: 'var(--gold-ink)', fontSize: 13, letterSpacing: '.16em' }}>✦ Kept in Trove</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function keepsakeName(full: string, nick: string): string {
  if (full && nick && full.toLowerCase().includes(nick.toLowerCase())) return full;
  if (full && nick && full !== nick) {
    const parts = full.split(' ');
    if (parts.length >= 2) return `${parts[0]} "${nick}" ${parts.slice(1).join(' ')}`;
  }
  return full || nick;
}
function quoted(s: string): string {
  const trimmed = s.trim();
  if (/^["“]/.test(trimmed)) return trimmed;
  return `“${trimmed.replace(/[.]?$/, '')}.”`;
}
