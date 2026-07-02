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
  BaseNested, Nestable,
} from '../../ui/primitives';

// nexus app molecules, rebuilt on the vendored primitives.
export { Stat, StatSkeleton } from './Stat';
export { SectionHead } from './SectionHead';

// nexus icon dictionary (not a Zincro primitive).
export { Ico } from '../shell-icons';

/* Tag — the thin metadata chip, on the vendored MetaChip primitive. `tone`
 * picks the look: 'default'/'muted' for neutral chips, or a category tone
 * (author/journal/type/venue/…) → the systematic per-hue tag recipe in
 * shared.css via data-tone. `mono` switches to the monospace face. This is THE
 * tag component — call sites use it instead of hand-rolled `<span class="tag …">`. */
type TagTone =
  | 'default' | 'muted'
  | 'author' | 'journal' | 'publisher' | 'type' | 'venue' | 'institution' | 'year';
const CATEGORY_TONES = new Set<TagTone>([
  'author', 'journal', 'publisher', 'type', 'venue', 'institution', 'year',
]);
export function Tag({ children, tone = 'default', mono = false }: {
  children: React.ReactNode; tone?: TagTone; mono?: boolean;
}) {
  const isCategory = CATEGORY_TONES.has(tone);
  return (
    <MetaChip
      variant="caption"
      color={tone === 'muted' ? 'muted' : 'body'}
      data-tone={isCategory ? tone : undefined}
      className={`tag${isCategory ? ` ${tone}` : ` tag-${tone}`}${mono ? ' mono' : ''}`}
    >
      {children}
    </MetaChip>
  );
}
