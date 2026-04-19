import React, { useMemo, useState } from 'react';
import type { RawNode, RawEdge } from './relationship-types';

interface JournalGroup {
  journal: RawNode;
  papers: RawNode[];
}

export function JournalTree({ rawNodes, rawEdges }: { rawNodes: RawNode[]; rawEdges: RawEdge[] }) {
  const [expandedJournals, setExpandedJournals] = useState<Set<string>>(() => new Set());

  const { institution, author, journals } = useMemo(() => {
    const inst = rawNodes.find(n => n.group === 'institution');
    const auth = rawNodes.find(n => n.group === 'author');
    const journalNodes = new Map(rawNodes.filter(n => n.group === 'journal').map(n => [n.id, n]));
    const doiNodes = new Map(rawNodes.filter(n => n.group === 'doi').map(n => [n.id, n]));

    // Map papers to their journal
    const paperToJournal = new Map<string, string>();
    for (const e of rawEdges) {
      if (doiNodes.has(e.source) && journalNodes.has(e.target)) paperToJournal.set(e.source, e.target);
      if (doiNodes.has(e.target) && journalNodes.has(e.source)) paperToJournal.set(e.target, e.source);
    }

    const groups = new Map<string, JournalGroup>();
    for (const [jId, jNode] of journalNodes) {
      groups.set(jId, { journal: jNode, papers: [] });
    }
    for (const [doiId, jId] of paperToJournal) {
      const g = groups.get(jId);
      const paper = doiNodes.get(doiId);
      if (g && paper) g.papers.push(paper);
    }

    const sorted = [...groups.values()]
      .filter(g => g.papers.length > 0)
      .sort((a, b) => b.papers.length - a.papers.length);

    return { institution: inst, author: auth, journals: sorted };
  }, [rawNodes, rawEdges]);

  const toggle = (id: string) => {
    setExpandedJournals(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const S = {
    root: { fontFamily: 'monospace', fontSize: 13 } as const,
    header: { padding: '8px 12px', fontWeight: 700, fontSize: 14 } as const,
    sub: { color: '#999', fontWeight: 400, fontSize: 12 } as const,
    journal: { padding: '6px 12px 6px 24px', cursor: 'pointer', borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8 } as const,
    jLabel: { fontWeight: 600, color: '#1565c0' } as const,
    count: { fontSize: 11, color: '#999', marginLeft: 4 } as const,
    paper: { padding: '3px 12px 3px 48px', color: '#444', fontSize: 12, borderLeft: '2px solid #e0e0e0', marginLeft: 34 } as const,
    arrow: { fontSize: 10, color: '#999', width: 12, display: 'inline-block' } as const,
  };

  return (
    <div style={S.root}>
      {institution && <div style={S.header}>{institution.label}</div>}
      {author && <div style={{ ...S.header, paddingLeft: 24 }}>{author.label} <span style={S.sub}>{journals.reduce((s, g) => s + g.papers.length, 0)} papers</span></div>}
      {journals.map(g => {
        const open = expandedJournals.has(g.journal.id);
        return (
          <div key={g.journal.id}>
            <div style={S.journal} onClick={() => toggle(g.journal.id)}>
              <span style={S.arrow}>{open ? '▼' : '▶'}</span>
              <span style={S.jLabel}>{g.journal.label}</span>
              <span style={S.count}>({g.papers.length})</span>
            </div>
            {open && g.papers.map(p => (
              <div key={p.id} style={S.paper}>{p.label}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
