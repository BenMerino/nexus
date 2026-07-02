import React from 'react';
import { BaseAction } from '../primitives/index.js';

export interface TableSelectionToggleProps {
  /** Number of rows selected on the visible page. */
  pageSelected: number;
  /** Total rows across the full filtered dataset (all pages). */
  totalCount: number;
  /** True when "select every row across pages" is active. */
  allAcrossPages: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  /** Singular noun, e.g. "client". */
  itemLabel?: string;
}

/** Compact action that extends a table's selection from "all rows on the
 *  current page" to "all rows across all pages" — or clears it. Renders
 *  nothing unless the affordance is meaningful. Designed to sit inside the
 *  page's existing PageHeader `actions` slot, not in the table itself. */
export function TableSelectionToggle({ pageSelected, totalCount, allAcrossPages, onSelectAll, onClear, itemLabel = 'item' }: TableSelectionToggleProps) {
  if (!allAcrossPages && (pageSelected === 0 || pageSelected >= totalCount)) return null;

  const plural = totalCount === 1 ? itemLabel : `${itemLabel}s`;

  if (allAcrossPages) {
    return (
      <BaseAction variant="ghost" size="sm" onClick={onClear}>
        Clear selection ({totalCount})
      </BaseAction>
    );
  }

  return (
    <BaseAction variant="ghost" size="sm" onClick={onSelectAll}>
      Select all {totalCount} {plural}
    </BaseAction>
  );
}
