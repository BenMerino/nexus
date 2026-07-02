// Projects data hook — the orchestrator logic from the legacy claustro-app.js,
// as React state. Fetches the acting user (gate), loads projects, and exposes
// save/delete/get. No window.* globals, no innerHTML.

import { useCallback, useEffect, useState } from 'react';
import type { Me, Project, ProjectDraft } from './types';

export function useProjects() {
  const [me, setMe] = useState<Me | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    const r = await fetch('/api/projects?action=list');
    const rows = (await r.json()) as Project[];
    setProjects(rows || []);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch('/api/auth?action=me')
      .then((r) => (r.status === 401 ? null : r.json()))
      .then(async (d: Me | null) => {
        if (!alive) return;
        if (!d || !d.role) { window.location.href = '/login.html'; return; }
        setMe(d);
        await loadProjects();
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [loadProjects]);

  const getProject = useCallback(async (id: number): Promise<Project> => {
    const r = await fetch('/api/projects?action=get&id=' + id);
    return r.json();
  }, []);

  const saveProject = useCallback(async (draft: ProjectDraft, editingId: number | null): Promise<string | null> => {
    const url = editingId ? '/api/projects?action=update' : '/api/projects?action=create';
    const method = editingId ? 'PUT' : 'POST';
    const body = editingId ? { ...draft, id: editingId } : draft;
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json();
    if (d.error) return d.error as string;
    await loadProjects();
    return null;
  }, [loadProjects]);

  const deleteProject = useCallback(async (id: number) => {
    await fetch('/api/projects?action=delete&id=' + id, { method: 'DELETE' });
    await loadProjects();
  }, [loadProjects]);

  return { me, projects, loading, getProject, saveProject, deleteProject };
}
