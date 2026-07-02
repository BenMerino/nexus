import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  getWeek, getWeekOfMonth, getDaysInMonth, getQuarter,
} from 'date-fns';
import { BaseBox } from '../primitives/BaseBox.js';
import { BaseText } from '../primitives/BaseText.js';

/* Calendar header data contract + view-aware title. The header chrome itself is
 * assembled at the call site from SegmentedControl + plain BaseAction buttons
 * (admin: CalendarHeaderControls; landing: CalendarPreview) — there is no shared
 * "shell" component. These are the pieces those call sites still share: the prop
 * shape and the animated two-line view title. */

export interface CalendarHeaderProps {
  currentDate?: Date;
  title?: React.ReactNode;
  activeView?: string;
  onPrev?: () => void;
  onNext?: () => void;
  onToday?: () => void;
  onViewChange?: (view: string) => void;
  onViewHover?: (view: string) => void;
  onViewGroupLeave?: () => void;
  onNew?: () => void;
  afterNav?: React.ReactNode;
  afterTitle?: React.ReactNode;
  viewOverlay?: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

/* ── View-aware 2-line title ─────────────────────────── */

const ORDS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];

export function viewTitleData(view: string | undefined, d: Date) {
  if (view === 'weekly') {
    const ws = startOfWeek(d, { weekStartsOn: 1 });
    const we = endOfWeek(d, { weekStartsOn: 1 });
    const sw = getWeekOfMonth(ws, { weekStartsOn: 1 });
    const ew = getWeekOfMonth(we, { weekStartsOn: 1 });
    const sm = format(ws, 'MMMM');
    const em = format(we, 'MMMM');
    const sub = sm === em
      ? `${ORDS[sw]} week of ${sm}`
      : `${ORDS[sw]} week of ${sm} and ${ORDS[ew]} week of ${em}`;
    return { sub, main: `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}` };
  }
  if (view === 'monthly') {
    const ms = startOfMonth(d);
    const me = endOfMonth(d);
    const w1 = getWeek(ms, { weekStartsOn: 1 });
    const w2 = getWeek(me, { weekStartsOn: 1 });
    return { sub: `Weeks ${w1}–${w2} · ${getDaysInMonth(d)} days`, main: format(d, 'MMMM yyyy') };
  }
  if (view === 'yearly') {
    return { sub: `Q${getQuarter(d)} · ${format(d, 'MMMM')}`, main: format(d, 'yyyy') };
  }
  // daily (default)
  const wk = getWeek(d, { weekStartsOn: 1 });
  return { sub: `${format(d, 'EEEE')} · Week ${wk}`, main: format(d, 'MMMM d, yyyy') };
}

const titleVariants = {
  enter: { opacity: 0, y: 4, filter: 'blur(2px)' },
  center: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -4, filter: 'blur(2px)' },
};

export function CalendarViewTitle({ view, currentDate }: { view?: string; currentDate: Date }) {
  return <ViewTitle view={view} currentDate={currentDate} />;
}

function ViewTitle({ view, currentDate }: { view?: string; currentDate: Date }) {
  const { sub, main } = viewTitleData(view, currentDate);
  const key = `${view}-${main}`;
  return (
    <BaseBox style={{ position: 'relative', minWidth: '14rem' }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={key} variants={titleVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.15, ease: 'easeOut' }}>
          <BaseBox display="flex" flexDirection="col">
            <BaseText variant="h2" color="heading">{main}</BaseText>
            <BaseText variant="detail" color="muted" mt="0.5">{sub}</BaseText>
          </BaseBox>
        </motion.div>
      </AnimatePresence>
    </BaseBox>
  );
}
