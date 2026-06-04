import React from 'react';

/* A chart panel — the mockup's card chrome: serif title + mono sub-label +
 * optional tag pill, wrapping any chart body. `className` adds grid modifiers
 * ("tall" spans two rows, "full" spans both columns). Pure presentation. */
export function ChartPanel({ title, sub, tag, className, children }: {
  title: string; sub?: string; tag?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <section className={`panel${className ? ' ' + className : ''}`}>
      <div className="panel-head">
        <div>
          <h2 className="panel-title">{title}</h2>
          {sub ? <div className="panel-sub">{sub}</div> : null}
        </div>
        {tag ? <span className="panel-tag">{tag}</span> : null}
      </div>
      {children}
    </section>
  );
}
