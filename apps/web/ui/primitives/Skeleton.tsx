import React from 'react';

/**
 * The ONE skeleton primitive. Every component's loading state is built from
 * this — no component re-implements the shimmer. Two modes, matching the
 * `.skel` philosophy in shared.css:
 *
 *  · GHOST (default) — wrap the REAL element (placeholder content inside) so
 *    the skeleton's geometry is byte-identical to the loaded version. The class
 *    paints the shimmer and hides the placeholder text/children.
 *      <Skeleton><span className="stat-value">0,000</span></Skeleton>
 *
 *  · BLOCK — a standalone shimmer box sized by width/height, for regions with
 *    no real element to ghost (SVG/canvas plots, avatars, bars).
 *      <Skeleton block width="60%" height={14} />
 *      <Skeleton block fill radius="card" />   // absolute-fill a positioned parent
 *
 * The shimmer animation + colours live once in shared.css (`.skel`/`.skel-fill`);
 * this component only chooses which class + box to render.
 */
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Standalone shimmer box (sized by width/height) instead of ghosting children. */
  block?: boolean;
  /** Absolutely fill a positioned parent (for SVG/canvas plot areas). Implies block. */
  fill?: boolean;
  width?: number | string;
  height?: number | string;
  /** Corner radius role; defaults to the small skeleton radius. */
  radius?: 'sm' | 'card' | 'pill' | 'control';
  /** The element to render as (ghost mode wraps your real markup). */
  as?: React.ElementType;
  children?: React.ReactNode;
}

const RADIUS: Record<NonNullable<SkeletonProps['radius']>, string> = {
  sm: 'var(--radius-sm)', card: 'var(--radius-card)',
  pill: 'var(--radius-pill)', control: 'var(--radius-control)',
};

export function Skeleton({
  block, fill, width, height, radius, as, className, style, children, ...rest
}: SkeletonProps) {
  const Tag = (as ?? 'div') as React.ElementType;
  const isBox = block || fill;
  const cls = fill ? 'skel-fill' : 'skel';
  const composed: React.CSSProperties = {
    ...(width != null && { width }),
    ...(height != null && { height }),
    ...(radius && { borderRadius: RADIUS[radius] }),
    ...(isBox && !fill && height == null && { height: '1em' }),
    ...(isBox && { display: 'inline-block' }),
    ...style,
  };
  return (
    <Tag
      className={`${cls}${className ? ` ${className}` : ''}`}
      style={composed}
      aria-hidden="true"
      {...rest}
    >
      {isBox ? null : children}
    </Tag>
  );
}
