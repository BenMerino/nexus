import React, { useEffect, useState } from 'react';
import { authorProfileHref, fetchOrgTreeSummary } from './tenant-data';
import { RichHtml } from './rich-text';
import { ES } from './tenant-i18n';
import type { UnitScope } from './tenant-scope-rail';
import { SearchField } from '../ui/composed/SearchField';
import { Popover } from '../ui/composed/Popover';

/* Omnibox for the tenant page: one input over researchers + publications
 * (server, /search) and org units (client-side filter of the already-cached
 * org-tree summary — no extra round-trip). Researchers link to their public
 * profile, publications to their DOI, units re-scope the page via the same
 * lens the rail drives.
 *
 * Built on the vendored composed layer: SearchField (input shell) + Popover
 * (positioning, portal, click-outside, Escape, glass-reveal) replace the old
 * hand-rolled .omni-input / .omni-pop + boxRef mousedown effect. The data
 * fetch + grouping logic is unchanged. */

interface AuthorHit { name: string; orcid: string; papers: number; }
interface WorkHit { title: string; doi: string | null; year: string | null; journal: string | null; citations: number; }
interface OrgTree { faculties: { name: string; unitKey: string | null }[]; }

// Accent-fold for the client-side unit match, so "ingenieria" finds
// "Ingeniería" — same NFD-strip rule the API search uses server-side.
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function TenantSearch({ slug, onSelectUnit }: { slug: string; onSelectUnit: (u: UnitScope) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<{ authors: AuthorHit[]; works: WorkHit[] } | null>(null);
  const [units, setUnits] = useState<{ name: string; unitKey: string }[]>([]);

  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) { setHits(null); setUnits([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/public/${encodeURIComponent(slug)}/search?q=${encodeURIComponent(needle)}`)
        .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
        .then(d => setHits({ authors: d.authors || [], works: d.works || [] }))
        .catch(() => setHits({ authors: [], works: [] }));
      fetchOrgTreeSummary<OrgTree>(slug)
        .then(tree => {
          const n = fold(needle);
          setUnits(tree.faculties
            .filter((f): f is { name: string; unitKey: string } =>
              !!f.unitKey && fold(f.name).includes(n))
            .slice(0, 4));
        })
        .catch(() => setUnits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, slug]);

  const showing = open && q.trim().length >= 2 && hits !== null;
  const empty = showing && !hits!.authors.length && !hits!.works.length && !units.length;

  return (
    <Popover
      open={showing}
      onOpenChange={setOpen}
      panelClassName="omni-pop"
      panelStyle={{ width: '100%' }}
      trigger={({ ref }) => (
        <div className="omni" ref={ref as React.Ref<HTMLDivElement>}>
          <SearchField value={q} onChange={(v) => { setQ(v); setOpen(true); }}
            placeholder={ES.searchBox.placeholder} className="omni-input" />
        </div>
      )}
    >
      {(close) => (
        <>
          {units.length > 0 && <div className="omni-group">{ES.searchBox.units}</div>}
          {units.map(u => (
            <button key={u.unitKey} type="button" className="omni-row"
              onClick={() => { onSelectUnit({ unitKey: u.unitKey, name: u.name }); close(); setQ(''); }}>
              <span className="omni-name">{u.name}</span>
            </button>
          ))}
          {hits!.authors.length > 0 && <div className="omni-group">{ES.searchBox.researchers}</div>}
          {hits!.authors.map(a => (
            <a key={a.orcid} className="omni-row" href={authorProfileHref(slug, a.orcid)}>
              <span className="omni-name"><RichHtml raw={a.name} /></span>
              <span className="omni-sub">{a.papers} {ES.searchBox.papersSuffix}</span>
            </a>
          ))}
          {hits!.works.length > 0 && <div className="omni-group">{ES.searchBox.publications}</div>}
          {hits!.works.map((w, i) => (
            <a key={w.doi || i} className="omni-row" target="_blank" rel="noopener noreferrer"
              href={w.doi ? `https://doi.org/${w.doi}` : undefined}>
              <span className="omni-name"><RichHtml raw={w.title || '(untitled)'} /></span>
              <span className="omni-sub">{w.year ?? ''}</span>
            </a>
          ))}
          {empty && <div className="omni-empty">{ES.searchBox.noResults}</div>}
        </>
      )}
    </Popover>
  );
}
