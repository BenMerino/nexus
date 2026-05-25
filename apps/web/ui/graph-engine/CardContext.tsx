/**
 * Graph engine — card-level positioning context.
 *
 * Provides chart-config components with a reference to the outer card
 * element, so each chart's canvas can render at card size (filling the
 * card via position:absolute) with its data confined to an active
 * region representing the chart-render area within the card.
 *
 * One canvas per card. The molecule grid covers the entire card; chrome
 * (title, slider, legend) floats on top via z-index. Chart's data only
 * lights up cells inside the active region.
 */

import React, { createContext, useContext, useEffect, useRef, useState, type RefObject } from 'react';

export interface CardSizing {
    /** Card outer dimensions in CSS pixels. */
    width: number;
    height: number;
    /** Ref to the card element so chart-configs can read positioned ancestor. */
    cardRef: RefObject<HTMLElement | null>;
}

const CardContext = createContext<CardSizing | null>(null);

/** Provider — wraps the card element. Tracks its size via ResizeObserver. */
export function CardProvider({ cardRef, children }: {
    cardRef: RefObject<HTMLElement | null>;
    children: React.ReactNode;
}) {
    const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

    useEffect(() => {
        const el = cardRef.current;
        if (!el) return;
        const update = () => {
            const rect = el.getBoundingClientRect();
            setSize(prev => (
                prev.width === rect.width && prev.height === rect.height
                    ? prev
                    : { width: rect.width, height: rect.height }
            ));
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [cardRef]);

    return (
        <CardContext.Provider value={{ width: size.width, height: size.height, cardRef }}>
            {children}
        </CardContext.Provider>
    );
}

/** Read the current card sizing. Returns null when used outside a CardProvider
 *  (e.g., the loader, which is its own self-contained molecule). */
export function useCardSizing(): CardSizing | null {
    return useContext(CardContext);
}

/** Measure a chart-render wrapper's offset within the card. Returns
 *  zero offset when not inside a card (chart-config falls back to its
 *  own pixel bounds). The chart-config component then passes the offset
 *  via its `chartOffset` prop. */
export function useChartOffset(
    wrapperRef: RefObject<HTMLElement | null>,
): { x: number; y: number } {
    const card = useCardSizing();
    const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    useEffect(() => {
        if (!card?.cardRef.current || !wrapperRef.current) return;
        const update = () => {
            const cardRect = card.cardRef.current?.getBoundingClientRect();
            const wrapRect = wrapperRef.current?.getBoundingClientRect();
            if (!cardRect || !wrapRect) return;
            const x = wrapRect.left - cardRect.left;
            const y = wrapRect.top - cardRect.top;
            setOffset(prev => (prev.x === x && prev.y === y) ? prev : { x, y });
        };
        update();
        const ro = new ResizeObserver(update);
        if (card.cardRef.current) ro.observe(card.cardRef.current);
        if (wrapperRef.current) ro.observe(wrapperRef.current);
        return () => ro.disconnect();
    }, [card, wrapperRef]);
    return offset;
}

/** Compute chart-config canvas placement: when a card context exists,
 *  the canvas fills the card with the chart-render area as active region.
 *  When no card context, the canvas behaves as today (own pixel bounds).
 *
 *  `chartRenderRef` must point to the chart-render area inside the card —
 *  used to measure the offset of chart data within the card. */
export function useCardPlacement(
    chartRenderRef: RefObject<HTMLElement | null>,
    chartWidth: number,
    chartHeight: number,
): {
    cssWidth: number;
    cssHeight: number;
    chartOffset: { x: number; y: number };
    insideCard: boolean;
} {
    const card = useCardSizing();
    const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    useEffect(() => {
        if (!card?.cardRef.current || !chartRenderRef.current) return;
        const update = () => {
            const cardRect = card.cardRef.current?.getBoundingClientRect();
            const chartRect = chartRenderRef.current?.getBoundingClientRect();
            if (!cardRect || !chartRect) return;
            const x = chartRect.left - cardRect.left;
            const y = chartRect.top - cardRect.top;
            setOffset(prev => (prev.x === x && prev.y === y) ? prev : { x, y });
        };
        update();
        const ro = new ResizeObserver(update);
        if (card.cardRef.current) ro.observe(card.cardRef.current);
        if (chartRenderRef.current) ro.observe(chartRenderRef.current);
        return () => ro.disconnect();
    }, [card, chartRenderRef]);

    if (card && card.width > 0 && card.height > 0) {
        return {
            cssWidth: card.width,
            cssHeight: card.height,
            chartOffset: offset,
            insideCard: true,
        };
    }
    return {
        cssWidth: chartWidth,
        cssHeight: chartHeight,
        chartOffset: { x: 0, y: 0 },
        insideCard: false,
    };
}
