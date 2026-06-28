import React, { useState } from 'react';
import { Tag, SectionHead } from './ui-kit';
import { BaseAction } from '../ui/primitives';

type Tone = 'ok' | 'err' | 'info';

export function ClaimPaperPanel({ onClaimed }: { onClaimed?: () => void }) {
  const [doi, setDoi] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: Tone; text: string } | null>(null);

  async function claim() {
    if (!doi.trim()) return;
    setBusy(true); setMsg({ tone: 'info', text: 'Fetching metadata and tagging…' });
    try {
      const r = await fetch('/api/claim-paper', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doi: doi.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg({ tone: 'err', text: d.error || 'Failed' }); return; }
      const bits: string[] = [];
      if (d.ingested) bits.push('imported new record');
      if (d.tagged) bits.push('tagged as yours');
      if (!d.ingested && !d.tagged) bits.push('already claimed');
      setMsg({ tone: 'ok', text: bits.join(' · ') });
      setDoi('');
      onClaimed?.();
    } catch (e: any) {
      setMsg({ tone: 'err', text: String(e?.message || e) });
    } finally { setBusy(false); }
  }

  const color = (t: Tone) => t === 'err' ? 'var(--err)' : t === 'ok' ? 'var(--ok)' : 'var(--fg-muted)';

  return (
    <section className="card">
      <SectionHead eyebrow="Add" title="Claim a paper by DOI" right={<Tag mono tone="muted">pre-ORCID work</Tag>} />
      <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        Found an older paper of yours not on this dashboard? Paste its DOI — Nexus will fetch metadata and tag it to your profile.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="text" value={doi} onChange={e => setDoi(e.target.value)}
          placeholder="10.1016/j.example.2009.01.001"
          style={{ flex: 1, padding: '8px 10px', background: 'var(--bg-inset)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--fg)', fontFamily: 'var(--mono)', fontSize: 12 }}
          onKeyDown={e => { if (e.key === 'Enter') claim(); }} disabled={busy} />
        <BaseAction variant="primary" onClick={claim} disabled={busy || !doi.trim()}>{busy ? '…' : 'Claim'}</BaseAction>
      </div>
      {msg && <div className="mono" style={{ fontSize: 11, marginTop: 8, color: color(msg.tone) }}>{msg.text}</div>}
    </section>
  );
}
