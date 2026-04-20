import React from 'react';
import { Ico } from './shell-icons';

export function Stat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: boolean }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={accent ? { color: 'var(--accent)' } : undefined}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function StatSkeleton({ label, sub, placeholder = '0,000' }: { label: string; sub?: string; placeholder?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value skel" style={{ display: 'inline-block' }}>{placeholder}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Tag({ children, tone = 'default', mono = false }: { children: React.ReactNode; tone?: 'default' | 'muted'; mono?: boolean }) {
  return <span className={`tag tag-${tone} ${mono ? 'mono' : ''}`}>{children}</span>;
}

export function SectionHead({ eyebrow, title, right }: { eyebrow?: React.ReactNode; title: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2 className="section-title">{title}</h2>
      </div>
      {right}
    </div>
  );
}

export function Check({ checked, onChange, label, color }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; color?: string }) {
  return (
    <label className="check">
      <span className={`check-box ${checked ? 'on' : ''}`} style={checked && color ? { background: color, borderColor: color } : undefined}>
        {checked && Ico.check}
      </span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ display: 'none' }} />
      <span>{label}</span>
    </label>
  );
}

export { Ico };
