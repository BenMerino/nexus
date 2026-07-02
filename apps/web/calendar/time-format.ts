import { parse, format, isValid } from 'date-fns';

export function formatTimeSetting(timeStr: string, timeFormat: '12h' | '24h'): string {
    if (!timeStr) return '';
    try {
        const date = parse(timeStr, 'HH:mm', new Date());
        if (!isValid(date)) return timeStr;
        return timeFormat === '12h' ? format(date, 'h:mm a') : format(date, 'HH:mm');
    } catch {
        return timeStr;
    }
}
