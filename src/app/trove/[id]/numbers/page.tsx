'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { LoadFailed } from '@/components/ui';
import { api, fmt, whoSub, type TroveView } from '@/lib/client/api';

export default function NumbersPage() {
  const { id } = useParams<{ id: string }>();
  const [view, setView] = useState<TroveView | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { api.view(id).then(setView).catch(() => setFailed(true)); }, [id]);
  if (failed) return <LoadFailed />;
  if (!view) return <div className="page"><div className="wrap section" style={{ textAlign: 'center', paddingTop: 120 }}><span className="spinner" style={{ width: 28, height: 28 }} /></div></div>;
  const t = view.trove;
  const n = view.numbers;
  const maxBar = Math.max(...n.competence.map((c: any) => c.newCanonPerQuestion), 1);

  return (
    <div className="page">
      <div className="grain soft" />
      <div className="stage">
        <TopBar troveId={id} who={{ personName: t.personName, seed: t.seed, sub: whoSub(view) }} />
        <div className="wrap section">
          <div className="eyebrow">The measured numbers</div>
          <h1 className="h-emo" style={{ fontSize: 'clamp(34px,5vw,48px)', margin: '10px 0 12px' }}>Measured, honest.</h1>
          <p className="muted" style={{ maxWidth: 720, fontSize: 16, lineHeight: 1.55 }}>
            Every claim is a curve against a seeded ground-truth life — including a{' '}
            <b>reconciliation</b> number and a <b>forgetting</b> number almost nobody else brings.
          </p>

          <div className="grid-2" style={{ marginTop: 26, gap: 'clamp(18px,2.6vw,28px)' }}>
            {/* competence */}
            <div className="card pad">
              <div className="label-mono" style={{ marginBottom: 18 }}>Interviewer competence · session 1 → {n.competence.length}</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 120, marginBottom: 18 }}>
                {n.competence.map((c: any, i: number) => (
                  <div key={i} title={`session ${c.session}: ${c.newCanonPerQuestion}`} style={{ flex: 1, height: `${(c.newCanonPerQuestion / maxBar) * 100}%`, minHeight: 6, background: 'linear-gradient(180deg,#E7C765,#C9A227 70%,#B08C1E)', borderRadius: '3px 3px 0 0' }} />
                ))}
              </div>
              <div className="num" style={{ fontSize: 34, fontWeight: 700 }}>
                {n.competenceFrom.toFixed(1)} <span style={{ color: 'var(--grout-45)' }}>→</span> {n.competenceTo.toFixed(1)}
                <span className="muted" style={{ fontFamily: 'var(--mono)', fontSize: 16, marginLeft: 12 }}>new canon / question</span>
              </div>
              <p className="muted" style={{ fontSize: 14.5, marginTop: 8 }}>
                It gets measurably better at drawing <i>this</i> person out — redundant questions fell from {n.redundantFrom}% to {n.redundantTo}%.
              </p>
            </div>

            {/* reconciliation */}
            <div className="card pad">
              <div className="label-mono" style={{ marginBottom: 18 }}>Reconciliation accuracy · vs seeded ground truth</div>
              <div className="num" style={{ fontSize: 46, fontWeight: 700, lineHeight: 1 }}>
                {n.reconciliationResolved} <span style={{ color: 'var(--grout-45)' }}>/</span> {n.reconciliationTotal}
                <span className="muted" style={{ fontFamily: 'var(--mono)', fontSize: 17, marginLeft: 14 }}>conflicts resolved to the true version</span>
              </div>
              <Bar pct={n.reconciliationPct} label={`${n.reconciliationPct}%`} />
              <p className="muted" style={{ fontSize: 14.5, marginTop: 14 }}>Planted contradictions (Elm vs Oak, ’62 vs ’63) — caught, surfaced as a question, gilded to truth.</p>
            </div>

            {/* budgeted recall */}
            <div className="card pad">
              <div className="label-mono" style={{ marginBottom: 18 }}>Budgeted recall · the right memory, a fraction of the tokens</div>
              <div className="stack" style={{ gap: 8, marginBottom: 18 }}>
                <div style={{ position: 'relative', height: 30, borderRadius: 6, background: 'var(--ash)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 12 }}>
                  <span className="num" style={{ color: 'var(--plaster-hi)', fontSize: 12.5 }}>full-transcript replay · {fmt(n.recallFullTranscriptTokens)} tok</span>
                </div>
                <div style={{ position: 'relative', height: 30, borderRadius: 6, background: 'var(--plaster-2)' }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${Math.max(2, (n.recallBudgetTokens / Math.max(1, n.recallFullTranscriptTokens)) * 100)}%`, background: 'linear-gradient(90deg,#C9A227,#E7C765)', borderRadius: 6 }} />
                  <span className="num" style={{ position: 'absolute', right: 12, top: 7, fontSize: 12.5, color: 'var(--grout)' }}>Trove budgeted recall · {n.recallBudgetTokens} tok</span>
                </div>
              </div>
              <div className="num" style={{ fontSize: 30, fontWeight: 700 }}>
                1 <span style={{ color: 'var(--grout-45)' }}>/</span> {n.recallRatio || '—'}
                <span className="muted" style={{ fontFamily: 'var(--mono)', fontSize: 15, marginLeft: 12 }}>the context · recall precision {n.recallPrecision.toFixed(2)}</span>
              </div>
            </div>

            {/* forgetting */}
            <div className="card pad">
              <div className="label-mono" style={{ marginBottom: 18 }}>Forgetting precision · the track’s word, quantified</div>
              <div className="num" style={{ fontSize: 46, fontWeight: 700, lineHeight: 1 }}>{n.forgettingPrecision.toFixed(2)}</div>
              <Bar pct={Math.round(n.forgettingPrecision * 100)} label="core kept" />
              <p className="muted" style={{ fontSize: 14.5, marginTop: 14 }}>Share of tangents and corrected-away slips correctly dusted, while the corroborated core is retained. Nothing destroyed — dust is reversible.</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 26, maxWidth: 900 }}>
            <span className="dot lapis" style={{ marginTop: 6, flex: 'none' }} />
            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
              <b style={{ color: 'var(--grout)' }}>Honest caveats.</b> {n.seeded ? 'The session 1→N curves are a seeded longitudinal demonstration — a scripted life with planted corroborations and one planted contradiction, labelled as such. Small-N.' : 'These numbers are computed live over your own trove as it grows.'} Reconstruction is only as true as what it’s told: Trove flags gaps, it never invents. Numbers are computed live over the Qwen Cloud passes, surfaced through the custom Skill / MCP tool loop.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bar({ pct, label }: { pct: number; label: string }) {
  return (
    <div style={{ position: 'relative', height: 22, borderRadius: 6, background: 'var(--plaster-2)', marginTop: 16, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: 'linear-gradient(90deg,#C9A227,#E7C765)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <span className="num" style={{ fontSize: 11, color: 'var(--grout)', paddingRight: 8 }}>{label}</span>
      </div>
    </div>
  );
}
