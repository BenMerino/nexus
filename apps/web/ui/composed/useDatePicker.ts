import { useState, useEffect } from 'react';
import { format, parse, isValid } from 'date-fns';

export const useDatePicker = (value: string, onChange: (val: string) => void) => {
    const [inputValue, setInputValue] = useState('');
    const [viewDate, setViewDate] = useState(new Date());

    useEffect(() => {
        if (value) {
            try {
                const date = parse(value, 'yyyy-MM-dd', new Date());
                if (isValid(date)) { setInputValue(format(date, 'dd-MM-yyyy')); setViewDate(date); }
            } catch { setInputValue(''); }
        } else { setInputValue(''); }
    }, [value]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputEl = e.target;
        let val = inputEl.value.replace(/[^0-9-]/g, '');
        const oldVal = inputValue;
        if (val.length < oldVal.length) { setInputValue(val); return; }
        let digits = val.replace(/[^0-9]/g, ''), dd = digits.slice(0, 2), mm = digits.slice(2, 4), yyyy = digits.slice(4, 8);
        if (dd.length === 2) { const d = parseInt(dd, 10); if (d > 31) dd = '31'; if (d === 0) dd = '01'; }
        if (mm.length === 2) { const m = parseInt(mm, 10); if (m > 12) mm = '12'; if (m === 0) mm = '01'; }
        let newVal = dd;
        if (digits.length > 2 || val.includes('-', 2)) { newVal += '-' + mm; if (digits.length > 4 || val.lastIndexOf('-') > 2) newVal += '-' + yyyy; }
        setInputValue(newVal);
        const cursor = inputEl.selectionStart;
        if (cursor !== null) {
            setTimeout(() => {
                let newPos = cursor;
                if (!oldVal.includes('-') && newVal.includes('-') && cursor > newVal.indexOf('-')) newPos++;
                const oldH = (oldVal.match(/-/g) || []).length, newH = (newVal.match(/-/g) || []).length;
                if (newH > oldH && cursor > newVal.lastIndexOf('-')) newPos++;
                inputEl.setSelectionRange(Math.min(newPos, newVal.length), Math.min(newPos, newVal.length));
            }, 0);
        }
    };

    const handleBlur = () => {
        if (!inputValue) return;
        const parts = inputValue.split('-');
        if (parts.length === 3) {
            let [d, m, y] = parts;
            d = d.padStart(2, '0'); m = m.padStart(2, '0');
            if (y.length === 2) y = '20' + y;
            if (y.length === 4) {
                const date = parse(`${y}-${m}-${d}`, 'yyyy-MM-dd', new Date());
                if (isValid(date)) { onChange(format(date, 'yyyy-MM-dd')); setInputValue(format(date, 'dd-MM-yyyy')); return; }
            }
        }
        if (value) { const date = parse(value, 'yyyy-MM-dd', new Date()); setInputValue(format(date, 'dd-MM-yyyy')); }
        else setInputValue('');
    };

    return { inputValue, setInputValue, viewDate, setViewDate, handleInputChange, handleBlur };
};
