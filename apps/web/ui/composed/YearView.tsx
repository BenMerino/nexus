import React from 'react';
import { format, eachMonthOfInterval, startOfYear, endOfYear } from 'date-fns';
import { BaseBox, BaseText } from '../primitives/index.js';
import { CalendarDayView } from './CalendarDayView.js';

export interface YearViewProps {
  currentDate: Date; onSelectDate: (date: Date) => void;
}

/* Twelve mini-months in a year panel — each a labelled card around the shared
 * CalendarDayView in `compact` mode. This view owns only the year container +
 * per-month label; the grid logic is the one foundation. */
export const YearView: React.FC<YearViewProps> = ({ currentDate, onSelectDate }) => {
  const months = eachMonthOfInterval({ start: startOfYear(currentDate), end: endOfYear(currentDate) });

  return (
    <BaseBox display="grid" pad="normal" density="normal" radius="card" shadow="2xl" overflow="auto" bg="var(--bg-card)" border="1px solid var(--border-main)"
      className="sm-grid-cols-3 lg-grid-cols-4" style={{ gridTemplateColumns: 'repeat(2, 1fr)', width: '400px', maxHeight: '80vh' }}>
      {months.map((month) => (
        <BaseBox key={month.toISOString()} pad="tight" radius="control" style={{ transition: 'background 0.15s' }}>
          <BaseText as="h5" variant="label" weight="black" color="heading" mb="1"
            style={{ borderBottom: '1px solid var(--border-main)', paddingBottom: 'var(--space-1)', letterSpacing: 'var(--tracking-display)' }}>{format(month, 'MMMM')}</BaseText>
          <CalendarDayView monthDate={month} selected={currentDate} onSelect={onSelectDate} compact />
        </BaseBox>
      ))}
    </BaseBox>
  );
};
