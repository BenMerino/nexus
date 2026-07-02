import React from 'react';
import { MonthView } from './MonthView.js';
import { YearView } from './YearView.js';

export interface QuickCalendarProps {
  currentDate: Date; view: 'daily' | 'weekly' | 'monthly' | 'yearly'; onSelectDate: (date: Date) => void;
}

export function QuickCalendar({ currentDate, view, onSelectDate }: QuickCalendarProps) {
  switch (view) {
    case 'daily':
    case 'monthly':
      return <MonthView monthDate={currentDate} currentDate={currentDate} onSelectDate={onSelectDate} />;
    case 'weekly':
      return <MonthView monthDate={currentDate} currentDate={currentDate} showWeekHighlight onSelectDate={onSelectDate} />;
    case 'yearly':
      return <YearView currentDate={currentDate} onSelectDate={onSelectDate} />;
    default:
      return null;
  }
}
