import React from 'react';
import { DetailPanel } from './detail-panel';
import type { EnrichedTagNode, ProjectedEdge } from './relationship-types';

interface Props {
  node: EnrichedTagNode | null | undefined;
  connections: EnrichedTagNode[];
  edgesForNode: ProjectedEdge[];
  onClose: () => void;
  onSelect: (id: string) => void;
}

export function DetailPane({ node, connections, edgesForNode, onClose, onSelect }: Props) {
  return (
    <div className="detail-panel">
      {node ? (
        <DetailPanel node={node} connections={connections} edgesForNode={edgesForNode} onClose={onClose} onSelectNode={onSelect} />
      ) : (
        <div className="detail-empty">
          <div className="detail-empty-glyph">◎</div>
          <div className="detail-empty-head">Select a node</div>
          <p>Every node carries a canonical identifier — <span className="mono">ORCID</span> for authors, <span className="mono">ROR</span> for institutions, <span className="mono">ISSN-L</span> for journals, <span className="mono">DOI</span> for papers.</p>
        </div>
      )}
    </div>
  );
}
