import React from 'react';
import { BaseBox } from '../primitives/index.js';
import { Button } from './Button.js';

export interface DatePickerFooterProps {
    onToday: () => void;
    onClose: () => void;
}

/* Footer sits --row-inset from the grid (the ONE origin inset the day cells use)
 * — no divider line and no leftover 16px section gap that read as the removed
 * divider's space. */
export const DatePickerFooter: React.FC<DatePickerFooterProps> = ({ onToday, onClose }) => (
    <BaseBox display="flex" justify="between" style={{ marginTop: 'var(--row-inset)' }}>
        <Button type="button" variant="ghost" size="sm" onClick={onToday} style={{ color: 'var(--primary)' }}>Today</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Close</Button>
    </BaseBox>
);
