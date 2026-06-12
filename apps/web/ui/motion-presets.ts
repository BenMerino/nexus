/**
 * Motion Presets — Single source of truth for all animations.
 * Pipeline-governed: visible in DNA gallery, consumed by all 5 apps.
 *
 * Usage: import { MOTION, LOOPS, stagger } from '@zincro/shared';
 *   <motion.div {...MOTION.modalOpen} />
 *   <motion.div {...MOTION.scrollEnter} {...stagger(idx)} />
 */

// ── Core Presets (framer-motion transition configs) ──────

export const MOTION = {
  /** Modals, overlays, confirmation dialogs */
  modalOpen: {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 16 },
    transition: { type: 'spring' as const, damping: 25, stiffness: 300 },
  },
  /** Chat messages, notifications, console log entries */
  messageEnter: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { type: 'spring' as const, damping: 24, stiffness: 340, mass: 0.6 },
  },
  /** Search overlays, command palettes (drops from top) */
  searchDrop: {
    initial: { opacity: 0, y: -16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -16 },
    transition: { type: 'spring' as const, damping: 26, stiffness: 300, mass: 0.5 },
  },
  /** Dropdowns, context menus, tooltips (fast micro) */
  dropdownOpen: {
    initial: { opacity: 0, y: -4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
    transition: { duration: 0.14, ease: 'easeOut' as const },
  },
  /** Cards, list items on scroll (viewport-triggered) */
  scrollEnter: {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
  },
  /** Quick reply pills, badge sequences */
  quickPill: {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { type: 'spring' as const, stiffness: 400, damping: 30 },
  },
  /** SegmentedControl tab indicator, layout animations */
  indicatorSlide: {
    transition: { type: 'spring' as const, stiffness: 400, damping: 35 },
  },
  /** Hero titles, dramatic page entrances */
  heroEntrance: {
    initial: { opacity: 0, y: 40 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 1, ease: [0.16, 1, 0.3, 1] },
  },
  /** Collapsible sections, accordions, filter panels */
  collapse: {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: 'auto' as const },
    exit: { opacity: 0, height: 0 },
    transition: { type: 'spring' as const, stiffness: 400, damping: 35 },
  },
  /** Wizard/step forward (left to right) */
  stepForward: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  },
  /** Wizard/step backward (right to left) */
  stepBackward: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
  },
} as const;

// ── Loop Presets (infinite animations) ───────────────────

export const LOOPS = {
  /** HelpBot typing indicator — 3 bouncing dots */
  typingDots: { duration: 0.8, repeat: Infinity },
  /** Alert/conflict blink — status color flash */
  statusBlink: { duration: 1.2, repeat: Infinity },
  /** Bot avatar glow ring — conic gradient spin */
  glowSpin: { duration: 3, repeat: Infinity, ease: 'linear' as const },
} as const;

// ── Stagger Helper ───────────────────────────────────────

/** Returns a transition delay for staggered list entrances. */
export function stagger(index: number, interval = 0.07) {
  return { transition: { delay: index * interval } };
}
