import { BaseBox, BaseText, BaseAction } from '../primitives/index.js';
import React from 'react'
import { motion } from 'framer-motion'
import { MOTION } from '../motion-presets.js'
import { clsx } from 'clsx'
import './segmented-control.css'

export interface Segment<T extends string> {
  value: T
  label: string
  icon?: React.ReactNode
  /** Semantic active color for this segment (e.g. status red/green). When the
   *  segment is active, its indicator tints to this color and the label adopts
   *  it, instead of the default --primary. Used by the calendar status/payment
   *  switchers where color encodes meaning. */
  activeColor?: string
}

export type SegmentedControlVariant = 'pill' | 'solid'

export interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[]
  value: T
  onChange: (value: T) => void
  variant?: SegmentedControlVariant
  stretch?: boolean
  layoutId?: string
  /** Hover preview — hosts that show an overlay for the hovered segment
   *  (calendar D/W/M/Y). Pair with onMouseLeave on the host's wrapper. */
  onHover?: (value: T) => void
  className?: string
}

const SEG_BTN_STYLE: React.CSSProperties = { position: 'relative', zIndex: 10 }

/* The label reads the control cascade — font/weight from the same --_ctl-* the
 * button publishes, so a segment's text matches the same-tier button. BaseText
 * defaults to variant="body" and injects --text-body/--weight-body INLINE; a
 * CSS class can't beat that, so the role is passed inline here (the NEST_LABEL
 * pattern). Without it every segment rendered at body size, not control size. */
const SEG_LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--_ctl-font)',
  fontWeight: 'var(--_ctl-weight)' as React.CSSProperties['fontWeight'],
}

function SegmentedControlInner<T extends string>({
  segments, value, onChange, variant = 'pill',
  stretch = false, layoutId: layoutIdProp,
  onHover, className,
}: SegmentedControlProps<T>) {
  /* Per-instance default — a SHARED literal default made two unlabelled
   * controls on one page trade their indicator via framer's layout
   * animation. Explicit layoutId still wins (intentional sharing). */
  const autoId = React.useId()
  const layoutId = layoutIdProp ?? autoId
  const isActive = (v: T) => value === v
  const usesPrimaryIndicator = variant === 'solid'

  const indicatorStyle: React.CSSProperties = {
    zIndex: -1,
    /* `--primary-fill` (dark-legible), not raw `--primary`: the solid indicator
     * is a brand FILL — a near-black tenant primary would vanish on the dark
     * wrapper. Floored in dark via dna-defaults. */
    ...(usesPrimaryIndicator && { backgroundColor: 'var(--primary-fill)' }),
  }

  /* Label colour MUST be inline: BaseText defaults color="body" and injects
   * --text-main inline, which beats any .seg-active/.seg-inactive class — so
   * colour is set here, where it can win. The standard segmented figure-ground:
   *   selected   = strongest foreground (--text-main; --text-inverse on solid's
   *                brand fill)
   *   unselected = --text-muted (recedes)
   * (Was --primary-text for pill — an accent that vanished for grey-primary
   * tenants, so selected read the same grey as unselected.) The hover
   * affordance is the inset highlight (::before), not a text shift. */
  const activeTextColor = variant === 'solid' ? 'var(--text-inverse)' : 'var(--text-main)'

  return (
    <BaseBox className={clsx('seg-wrap', `seg-wrap-${variant}`, className)} display="flex" align="center">
      {segments.map((seg) => {
        const active = isActive(seg.value)
        /* A segment's own activeColor (status red/green) overrides the default
         * indicator fill + active text — color carries meaning here. */
        const segIndicatorStyle = active && seg.activeColor
          ? { ...indicatorStyle, backgroundColor: `color-mix(in srgb, ${seg.activeColor} 20%, transparent)`, border: `1px solid ${seg.activeColor}` }
          : indicatorStyle
        /* activeColor (status red/green) carries domain meaning → wins over the
         * default active colour. Inactive segments always read muted. */
        const labelColor = active
          ? (seg.activeColor ?? activeTextColor)
          : 'var(--text-muted)'
        return (
        <BaseAction
          key={seg.value} type="button" size="sm"
          onClick={() => { if (!active) onChange(seg.value) }}
          onMouseEnter={onHover ? () => onHover(seg.value) : undefined}
          className={clsx('seg-btn', stretch && 'flex-1')}
          style={SEG_BTN_STYLE}
        >
          {active && (
            <motion.span
              layoutId={layoutId}
              className={clsx('seg-indicator', `seg-indicator-${variant}`)}
              style={segIndicatorStyle}
              {...MOTION.indicatorSlide}
            />
          )}
          <BaseText
            as="span"
            className={clsx('seg-label', active ? 'seg-active' : 'seg-inactive')}
            style={{ ...SEG_LABEL_STYLE, color: labelColor }}
          >
            {seg.icon && <BaseText as="span" className="shrink-0 inline-flex">{seg.icon}</BaseText>}
            {seg.label}
          </BaseText>
        </BaseAction>
        )
      })}
    </BaseBox>
  )
}

/* Pure controlled component — memoized so parent re-renders that don't
 * change segments/value/onChange skip the per-segment subtree. Cast
 * preserves the generic `<T>` signature React.memo would otherwise erase. */
export const SegmentedControl = React.memo(SegmentedControlInner) as typeof SegmentedControlInner
