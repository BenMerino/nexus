import React from 'react';
import { ES } from './tenant-i18n';

/* Provenance footer: where the numbers come from, what they cover, and the
 * one counting caveat that otherwise surprises readers. */
export function TenantFooter({ yearRange }: {
  yearRange?: { minYear: string | null; maxYear: string | null };
}) {
  const coverage = yearRange?.minYear && yearRange?.maxYear
    ? ES.footer.coverage(yearRange.minYear, yearRange.maxYear)
    : null;
  return (
    <footer className="public-foot">
      <span>{ES.footer.sources}</span>
      {coverage && <span> · {coverage}</span>}
      <br />
      <span>{ES.footer.countNote}</span>
    </footer>
  );
}
