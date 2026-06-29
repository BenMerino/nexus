import { useState } from 'react';
import type { UnitScope } from './tenant-unit-scope-type';

/* The tenant page's scope lens: the selected unit (null = whole organization),
 * mirrored to ?unit=<unitKey> so a scoped view is shareable (and the
 * academic-profile breadcrumb can land pre-scoped). The rail resolves the
 * initial key once the org-tree loads.
 *
 * Deep-linked loads (?unit=) additionally gate the chart grid via `unitReady`:
 * until the rail resolves the key, every chart would mount at All-units and
 * then re-scope when the org-tree lands — a full refetch + grid reflow that
 * reads as charts flashing into other charts. The rail settles (match, bad
 * key, or fetch error) → markUnitReady, so a bad deep link never hangs. */
export function useUnitScope() {
  const [initialUnitKey] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('unit'));
  const [unit, setUnitState] = useState<UnitScope | null>(null);
  const [unitReady, setUnitReady] = useState(() => !initialUnitKey);
  const setUnit = (u: UnitScope | null) => {
    setUnitState(u);
    const url = new URL(window.location.href);
    if (u) url.searchParams.set('unit', u.unitKey); else url.searchParams.delete('unit');
    window.history.replaceState(null, '', url);
  };
  return { initialUnitKey, unit, setUnit, unitReady, markUnitReady: () => setUnitReady(true) };
}
