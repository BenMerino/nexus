// ─────────────────────────────────────────────────────────────────────────────
// ui/icons — nexus-owned icon boundary (NOT synced from Zincro).
//
// Zincro migrated its monorepo off lucide-react onto a Hugeicons-backed
// `ui/icons/` module (icon-factory + generated icon sets, deps @hugeicons/*).
// nexus already ships lucide-react and has no Hugeicons dependency, so instead
// of vendoring Zincro's icon registry we expose the SAME named surface backed
// by lucide. Zincro deliberately keeps lucide names for every glyph, so a
// straight re-export satisfies every synced `from '../icons/index.js'` import
// byte-for-byte — no per-file edits, no re-drift against the engine sync.
//
// Add a glyph here only when a freshly-synced file imports a new icon name.
// Keep this file in sync-engine.sh's nexus-owned set if the boundary formalizes.
// ─────────────────────────────────────────────────────────────────────────────
import type React from 'react';

// Value re-exports: the icon names the synced engine/composed/primitive layer
// pulls from '../icons/index.js'. All exist in lucide-react under these names.
export {
  CalendarDays,
  Calendar,
  Check,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  Search,
  X,
  Copy,
  Info,
  HelpCircle,
  AlertCircle,
  AlertTriangle,
  CloudOff,
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

// Type surface mirroring Zincro's icon-factory. lucide components are
// React.ComponentType<SVGProps>, structurally compatible with IconProps, so
// `<BaseIcon icon={Calendar} />` type-checks against React.ComponentType<IconProps>.
export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'ref'> {
  size?: number | string;
  strokeWidth?: number | string;
}
export type LucideIcon = React.ComponentType<IconProps>;
export type LucideProps = IconProps;
