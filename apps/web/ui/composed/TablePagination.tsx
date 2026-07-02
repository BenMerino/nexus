import React from 'react';
import { ChevronLeft, ChevronRight } from '../icons/index.js';
import { BaseBox, BaseText, BaseAction, BaseIcon } from '../primitives/index.js';

export interface TablePaginationProps {
  page: number;
  pageCount: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Singular noun for status text — "client", "order", etc. */
  itemLabel?: string;
}

export function TablePagination({ page, pageCount, totalCount, pageSize, onPageChange, itemLabel = 'item' }: TablePaginationProps) {
  if (totalCount === 0) return null;
  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, totalCount);
  const canPrev = page > 0;
  const canNext = page < pageCount - 1;
  const plural = totalCount === 1 ? itemLabel : `${itemLabel}s`;
  const multiPage = pageCount > 1;
  return (
    <BaseBox display="flex" align="center" justify="between" px="3" py="2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <BaseText variant="detail" color="muted">
        Showing {start}–{end} of {totalCount} {plural}
      </BaseText>
      <BaseBox display="flex" align="center" density="tight">
        <BaseAction variant="ghost" size="sm" onClick={() => onPageChange(page - 1)} disabled={!canPrev} aria-label="Previous page">
          <BaseIcon icon={ChevronLeft} size="sm" />
        </BaseAction>
        <BaseText variant="detail" color="muted">
          {multiPage ? `Page ${page + 1} of ${pageCount}` : `Page 1`}
        </BaseText>
        <BaseAction variant="ghost" size="sm" onClick={() => onPageChange(page + 1)} disabled={!canNext} aria-label="Next page">
          <BaseIcon icon={ChevronRight} size="sm" />
        </BaseAction>
      </BaseBox>
    </BaseBox>
  );
}
