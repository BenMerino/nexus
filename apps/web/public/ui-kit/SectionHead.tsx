import React from 'react';
import { BaseBox, BaseText } from '../../ui/primitives';

/* SectionHead — nexus app molecule (no Zincro equivalent), rebuilt on the
 * vendored BaseBox/BaseText primitives. `.section-head` / `.section-title` /
 * `.eyebrow` classes are kept so existing shared.css spacing rules still apply. */

export function SectionHead({ eyebrow, title, right }: {
  eyebrow?: React.ReactNode; title: React.ReactNode; right?: React.ReactNode;
}) {
  return (
    <BaseBox display="flex" justify="between" align="start" className="section-head">
      <div>
        {eyebrow && <BaseText as="div" variant="label" color="muted" className="eyebrow">{eyebrow}</BaseText>}
        <BaseText as="h2" variant="h2" className="section-title">{title}</BaseText>
      </div>
      {right}
    </BaseBox>
  );
}
