import React, { useEffect, useState } from 'react';
import { ES } from './tenant-i18n';
import { type Person, type Unit, PersonRow } from './tenant-org-row';

/* The org scheme rail = the scope picker. Each faculty/department row is
 * SELECTABLE — clicking it re-scopes the right-side Overview to that unit; an
 * "All organization" row at the top resets scope. The twist (▶) toggles
 * expand/drill (→ departments → people). Metrics live as charts on the right
 * (TenantContributors), not here — the rail stays a clean scheme + picker.
 * Row primitives in tenant-org-row.tsx. */

// The scope a selected unit carries (shared with tenant.tsx / Overview).
export interface UnitScope { unitKey: string; name: string; }

interface Department extends Unit { unitKey: string; people: Person[]; }
interface Faculty extends Unit { kind: 'faculty' | 'institute' | 'other'; departments: Department[]; }
interface OrgTree { faculties: Faculty[]; }

const KIND_LABEL = ES.orgTree.kindLabel;

// A selectable unit row. Twist toggles expand (drill); the rest selects
// (re-scopes). Active when its unitKey is the current scope. `tag` (kind label)
// sits in its own fixed-width slot so tags align into one column.
function Branch({ label, cls, tag, unitKey, name, selected, onSelect, children }: {
  label: React.ReactNode; cls: string; tag?: string;
  unitKey: string | null; name: string; selected: string | null;
  onSelect: (u: UnitScope | null) => void; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const isActive = unitKey != null && selected === unitKey;
  const pick = () => { if (unitKey) onSelect({ unitKey, name }); };
  return (
    <div className="org-node">
      <div className={`org-row selectable${isActive ? ' active' : ''}`} onClick={pick}>
        <span className={`org-twist${open ? ' open' : ''}`} onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>▶</span>
        <span className={`org-name ${cls}`}>{label}</span>
        <span className="org-kind-slot">{tag ? <span className="org-kind">{tag}</span> : null}</span>
      </div>
      <div className={`org-children${open ? ' open' : ''}`}>{children}</div>
    </div>
  );
}

export function TenantOrgTree({ slug, tenantName, selected, onSelect }: {
  slug: string; tenantName?: string; selected: UnitScope | null; onSelect: (u: UnitScope | null) => void;
}) {
  const [data, setData] = useState<OrgTree | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/${encodeURIComponent(slug)}/org-tree`)
      .then(async r => {
        if (!r.ok) throw new Error(`Org tree failed (${r.status})`);
        return r.json() as Promise<OrgTree>;
      })
      .then(setData)
      .catch(e => setError(e.message));
  }, [slug]);

  const selKey = selected?.unitKey ?? null;

  if (error) return <div className="org-err" style={{ padding: 14 }}>{error}</div>;
  if (!data) return <div style={{ padding: 14, color: 'var(--fg-dim)', fontFamily: 'var(--mono)', fontSize: 13 }}>{ES.loadingLabel(ES.orgSchemeLoading)}</div>;
  if (!data.faculties.length) return <div className="text-muted text-small" style={{ padding: 14 }}>{ES.orgTree.noRoster}</div>;

  return (
    <div className="org-tree">
      {/* Scope reset — selected when no unit is active. */}
      <div className="org-node">
        <div className={`org-row selectable all-units${selKey === null ? ' active' : ''}`} onClick={() => onSelect(null)}>
          <span className="org-twist" />
          <span className="org-name fac">{tenantName || ES.orgTree.allOrganization}</span>
          <span className="org-kind-slot" />
        </div>
      </div>
      {data.faculties.map(f => (
        <Branch key={f.name}
          label={f.name} tag={KIND_LABEL[f.kind]} cls="fac"
          unitKey={f.unitKey} name={f.name} selected={selKey} onSelect={onSelect}>
          {f.departments.map(d => (
            <Branch key={d.name} label={d.name} cls="dep"
              unitKey={d.unitKey} name={`${f.name} · ${d.name}`} selected={selKey} onSelect={onSelect}>
              {d.people.map((p, i) => <PersonRow key={`${p.orcid || p.name}-${i}`} p={p} />)}
            </Branch>
          ))}
        </Branch>
      ))}
    </div>
  );
}
