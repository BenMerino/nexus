import React from 'react';
import { format } from 'date-fns';
import { BaseBox, BaseText, BaseAction } from '../primitives/index.js';
import { CalendarDayView } from './CalendarDayView.js';

export interface MonthViewProps {
  monthDate: Date; currentDate: Date; showWeekHighlight?: boolean; onSelectDate: (date: Date) => void;
}

/* A titled month card around the shared CalendarDayView (QuickCalendar's
 * daily/weekly/monthly views). The card + "MMMM yyyy" title are this view's
 * only concern; the grid — and the week-highlight tint — comes from the shared
 * foundation. */
export const MonthView: React.FC<MonthViewProps> = ({ monthDate, currentDate, showWeekHighlight = false, onSelectDate }) => (
  /* Fixed width: the shared grid fills its container (width:100% for edge
   * alignment), so without a cap the card stretched to its parent. 232px keeps
   * the compact month size the old intrinsic 10px grid produced.
   * radius="card" + pad="row" publishes the --_nest-* concentric triple via the
   * BaseBox cascade, so the day cells curve PARALLEL to this card by construction
   * (was a hand-rolled inline triple — now one source). */
  <BaseBox className="nest-controls" radius="card" pad="row" shadow="xl" bg="var(--bg-card)" border="1px solid var(--border-main)"
    style={{ width: '232px' }}>
    {/* Month and year are TWO GHOST BaseAction segments (non-interactive: no
      * onClick, cursor:default, tabIndex -1), exactly like the opened DatePicker
      * header's seg('months')/seg('years') — each gets the control's UNIFORM box
      * inset by construction (not hand-rolled padding). The two adjacent ghost
      * boxes' insets give the inter-word gap; the month box aligns with column 1. */}
    <BaseBox as="h4" display="flex" align="center" mb="2" controlSize="sm">
      {(['MMMM', 'yyyy'] as const).map((fmt) => (
        <BaseAction key={fmt} variant="ghost" size="sm" tabIndex={-1}
          style={{ cursor: 'default' }}>
          <BaseText variant="body" weight="bold" color="heading"
            style={fmt === 'MMMM' ? { textTransform: 'capitalize' } : undefined}>{format(monthDate, fmt)}</BaseText>
        </BaseAction>
      ))}
    </BaseBox>
    <CalendarDayView monthDate={monthDate} selected={currentDate} showWeekHighlight={showWeekHighlight} onSelect={onSelectDate} />
  </BaseBox>
);
