import React, { useEffect, useState } from 'react';
import { ES } from './tenant-i18n';
import { fetchOrgTreeSummary } from './tenant-data';
import type { Unit } from './tenant-org-row';
import type { UnitScope } from './tenant-unit-scope-type';

/* The in-view scope control: a "Unit: [All units ▾]" dropdown that replaces the
 * old left scope rail as the global scope picker. Same /org-tree payload as the
 * rail; selecting a unit re-scopes every chart in the current section in place
 * (scope is sovereign). The deep-link (?unit=) resolution is one-shot, mirrored
 * from the rail's behaviour so a shared scoped URL opens already narrowed and a
 * page gating on `unitReady` never hangs. */

interface Faculty extends Unit { kind: 'faculty' | 'institute' | 'other'; }
interface OrgTree { faculties: Faculty[]; }

export function TenantUnitFilter({ slug, selected, onSelect, initialKey, onInitialResolved }: {
  slug: string; selected: UnitScope | null; onSelect: (u: UnitScope | null) => void;
  initialKey?: string | null; onInitialResolved?: () => void;
}) {
  const [data, setData] = useState<OrgTree | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrgTreeSummary<OrgTree>(slug)
      .then(setData)
      .catch(e => setError(e.message));
  }, [slug]);

  // Resolve a ?unit= deep link once, then hand selection ownership to the user.
  // onInitialResolved fires on every settle (match / unknown key / error) so a
  // chart grid gated on the deep link can't hang on a bad key.
  const appliedRef = React.useRef(false);
  useEffect(() => {
    if (appliedRef.current || !initialKey || (!data && !error)) return;
    appliedRef.current = true;
    const hit = data?.faculties.find(f => f.unitKey === initialKey);
    if (hit && hit.unitKey) onSelect({ unitKey: hit.unitKey, name: hit.name });
    onInitialResolved?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, error, initialKey]);

  const ranked = data ? [...data.faculties].sort((a, b) => b.papers - a.papers) : [];
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    if (!key) { onSelect(null); return; }
    const hit = ranked.find(f => f.unitKey === key);
    if (hit && hit.unitKey) onSelect({ unitKey: hit.unitKey, name: hit.name });
  };

  return (
    <label className="unit-filter">
      <span className="unit-filter-label">{ES.sidebar.unitLabel}</span>
      <select className="unit-filter-select" value={selected?.unitKey ?? ''}
        onChange={handleChange} disabled={!data || !!error}>
        <option value="">{ES.sidebar.allUnits}</option>
        {ranked.filter(f => f.unitKey).map(f => (
          <option key={f.unitKey} value={f.unitKey!}>
            {f.name} · {f.papers.toLocaleString()}
          </option>
        ))}
      </select>
    </label>
  );
}
