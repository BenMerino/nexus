import React, { useRef } from 'react';
import { Clock, ChevronDown } from '../icons/index.js';
import { BaseBox, BaseIcon } from '../primitives/index.js';
import { Popover } from './Popover.js';
import { InputFrame } from './InputFrame.js';
import { useTimePicker } from './useTimePicker.js';
import { TimePickerDropdown, TIME_PICKER_PANEL_STYLE } from './TimePickerDropdown.js';

export interface TimePickerProps {
    value: string; onChange: (value: string) => void;
    timeFormat?: '12h' | '24h';
    min?: string; max?: string; step?: number; className?: string;
    /** Start with the dropdown open (inline editors, DNA catalog). Default false. */
    defaultOpen?: boolean;
}

export function TimePicker({ value, onChange, timeFormat = '24h', step = 1, className = '', defaultOpen = false }: TimePickerProps) {
    const is12h = timeFormat === '12h';
    const inputRef = useRef<HTMLInputElement>(null);
    const picker = useTimePicker(value, onChange, timeFormat, step);

    const hours = is12h ? Array.from({ length: 12 }, (_, i) => i === 0 ? 12 : i) : Array.from({ length: 24 }, (_, i) => i);
    const minutes = Array.from({ length: 60 / step }, (_, i) => i * step);

    return (
        <BaseBox className={className}>
            <Popover
                defaultOpen={defaultOpen}
                panelStyle={TIME_PICKER_PANEL_STYLE}
                panelClassName="nest-controls"
                trigger={({ open, toggle }) => (
                    <InputFrame
                        onClick={() => { if (!open) toggle(); }}
                        leading={<BaseIcon icon={Clock} />}
                        trailing={
                            <BaseIcon icon={ChevronDown}
                                style={{ cursor: 'pointer', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : undefined }}
                                onClick={(e: React.MouseEvent) => { e.stopPropagation(); toggle(); }}
                            />
                        }
                    >
                        <BaseBox
                            as="input" ref={inputRef} type="text" placeholder="Select Time" value={picker.inputValue}
                            onChange={picker.handleInputChange} onBlur={picker.handleInputBlur}
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { picker.handleInputBlur(); if (open) toggle(); } }}
                            className="input-frame__input"
                        />
                    </InputFrame>
                )}
            >
                {(close) => (
                    <TimePickerDropdown
                        is12h={is12h} hours={hours} minutes={minutes} isOpen
                        displayHour={picker.displayHour} displayMinute={picker.displayMinute} isPm={picker.isPm}
                        setHour={picker.setHour} setMinute={picker.setMinute} setAmPm={picker.setAmPm} onDone={close}
                    />
                )}
            </Popover>
        </BaseBox>
    );
}
