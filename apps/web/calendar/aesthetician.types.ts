import type { StatusType } from './calendar.types.js';
export type { StatusType } from './calendar.types.js';

/* ── Visual State (Phase 1 — current) ──────────────────────── */

export interface VisualStateContainer {
  bg?: string;
  border?: string;
  radius?: string;
  shadow?: string;
  padding?: string;
  animate?: string;
  className?: string;
}

export interface VisualStateText {
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'detail' | 'label';
  color?: string;
  weight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'black';
  className?: string;
}

export interface VisualStateIcon {
  name: string;
  color?: string;
  size?: number;
  animate?: string;
}

export interface VisualStateBadge {
  label: string;
  variant: 'primary' | 'secondary' | 'warning' | 'error' | 'info' | 'muted';
}

export interface VisualState {
  container?: VisualStateContainer;
  text?: VisualStateText;
  icon?: VisualStateIcon;
  badge?: VisualStateBadge;
}

/* ── Composition Outputs ───────────────────────────────────── */

export interface CSSBundle {
  tenantId: string;
  variables: Record<string, string>;
  darkVariables?: Record<string, string>;
  /** sRGB hex fallbacks for tokens that use oklch() — emitted before the main variables. */
  fallbacks?: Record<string, string>;
  darkFallbacks?: Record<string, string>;
}

export type PreviewType = 'calendar' | 'roster' | 'analytics' | 'showcase';

export interface PreviewSpec {
  tenantId: string;
  previewType: PreviewType;
  css: CSSBundle;
  statusConfig: Record<StatusType, {
    fill: string;
    stroke: string;
    dot: string;
    darkFill: string;
    darkStroke: string;
  }>;
  components: Record<string, VisualState>;
}

export interface DNAValidationResult {
  valid: boolean;
  violations: { field: string; reason: string }[];
}
