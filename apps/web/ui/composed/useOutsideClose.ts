import { useEffect } from 'react';
import { isInsideAnyPanel } from './popover-registry.js';

/* ── useOutsideClose ──────────────────────────────────────
 * The "dismiss when a mousedown lands outside" effect, extracted so every
 * popover/dropdown shares ONE implementation instead of re-typing the
 * mousedown + contains(target) dance (it had drifted across ~6 components).
 *
 * `extraRefs` covers panels that portal OUTSIDE the anchor subtree (e.g.
 * Popover's body): a click there must NOT count as outside. A click inside ANY
 * currently-open popover panel (the shared registry) is also never outside —
 * that's what makes a NESTED popover (a calendar opened from inside a filter
 * popover) not collapse its parent when you click the inner panel. */
export function useOutsideClose(
    anchorRef: React.RefObject<HTMLElement | null>,
    active: boolean,
    onClose: () => void,
    extraRefs: ReadonlyArray<React.RefObject<HTMLElement | null>> = [],
) {
    useEffect(() => {
        if (!active) return;
        const onDown = (e: Event) => {
            const t = e.target;
            if (!(t instanceof Node)) return;
            if (anchorRef.current?.contains(t)) return;
            for (const r of extraRefs) if (r.current?.contains(t)) return;
            if (isInsideAnyPanel(t)) return;   // inside some other open popover panel (nesting)
            onClose();
        };
        /* Arm on the next tick so the same click that opened the surface
         * doesn't immediately close it. Covers touch as well as mouse. */
        const arm = setTimeout(() => {
            document.addEventListener('mousedown', onDown);
            document.addEventListener('touchstart', onDown);
        }, 0);
        return () => {
            clearTimeout(arm);
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('touchstart', onDown);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);
}
