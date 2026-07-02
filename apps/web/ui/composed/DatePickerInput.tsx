import React from 'react';
import { Calendar as CalendarIcon, ChevronDown } from '../icons/index.js';
import { BaseBox, BaseIcon } from '../primitives/index.js';
import { InputFrame } from './InputFrame.js';

export interface DatePickerInputProps {
    isOpen: boolean; setIsOpen: (val: boolean) => void;
    inputValue: string; handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleBlur: () => void; handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    placeholder: string; inputRef: React.RefObject<HTMLInputElement>;
}

/* The DatePicker trigger is an InputFrame — the SAME input shell TimePicker
 * uses — so it reads the --_ctl-h control-size cascade and matches every other
 * control's height by construction (instead of hand-rolling padding/font, which
 * made it taller than DateRangePicker and violated S16). Glyphs are bare
 * BaseIcon — no size, no color — so both inherit by construction: --_ctl-icon
 * for size, and currentColor from the InputFrame's affordance slot (--text-muted)
 * for color. Nothing restated. Leading calendar icon, trailing chevron, a bare
 * input as the body. */
export const DatePickerInput: React.FC<DatePickerInputProps> = ({
    isOpen, setIsOpen, inputValue, handleInputChange, handleBlur, handleKeyDown, placeholder, inputRef
}) => (
    <InputFrame
        onClick={() => setIsOpen(true)}
        leading={<BaseIcon icon={CalendarIcon} />}
        trailing={
            <BaseIcon icon={ChevronDown}
                style={{ cursor: 'pointer', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : undefined }}
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); setIsOpen(!isOpen); }}
            />
        }
    >
        <BaseBox as="input" ref={inputRef} type="text" placeholder={placeholder} value={inputValue}
            onChange={handleInputChange} onBlur={handleBlur} onKeyDown={handleKeyDown}
            className="input-frame__input" />
    </InputFrame>
);
