import React from 'react';

/* A chart panel — the mockup's card chrome: serif title + mono sub-label +
 * optional tag pill or action controls, wrapping any chart body. `className`
 * adds grid modifiers ("tall" spans two rows, "full" spans both columns). */
export function ChartPanel({ title, sub, tag, actions, className, children }: {
  title: string; sub?: string; tag?: string; actions?: React.ReactNode; className?: string; children: React.ReactNode;
}) {
  return (
    <section className={`panel${className ? ' ' + className : ''}`}>
      <div className="panel-head">
        <div>
          <h2 className="panel-title">{title}</h2>
          {sub ? <div className="panel-sub">{sub}</div> : null}
        </div>
        {actions ?? (tag ? <span className="panel-tag">{tag}</span> : null)}
      </div>
      {children}
    </section>
  );
}

/* Mono pill toggle, same visual as the contributors metric toggle. */
export function SegToggle<T extends string>({ value, options, onChange }: {
  value: T; options: { id: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 4, flex: 'none' }}>
      {options.map(o => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)}
          style={{ padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11,
            border: '1px solid var(--border)',
            background: value === o.id ? 'var(--primary)' : 'transparent',
            color: value === o.id ? 'var(--bg)' : 'var(--fg-dim)' }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
