import React from 'react';
import type { EnrichedSimNode } from './relationship-types';
import { COLORS } from './relationship-types';
import type { Bucket } from './graph-contents-buckets';

const ORCID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

function displayLabel(n: EnrichedSimNode): string {
  if (n.group === 'author' && (!n.label || ORCID_RE.test(n.label))) return 'Unknown author';
  return n.label;
}

interface ListProps {
  label: string;
  color: string;
  ns: EnrichedSimNode[];
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
}

function NodeList({ label, color, ns, onSelect, onHover }: ListProps) {
  if (ns.length === 0) return null;
  return (
    <div className="gc-list">
      <div className="gc-list-label"><span className="dot" style={{ background: color }} /> {label} <span className="mono muted">{ns.length}</span></div>
      <ul>
        {ns.map(n => (
          <li key={n.id}>
            <button type="button"
              onClick={() => onSelect(n.id)}
              onMouseEnter={() => onHover?.(n.id)}
              onMouseLeave={() => onHover?.(null)}>{displayLabel(n)}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface BucketProps { b: Bucket; onSelect: (id: string) => void; onHover?: (id: string | null) => void }

export function BucketView({ b, onSelect, onHover }: BucketProps) {
  const total = b.authors.length + b.journals.length + b.papers.length;
  if (total === 0 && b.institutions.length === 0) return null;
  const headInstId = b.institutions[0]?.id;
  return (
    <section data-flip-key={b.key} className={`gc-community${b.emphasis ? ' emphasis' : ''}`}>
      <header className="gc-community-head">
        <span className="gc-swatch" style={{ background: b.color }} />
        <button type="button" className="gc-community-title"
          onClick={() => headInstId && onSelect(headInstId)}
          onMouseEnter={() => headInstId && onHover?.(headInstId)}
          onMouseLeave={() => onHover?.(null)}>
          <h4>{b.label}</h4>
        </button>
        <span className="mono muted gc-count">{total}</span>
      </header>
      <NodeList label="Authors"  color={COLORS.author}  ns={b.authors}  onSelect={onSelect} onHover={onHover} />
      <NodeList label="Journals" color={COLORS.journal} ns={b.journals} onSelect={onSelect} onHover={onHover} />
      <NodeList label="Papers"   color="#888"           ns={b.papers}   onSelect={onSelect} onHover={onHover} />
    </section>
  );
}
