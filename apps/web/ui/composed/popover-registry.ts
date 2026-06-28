/* ── Popover panel registry ───────────────────────────────
 * Module-level set of every CURRENTLY-OPEN popover panel element. Popover
 * registers its panel here while open; `useOutsideClose` consults it so a
 * mousedown landing inside ANY open panel never counts as "outside" for an
 * ancestor popover.
 *
 * Why this exists: popover panels portal to <body>, so a nested popover
 * (a calendar opened from inside a filter popover) is NOT a DOM descendant
 * of its parent's panel. Without a shared registry, clicking the inner panel
 * reads as outside-the-parent and collapses the whole stack mid-interaction.
 * The registry makes nesting work BY CONSTRUCTION — no manual extraRefs
 * threading between parent and child.
 */

const openPanels = new Set<HTMLElement>();

/** Register an open panel; returns the unregister fn (call on close/unmount). */
export function registerPanel(el: HTMLElement): () => void {
    openPanels.add(el);
    return () => { openPanels.delete(el); };
}

/** True if the node sits inside ANY currently-open popover panel. */
export function isInsideAnyPanel(node: Node): boolean {
    for (const el of openPanels) if (el.contains(node)) return true;
    return false;
}
