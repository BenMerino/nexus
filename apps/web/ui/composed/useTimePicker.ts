import { useState, useEffect } from 'react';
import { formatTimeSetting } from '../../calendar/time-format.js';

export const useTimePicker = (value: string, onChange: (val: string) => void, timeFormat: '12h' | '24h', step: number) => {
    const [inputValue, setInputValue] = useState(value ? formatTimeSetting(value, timeFormat) : '');
    const is12h = timeFormat === '12h';

    useEffect(() => {
        setInputValue(value ? formatTimeSetting(value, timeFormat) : '');
    }, [value, timeFormat]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputEl = e.target;
        let val = inputEl.value.replace(/[^0-9:. apmAPM]/g, '');
        const oldVal = inputValue;
        if (val.length < oldVal.length) { setInputValue(val); return; }
        let digits = val.replace(/[^0-9]/g, ''), hr = '', mn = '', hasColon = val.includes(':');
        if (hasColon) { const parts = val.split(':'); hr = parts[0].replace(/[^0-9]/g, ''); mn = parts.length > 1 ? parts[1].replace(/[^0-9]/g, '') : ''; }
        else if (digits.length > 2) { hr = digits.slice(0, 2); mn = digits.slice(2, 4); hasColon = true; }
        else if (digits.length === 2 && ((is12h && parseInt(digits, 10) > 12) || (!is12h && parseInt(digits, 10) > 23))) { hr = digits.slice(0, 1); mn = digits.slice(1, 2); hasColon = true; }
        else hr = digits;
        if (hr.length === 2 && ((is12h && parseInt(hr, 10) > 12) || (!is12h && parseInt(hr, 10) > 23))) hr = hr.slice(0, 1);
        if (mn.length === 2 && parseInt(mn, 10) > 59) mn = mn.slice(0, 1);
        let newVal = hr;
        if (hasColon) newVal += ':' + mn;
        newVal += val.replace(/[0-9:]/g, '');
        if (newVal.split(':').length > 2) { setInputValue(oldVal); return; }
        setInputValue(newVal);
        const cursor = inputEl.selectionStart;
        if (cursor !== null) {
            setTimeout(() => {
                let newPos = cursor;
                if (!oldVal.includes(':') && newVal.includes(':') && cursor > newVal.indexOf(':')) newPos++;
                inputEl.setSelectionRange(Math.min(newPos, newVal.length), Math.min(newPos, newVal.length));
            }, 0);
        }
    };

    const handleInputBlur = () => {
        if (!inputValue.trim()) return;
        const match = inputValue.toLowerCase().trim().match(/^(\d{1,2})[:.]?(\d{1,2})?\s*(am|pm|a|p)?$/);
        if (match) {
            let h = parseInt(match[1], 10), m = parseInt(match[2] || '0', 10), ampm = match[3];
            if (h <= 23 && m <= 59 && !(h > 12 && ampm && is12h)) {
                if (ampm?.startsWith('p') && h < 12) h += 12;
                if (ampm?.startsWith('a') && h === 12) h = 0;
                if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
                    const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                    onChange(time); setInputValue(formatTimeSetting(time, timeFormat)); return;
                }
            }
        }
        setInputValue(value ? formatTimeSetting(value, timeFormat) : '');
    };

    const parsedH = value ? parseInt(value.split(':')[0], 10) : 0;
    const parsedM = value ? parseInt(value.split(':')[1], 10) : 0;
    const displayHour = is12h ? (parsedH === 0 ? 12 : (parsedH > 12 ? parsedH - 12 : parsedH)) : parsedH;
    const isPm = parsedH >= 12;

    const setHour = (h: number) => {
        let h24 = h;
        if (is12h) { if (isPm && h !== 12) h24 = h + 12; else if (!isPm && h === 12) h24 = 0; }
        onChange(`${h24.toString().padStart(2, '0')}:${parsedM.toString().padStart(2, '0')}`);
    };

    const setMinute = (m: number) => onChange(`${parsedH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    const setAmPm = (pm: boolean) => {
        if (!is12h) return;
        let h24 = parsedH;
        if (pm && parsedH < 12) h24 = parsedH + 12; else if (!pm && parsedH >= 12) h24 = parsedH - 12;
        onChange(`${h24.toString().padStart(2, '0')}:${parsedM.toString().padStart(2, '0')}`);
    };

    return { inputValue, handleInputChange, handleInputBlur, displayHour, displayMinute: parsedM, isPm, setHour, setMinute, setAmPm };
};
