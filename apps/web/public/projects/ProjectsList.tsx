import React from 'react';
import { BaseBox, BaseText } from '../../ui/primitives';
import { ProjectCard } from './ProjectCard';
import type { Project } from './types';

/* The project grid, or an empty state when the filter yields nothing. */

export function ProjectsList({ projects, editingId, onEdit, onDelete }: {
  projects: Project[];
  editingId: number | null;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  if (!projects.length) {
    return (
      <BaseBox display="flex" flexDirection="col" align="center" gap="1" className="empty-state">
        <BaseText as="div" className="empty-glyph">∅</BaseText>
        <BaseText as="div" variant="h3" className="empty-head">No projects.</BaseText>
        <BaseText as="div" variant="detail" color="muted" className="empty-sub">
          No projects recorded for this filter yet.
        </BaseText>
      </BaseBox>
    );
  }
  return (
    <BaseBox className="project-grid reveal-group">
      {projects.map((p) => (
        <ProjectCard key={p.id} p={p} editing={editingId === p.id}
          onEdit={() => onEdit(p.id)} onDelete={() => onDelete(p.id)} />
      ))}
    </BaseBox>
  );
}
