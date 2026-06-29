import React from 'react';
import { MetaChip } from '../../ui/primitives';

/* ─────────────────────────────────────────────────────────────────────────────
   ui-kit — the ONE primitive surface for nexus app code (public/**).

   Replaces the old public/ui-primitives.tsx + the deleted public/ui/ phase-2
   copies. App code imports from here; everything routes to the vendored Zincro
   layer (apps/web/ui/primitives) so there is a single source of truth.

   - Vendored primitives are re-exported straight through.
   - App-specific molecules with no Zincro equivalent (Stat, SectionHead) are
     rebuilt ON the vendored primitives, here.
   - Thin legacy wrappers (Tag) map onto a vendored primitive (MetaChip).
   - Ico is nexus's own SVG dictionary (shell-icons), not a Zincro primitive —
     re-exported as-is; call sites keep using Ico.check etc.
   ───────────────────────────────────────────────────────────────────────────── */

// Vendored primitives — the real DNA layer.
export {
  BaseBox, BaseText, BaseAction, BaseTile, BaseCheckbox, BaseIcon,
  Divider, MetaChip, StatusPill, TweenedNumber, Skeleton,
} from '../../ui/primitives';

// nexus app molecules, rebuilt on the vendored primitives.
export { Stat, StatSkeleton } from './Stat';
export { SectionHead } from './SectionHead';

// nexus icon dictionary (not a Zincro primitive).
export { Ico } from '../shell-icons';

/* Tag — legacy thin chip. Maps onto the vendored MetaChip. `tone` and `mono`
 * preserve the old call-site API: tone picks the text color, mono switches to a
 * monospace face (kept via the existing .mono class). */
export function Tag({ children, tone = 'default', mono = false }: {
  children: React.ReactNode; tone?: 'default' | 'muted'; mono?: boolean;
}) {
  return (
    <MetaChip
      variant="caption"
      color={tone === 'muted' ? 'muted' : 'body'}
      className={`tag tag-${tone}${mono ? ' mono' : ''}`}
    >
      {children}
    </MetaChip>
  );
}
