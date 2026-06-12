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
}

export type SegmentedControlVariant = 'pill' | 'tab' | 'solid' | 'underline'

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
  const usesPrimaryIndicator = variant === 'solid' || variant === 'underline'
  /* `pill` and `underline` paint active text in the brand accent. Use
   * `--primary-text` (the readable-on-surface accent) NOT raw `--primary`:
   * a dark-theme primary (e.g. black) is invisible as text, but `--primary`
   * is still correct as a FILL (the solid/underline indicator below). */
  const usesPrimaryActiveText = variant === 'pill' || variant === 'underline'

  const indicatorStyle: React.CSSProperties = {
    ...(variant !== 'underline' && { zIndex: -1 }),
    /* `--primary-fill` (dark-legible), not raw `--primary`: the solid/
     * underline indicator is a brand FILL — a near-black tenant primary
     * would vanish on the dark wrapper. Floored in dark via dna-defaults. */
    ...(usesPrimaryIndicator && { backgroundColor: 'var(--primary-fill)' }),
  }

  const activeInlineStyle: React.CSSProperties | undefined = usesPrimaryActiveText
    ? { color: 'var(--primary-text)' }
    : undefined

  return (
    <BaseBox className={clsx('seg-wrap', `seg-wrap-${variant}`, className)} display="flex" align="center">
      {segments.map((seg) => (
        <BaseAction
          key={seg.value} type="button" size="sm"
          onClick={() => { if (!isActive(seg.value)) onChange(seg.value) }}
          onMouseEnter={onHover ? () => onHover(seg.value) : undefined}
          className={clsx('seg-btn', `seg-btn-${variant}`, stretch && 'flex-1')}
          style={SEG_BTN_STYLE}
        >
          {isActive(seg.value) && (
            <motion.span
              layoutId={layoutId}
              className={clsx('seg-indicator', `seg-indicator-${variant}`)}
              style={indicatorStyle}
              {...MOTION.indicatorSlide}
            />
          )}
          <BaseText
            as="span"
            className={clsx(isActive(seg.value) ? clsx('seg-active', `seg-active-${variant}`) : 'seg-inactive')}
            style={isActive(seg.value) ? activeInlineStyle : undefined}
          >
            {seg.icon && <BaseText as="span" className="shrink-0 inline-flex">{seg.icon}</BaseText>}
            {seg.label}
          </BaseText>
        </BaseAction>
      ))}
    </BaseBox>
  )
}

/* Pure controlled component — memoized so parent re-renders that don't
 * change segments/value/onChange skip the per-segment subtree. Cast
 * preserves the generic `<T>` signature React.memo would otherwise erase. */
export const SegmentedControl = React.memo(SegmentedControlInner) as typeof SegmentedControlInner
