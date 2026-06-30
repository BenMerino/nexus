import { useState, useEffect } from 'react';

/* Chart re-render signal for the graph engine (injected as EngineConfig.useIsDark).
 *
 * The engine memoizes tessellated vertex colors and only re-runs when THIS hook's
 * value changes (ChartGeometryCanvas's `[primitives, m, isDark]` memo). Its
 * internal color cache is already cleared on every :root attribute mutation, so
 * the only thing needed for charts to track the live theme is for this value to
 * CHANGE whenever the tokens change.
 *
 * The sun pipeline (public/sky/) rewrites the chart/accent tokens every minute as
 * INLINE STYLE on :root (and sets data-theme). A plain boolean (the old `.dark`
 * class check — which was also wrong: the app uses data-theme, never a `.dark`
 * class) only flips once a day at the light/dark crossover, so charts lag
 * behind surfaces/buttons (which read `var(--chart-*)` live) until that flip.
 *
 * So this returns a monotonic VERSION counter that bumps on any :root
 * style/data-theme/class mutation — the engine re-tessellates with fresh,
 * cache-missed colors on every pipeline tick, as fast as everything else. (The
 * value is consumed only as a memo dep — never as dark-mode LOGIC — so a counter
 * satisfies the contract; the `as` keeps the engine's boolean typing happy.) */
export function useTheme(): boolean {
    const [version, setVersion] = useState(0);

    useEffect(() => {
        // A pipeline tick fires many style mutations (one per setProperty); the
        // MutationObserver already coalesces them into a SINGLE callback per batch
        // (it delivers one records[] array per microtask), so this bumps once per
        // tick, not once per token — one chart re-tessellate per tick.
        const observer = new MutationObserver(() => setVersion(v => v + 1));
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['style', 'data-theme', 'class'],
        });
        return () => observer.disconnect();
    }, []);

    return version as unknown as boolean;
}
