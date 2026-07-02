import React from 'react';
import { BaseBox } from '../primitives/index.js';
import { TimeSection } from './TimeSection.js';
import { Button } from './Button.js';

/* The panel BODY only — surface + the Hr/Min/(A·P) columns. Placement and the
 * open animation are owned by <Popover> (MOTION.dropdownOpen); this is rendered
 * inside the popover slot, so it's always "open". */
export interface TimePickerDropdownProps {
    is12h: boolean; hours: number[]; minutes: number[];
    displayHour: number; displayMinute: number; isPm: boolean;
    setHour: (h: number) => void; setMinute: (m: number) => void;
    setAmPm: (pm: boolean) => void;
    /** Close the popover (Done button). */
    onDone: () => void;
    /** Always true inside the popover slot; forwarded to TimeSection scroll logic. */
    isOpen: boolean;
}

/* Non-surface panel extras only — the glass is owned by Popover. The
 * inset/concentric triple is NOT here either: the body wrapper below publishes
 * --_nest-* via the cascade (radius="card" pad="row"), one source, like the calendar. */
export const TIME_PICKER_PANEL_STYLE = {
    overflow: 'hidden', width: 'fit-content',
} as React.CSSProperties;

export const TimePickerDropdown: React.FC<TimePickerDropdownProps> = ({
    is12h, hours, minutes, displayHour, displayMinute, isPm, setHour, setMinute, setAmPm, onDone, isOpen
}) => (
    /* radius="card" pad="row" publishes the --_nest-* triple via the cascade so
     * the cells + Done button curve PARALLEL to the panel by construction. */
    <BaseBox className="nest-controls" radius="card" pad="row">
        <BaseBox display="flex" style={{ maxHeight: '15rem' }}>
            <TimeSection title="Hr" isOpen={isOpen} onSelect={setHour} options={hours.map(h => ({ label: is12h ? h.toString() : h.toString().padStart(2, '0'), value: h, isActive: h === displayHour }))} />
            <TimeSection title="Min" isOpen={isOpen} onSelect={setMinute} options={minutes.map(m => ({ label: m.toString().padStart(2, '0'), value: m, isActive: m === displayMinute }))} />
            {is12h &&
                <TimeSection title="A/P" isOpen={isOpen} onSelect={setAmPm} options={[{ label: 'AM', value: false, isActive: !isPm }, { label: 'PM', value: true, isActive: isPm }]} />
            }
        </BaseBox>
        <BaseBox display="flex" justify="end">
            <Button variant="ghost" size="sm" type="button" onClick={onDone}>Done</Button>
        </BaseBox>
    </BaseBox>
);
