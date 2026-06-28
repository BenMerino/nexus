import React from 'react';
import { SegmentedControl } from '../ui/composed/SegmentedControl';

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

/* Mono pill toggle, same visual as the contributors metric toggle — now the
 * vendored SegmentedControl (pill variant: framer-motion indicator slide). */
export function SegToggle<T extends string>({ value, options, onChange }: {
  value: T; options: { id: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <SegmentedControl<T>
      segments={options.map(o => ({ value: o.id, label: o.label }))}
      value={value}
      onChange={onChange}
    />
  );
}
