import React from 'react';
import { BaseBox, BaseText } from '../ui/primitives';
import { TYPE_ROLES, FAMILIES } from '../ui/dna/type-scale.js';

/* The DNA catalog Typography section. Renders every type ROLE live, straight
 * from ui/dna/type-scale.js — the SAME source the generator emits dna.css +
 * tokens.ts from. So this gallery can never drift from the real contract: edit
 * the source, run `npm run gen:type`, and what you see here is what ships. */

const SAMPLE: Record<string, string> = {
  display: '1,247', h1: 'Faculty of Sciences', h2: 'Publications by year',
  h3: 'Journal of Materials', body: 'The quick brown fox jumps over the lazy dog.',
  detail: 'Secondary text and table cells read at this size.',
  caption: 'Sentence-style helper copy under an input.',
  label: 'Total papers', micro: '0000-0002-1825-0097',
};

function Spec({ role, r }: { role: string; r: typeof TYPE_ROLES[string] }) {
  const fam = FAMILIES[r.family];
  const meta = `${r.px}px · ${r.weight} · ${fam.token.replace('--font-', '')} · lh ${r.leading}` +
    (r.tracking !== 'inherit' ? ` · ls ${r.tracking}` : '');
  return (
    <BaseBox display="flex" flexDirection="col" gap="1"
      style={{ padding: 'var(--space-4) 0', borderBottom: '1px solid var(--border-soft)' }}>
      <BaseBox display="flex" gap="3" align="baseline" style={{ flexWrap: 'wrap' }}>
        <BaseText variant="label" color="muted" style={{ minWidth: 64 }}>{role}</BaseText>
        <BaseText variant="micro" color="muted">{meta}</BaseText>
      </BaseBox>
      <BaseText variant={role as any}>{SAMPLE[role] ?? role}</BaseText>
    </BaseBox>
  );
}

export function TypographySection() {
  return (
    <BaseBox display="flex" flexDirection="col" gap="2">
      <BaseText variant="body" color="muted">
        Every type role, rendered live from <code>ui/dna/type-scale.js</code> — the single
        source the generator emits <code>dna.css</code> + <code>tokens.ts</code> from. Use a
        role via <code>&lt;BaseText variant="…"&gt;</code> or the matching <code>var(--text-*)</code>
        tokens; never hand-pick a size (the N3 audit guard blocks it).
      </BaseText>
      <BaseBox display="flex" flexDirection="col" style={{ marginTop: 'var(--space-4)' }}>
        {Object.entries(TYPE_ROLES).map(([role, r]) => <Spec key={role} role={role} r={r} />)}
      </BaseBox>
    </BaseBox>
  );
}
