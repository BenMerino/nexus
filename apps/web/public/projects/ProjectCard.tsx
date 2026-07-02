import React from 'react';
import { BaseBox, BaseText, BaseAction } from '../../ui/primitives';
import { Tag } from '../ui-kit';
import { fmtCLP } from './funding';
import type { Investigator, Project } from './types';

/* One project card — funding chip + flags + actions, title, meta grid, notes,
 * investigator lines. DNA primitives, no innerHTML / inline onclick (edit/delete
 * are real handlers passed from the list). */

function InvLine({ inv }: { inv: Investigator }) {
  const isPI = inv.rol === 'IR';
  return (
    <BaseBox display="flex" align="center" gap="2" className={isPI ? 'inv-line' : 'inv-line inv-co'}>
      <BaseText as="span" variant="micro" className={isPI ? 'inv-role-badge' : 'inv-role-badge inv-role-co'}>
        {isPI ? 'PI' : 'Co'}
      </BaseText>
      <BaseText as="span" variant="detail" className="inv-name">{inv.full_name}</BaseText>
      {inv.orcid && <BaseText as="span" variant="micro" color="muted" className="inv-orcid">{inv.orcid}</BaseText>}
      {!inv.user_id && <Tag tone="muted" mono>NO MATCH</Tag>}
    </BaseBox>
  );
}

export function ProjectCard({ p, editing, onEdit, onDelete }: {
  p: Project; editing: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const invs = [...p.investigators].sort((a, b) => (a.rol === 'IR' ? -1 : 1) - (b.rol === 'IR' ? -1 : 1));
  const period = (p.fecha_inicio || '?').slice(0, 10) + ' → ' + (p.fecha_fin || '?').slice(0, 10);
  return (
    <BaseBox as="article" className={`project-card${editing ? ' editing' : ''}`}>
      <BaseBox display="flex" align="center" justify="between" className="project-card-top">
        <BaseText as="div" variant="detail" className="project-funding" style={{ fontFamily: 'var(--font-mono)' }}>
          {p.fuente_financiamiento || 'Other'}
        </BaseText>
        <BaseBox display="flex" align="center" gap="2">
          {p.concursable && <Tag mono>COMPETITIVE</Tag>}
          {p.externo && <Tag tone="muted" mono>EXTERNAL</Tag>}
          <BaseAction variant="ghost" size="sm" onClick={onEdit}>Edit</BaseAction>
          <BaseAction variant="danger-soft" size="sm" onClick={onDelete}>Delete</BaseAction>
        </BaseBox>
      </BaseBox>
      <BaseText as="h3" variant="h3" className="project-title">{p.titulo}</BaseText>
      <BaseBox className="project-meta">
        <div><span>Code</span><span className="mono">{p.codigo || '—'}</span></div>
        <div><span>Amount</span><span className="mono" style={{ color: 'var(--accent)' }}>{fmtCLP(p.monto)}</span></div>
        <div><span>Faculty</span><span>{p.departamento || '—'}</span></div>
        <div><span>Period</span><span className="mono">{period}</span></div>
      </BaseBox>
      {p.notas && <BaseText as="div" variant="detail" color="muted" className="project-notes">{p.notas}</BaseText>}
      <BaseBox display="flex" flexDirection="col" gap="1" className="project-investigators">
        {invs.map((inv, i) => <InvLine key={i} inv={inv} />)}
      </BaseBox>
    </BaseBox>
  );
}
