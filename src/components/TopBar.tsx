'use client';
import Link from 'next/link';
import Wordmark from './mosaic/Wordmark';
import Portrait from './mosaic/Portrait';

export default function TopBar({
  active,
  troveId,
  who,
  right,
}: {
  active?: 'mosaic' | 'telling' | 'restoration';
  troveId?: string;
  who?: { personName: string; seed: number; sub: string };
  right?: React.ReactNode;
}) {
  return (
    <header className="topbar">
      <Link href="/" style={{ textDecoration: 'none' }}><Wordmark size={27} /></Link>
      {troveId && (
        <nav className="nav">
          <Link className={active === 'mosaic' ? 'on' : ''} href={`/trove/${troveId}`}>The Mosaic</Link>
          <Link className={active === 'telling' ? 'on' : ''} href={`/trove/${troveId}/telling`}>The Telling</Link>
          <Link className={active === 'restoration' ? 'on' : ''} href={`/trove/${troveId}/restoration`}>The Restoration</Link>
        </nav>
      )}
      <div className="spacer" />
      {who ? (
        <Link className="who" href={`/trove/${troveId}`} style={{ textDecoration: 'none' }}>
          <span className="face"><Portrait seed={who.seed} coverage={1} w={200} h={200} tile={13} /></span>
          <span>
            <div className="nm">{who.personName}</div>
            <div className="sub">{who.sub}</div>
          </span>
        </Link>
      ) : (
        right
      )}
    </header>
  );
}
