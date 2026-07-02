// Projects page (/proyectos) — fully React on DNA components. Replaces the
// legacy claustro-*.js modules (innerHTML + window.* globals + native
// <select>/<input type=date>) with real DNA pickers and controlled state. The
// page-specific card/stat/form styles live in claustro.css (page CSS, not
// chrome — N9); the chrome comes from the shared shell.

import React, { useState } from 'react';
import { BaseBox, BaseText, BaseAction } from '../../ui/primitives';
import { SectionHead, Tag } from '../ui-kit';
import { useProjects } from '../projects/useProjects';
import { ProjectStats } from '../projects/ProjectStats';
import { ProjectFilters } from '../projects/ProjectFilters';
import { ProjectsList } from '../projects/ProjectsList';
import { ProjectForm } from '../projects/ProjectForm';
import { isEditor, emptyDraft, type Project, type ProjectDraft } from '../projects/types';
import '../claustro.css';

export function ProjectsPage() {
  const { me, projects, loading, getProject, saveProject, deleteProject } = useProjects();
  const [dept, setDept] = useState('all');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!loading && !isEditor(me)) {
    return <BaseBox className="card"><BaseText variant="body">Only tenant administrative roles can manage projects.</BaseText></BaseBox>;
  }

  const filtered = dept === 'all' ? projects : projects.filter((p) => p.departamento === dept);
  const patch = (p: Partial<ProjectDraft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const openNew = () => { setEditingId(null); setDraft(emptyDraft()); setError(null); };
  const openEdit = async (id: number) => {
    const p = await getProject(id);
    setEditingId(id);
    setDraft({ ...(p as Project), investigators: p.investigators?.length ? p.investigators : [{ rol: 'IR', full_name: '', orcid: '' }] });
    setError(null);
  };
  const close = () => { setDraft(null); setEditingId(null); setError(null); };
  const del = async (id: number) => {
    if (!window.confirm('Delete project #' + id + '?')) return;
    if (editingId === id) close();
    await deleteProject(id);
  };
  const save = async () => {
    if (!draft) return;
    if (!draft.titulo.trim()) { setError('Title required'); return; }
    const err = await saveProject({ ...draft, investigators: draft.investigators.filter((i) => i.full_name.trim()) }, editingId);
    if (err) setError(err); else close();
  };

  return (
    <BaseBox className="view claustro-view" display="flex" flexDirection="col" gap="6">
      <ProjectStats projects={projects} />
      <BaseBox display="flex" align="center" justify="between" gap="3" style={{ flexWrap: 'wrap' }}>
        <ProjectFilters projects={projects} active={dept} onChange={setDept} />
        <BaseAction variant="primary" onClick={draft ? close : openNew}>
          {draft ? 'Cancel' : '+ New project'}
        </BaseAction>
      </BaseBox>

      {draft && (
        <BaseBox as="section" className="card project-form" display="flex" flexDirection="col" gap="4">
          <BaseText variant="label" color="muted">{editingId ? `Edit project #${editingId}` : 'New project'}</BaseText>
          <ProjectForm draft={draft} onChange={patch} />
          {error && <BaseText variant="detail" style={{ color: 'var(--err)' }}>{error}</BaseText>}
          <BaseBox display="flex" gap="2" justify="end">
            <BaseAction variant="secondary" onClick={close}>Cancel</BaseAction>
            <BaseAction variant="primary" onClick={save}>Save</BaseAction>
          </BaseBox>
        </BaseBox>
      )}

      <BaseBox as="section" display="flex" flexDirection="col" gap="3">
        <SectionHead eyebrow="Recorded projects" title={dept === 'all' ? 'All projects' : dept}
          right={<Tag mono>{filtered.length} results</Tag>} />
        <ProjectsList projects={filtered} editingId={editingId} onEdit={openEdit} onDelete={del} />
      </BaseBox>
    </BaseBox>
  );
}
