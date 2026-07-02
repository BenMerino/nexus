import React, { useRef, useEffect, useCallback } from 'react';
import { BaseBox, BaseAction } from '../primitives/index.js';

/* Matches the DatePicker day cell exactly (CalendarDayView): a BaseAction SQUARE
 * (aspectRatio:1), control-radius corner, --space-0-5 margin, solid --primary fill
 * + inverse text when selected — so an hour/minute cell reads identically to a
 * calendar day. The square's side = --_ctl-h (the calendar day is the same control
 * tier); ITEM_H below is the scroll stride that holds it. */

interface TimeOption { label: string; value: any; isActive: boolean; }

export interface TimeSectionProps {
    title: string; options: TimeOption[];
    onSelect: (val: any) => void; isOpen: boolean;
}

/* Row stride = the FULL rendered row height = the cell square (--_ctl-h sm =
 * --space-8 = 32px) + its --row-inset margin each side (4px) = 40px. The
 * scroll-snap math (scrollTop / ITEM_H, the centering padTop/Bottom) needs a
 * pixel NUMBER and MUST equal the real row height — when it was 32 (cell only,
 * ignoring the 4px margins) the wheel reserved 5×32 for 40px rows, leaving dead
 * space at the viewport bottom (the gap below the last number). Keep in sync with
 * --_ctl-h sm + 2×--row-inset. */
const ITEM_H = 40;
const VISIBLE = 5;
const HALF = Math.floor(VISIBLE / 2);

export const TimeSection: React.FC<TimeSectionProps> = ({ title, options, onSelect, isOpen }) => {
    const listRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const activeIdx = options.findIndex(o => o.isActive);

    const scrollToIdx = useCallback((idx: number, smooth = true) => {
        const el = listRef.current;
        if (!el) return;
        el.scrollTo({ top: idx * ITEM_H, behavior: smooth ? 'smooth' : 'auto' });
    }, []);

    useEffect(() => {
        if (isOpen && activeIdx >= 0) {
            setTimeout(() => scrollToIdx(activeIdx, false), 30);
        }
    }, [isOpen]);

    const handleScroll = useCallback(() => {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            const el = listRef.current;
            if (!el) return;
            const idx = Math.round(el.scrollTop / ITEM_H);
            const clamped = Math.max(0, Math.min(idx, options.length - 1));
            if (clamped !== activeIdx) onSelect(options[clamped].value);
        }, 80);
    }, [activeIdx, options, onSelect]);

    return (
        /* Column width = the cell square (--space-8, the sm control height) + its
         * --row-inset margin each side — so the cell FILLS the column AND sits the
         * same --row-inset (4px) from the panel border as a ListItem row (date +
         * time + list share one inset). */
        <BaseBox style={{ width: 'calc(var(--space-8) + 2 * var(--row-inset))', position: 'relative', overflow: 'hidden' }}>
            {/* Column header — a plain centred LABEL (same role/construction as the
              * calendar weekday header, not a ghost button). Inset --row-inset like
              * every other child so its box is CONTAINED at the same margin from the
              * panel border (the panel has no padding; each child insets itself, as
              * the cells do — nothing touches the border). LABEL font; text-indent
              * balances the letter-spacing trail so the glyphs centre. */}
            <BaseBox style={{ textAlign: 'center', margin: 'var(--row-inset)', paddingBottom: 'var(--space-2)',
                fontSize: 'var(--text-label)', fontWeight: 'var(--weight-label)' as React.CSSProperties['fontWeight'],
                color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)',
                textIndent: 'var(--tracking-label)' }}>{title}</BaseBox>

            <BaseBox style={{ position: 'relative', height: VISIBLE * ITEM_H }}>
                {/* FIXED highlight indicator — solid --primary-fill, --shadow-sm.
                  * Sized to the CELL (--space-8 = 32px) centred in the 40px column
                  * (--row-inset inside, so HR/MIN indicators have a gap), and reads
                  * the SAME concentric --_nest-corner as the cell it sits behind, so
                  * the indicator and the cells share one corner. Fixed at the centre
                  * slot; numbers scroll under it. */}
                <BaseBox aria-hidden style={{ position: 'absolute', zIndex: 0, pointerEvents: 'none',
                    top: `calc(${HALF * ITEM_H}px + var(--row-inset))`, left: '50%', transform: 'translateX(-50%)',
                    width: 'var(--space-8)', height: 'var(--space-8)',
                    borderRadius: 'var(--_nest-corner, var(--radius-control))',
                    background: 'var(--primary-fill)', boxShadow: 'var(--shadow-sm)' }} />
                <BaseBox ref={listRef} className="scrollbar-none"
                    onScroll={handleScroll}
                    style={{ height: '100%', overflowY: 'auto', scrollSnapType: 'y mandatory',
                        position: 'relative', zIndex: 1,
                        paddingTop: HALF * ITEM_H, paddingBottom: HALF * ITEM_H }}>
                    {options.map((opt, i) => (
                        /* Items all scroll; NONE carry the highlight fill (that's the
                         * fixed band above). The one currently centred (isActive) just
                         * reads INVERSE text — it's sitting over the band. */
                        <BaseBox key={opt.label}
                            style={{ height: ITEM_H, scrollSnapAlign: 'center',
                                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <BaseAction type="button" size="sm" onClick={() => { onSelect(opt.value); scrollToIdx(i); }}
                                style={{ boxSizing: 'border-box', padding: 0, margin: 'var(--row-inset)',
                                    height: 'var(--_ctl-h)', aspectRatio: '1',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: 'transparent',
                                    /* The NEST-LABEL role (--nest-label-font/-weight) — the ONE font every
                                     * selectable value INSIDE a popover shares (list rows, day cells, wheel
                                     * numbers). Selection shown by the band fill + inverse text, NOT a weight
                                     * jump (was --_ctl 12/600 here, --weight-label/700 before that). */
                                    fontSize: 'var(--nest-label-font)', lineHeight: 1,
                                    fontWeight: 'var(--nest-label-weight)' as React.CSSProperties['fontWeight'],
                                    color: opt.isActive ? 'var(--text-inverse)' : 'var(--text-muted)',
                                    transition: 'color 0.15s' }}>
                                {opt.label}
                            </BaseAction>
                        </BaseBox>
                    ))}
                </BaseBox>
            </BaseBox>
        </BaseBox>
    );
};
