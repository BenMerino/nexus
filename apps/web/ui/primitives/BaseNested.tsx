import React from 'react';
import { BaseBox, type BaseBoxProps } from './BaseBox.js';
import './base-nested.css';

/* ── Nesting Cascade ───────────────────────────────────────
 * One primitive for "a child living inside a parent's silhouette."
 * Enforces the three properties that make nested visuals feel
 * coherent — by construction, not by convention:
 *
 *   1. Symmetric inset. The primitive takes ONE `inset` token
 *      and applies it to all four sides via margin. There is no
 *      `insetLeft` / `insetTop` API; asymmetric insets require
 *      dropping back to raw `m*=` props on <BaseBox>, which makes
 *      asymmetry a visible decision, not a quiet drift.
 *
 *   2. Matching inner radius. The primitive reads the PARENT'S
 *      radius family from React context (via <Nestable>) and
 *      picks `--radius-<family>-inner-<inset>` automatically. A
 *      `tight` inset inside an `sm`-radius parent gets
 *      `--radius-sm-inner-1`. No call site picks an inner-N
 *      manually; the cascade owns the math.
 *
 *   3. Family-aware surface. Pick from a small named set
 *      (`default | elevated | sunken`) rather than literal CSS.
 *      Surfaces compose with the parent's surface — an `elevated`
 *      child inside a `default` parent reads as a lift, regardless
 *      of dark-mode or tenant palette.
 *
 * The whole point is that the wrong answer is unspeakable in this
 * API. A developer cannot ship a 3-px-top-5-px-right nested badge
 * with mismatched corners through this primitive. They'd have to
 * deliberately bypass it with raw inline styles.
 *
 * Companion piece to the Density Cascade (gap + padding) — same
 * vocabulary (`tight | normal | loose`), same single-source-of-
 * truth philosophy. See docs/ui/NamingTaxonomy.md §Nesting Cascade.
 */

export type NestInset = 'flush' | 'tight' | 'normal' | 'loose';
export type NestSurface = 'default' | 'elevated' | 'sunken';

/* Inset → space token. Flush is hairline-only (badges hugging the
 * parent's edge, separated only by the parent's border); tight is
 * close-cousin nesting (kbd in a tile); normal is breathing-room
 * nesting (toolbar in a card); loose is section-level (region in
 * a modal body).
 *
 * `flush` resolves to --space-0-5 (2px), not the literal border-
 * width, so the visible gap accounts for the kbd's own 1px border
 * adding to the perceived distance — leaving ~3px between rendered
 * edges, which matches the cascade's smallest visual unit. */
const INSET_SPACE: Record<NestInset, string> = {
    flush:  'var(--space-0-5)',
    tight:  'var(--space-1)',
    normal: 'var(--space-2)',
    loose:  'var(--space-3)',
};

/* Inset → inner-N suffix (matches the radius cascade's variants). */
const INSET_INNER_SUFFIX: Record<NestInset, string> = {
    flush:  '0-5',
    tight:  '1',
    normal: '2',
    loose:  '3',
};

/* Surface → background token. Picks against the parent's surface
 * via the standard DNA palette. */
const SURFACE_BG: Record<NestSurface, string> = {
    default:  'var(--bg-card)',
    elevated: 'var(--bg-elevated)',
    sunken:   'var(--bg-main)',
};

/* Radius families that can host nested children. The generator
 * (dna-css-scales.ts) emits `--radius-<name>-inner-<N>` for each. */
export type ParentRadius =
    | 'sm' | 'md' | 'lg'
    | 'surface-sm' | 'surface-md' | 'surface-lg' | 'surface-xl' | 'surface-2xl';

interface NestableContextValue {
    parentRadius: ParentRadius;
    /* Parent's own inner padding, per axis, as CSS values. The Nested
     * child negates these via negative margin so the child's INSET
     * prop equals the total visible gap from the parent's border —
     * NOT parent.padding + child.margin (which would double-space).
     *
     * Default 0/0 — for parents that don't carry intrinsic padding
     * (cards relying on inner BaseBox padding, etc.), the child's
     * inset stands alone. */
    parentPaddingX: string;
    parentPaddingY: string;
}

/* The context lives at module scope so any descendant <BaseNested>
 * can read it. A missing provider falls back to the `sm` family with
 * zero padding — sensible defaults that won't blow up if Nested is
 * dropped somewhere without a Nestable ancestor. (`chrome` was retired
 * in Phase 4 and emits no inner-radius vars, so it can't be the fallback.) */
const NestableContext = React.createContext<NestableContextValue>({
    parentRadius: 'sm',
    parentPaddingX: '0px',
    parentPaddingY: '0px',
});

export interface NestableProps {
    parentRadius: ParentRadius;
    /** Parent's own padding-x as a CSS value — read by nested
     *  descendants to negate it so their inset stands alone. */
    parentPaddingX?: string;
    /** Parent's own padding-y as a CSS value. */
    parentPaddingY?: string;
    children: React.ReactNode;
}

/* Provider used by parent components (BaseTile, future BaseCard,
 * BasePanel, etc.) to publish their radius family AND padding to
 * nested descendants. Pure context wrapper — renders no DOM. */
export function Nestable({ parentRadius, parentPaddingX = '0px', parentPaddingY = '0px', children }: NestableProps) {
    const value = React.useMemo(() => ({ parentRadius, parentPaddingX, parentPaddingY }), [parentRadius, parentPaddingX, parentPaddingY]);
    return <NestableContext.Provider value={value}>{children}</NestableContext.Provider>;
}

export interface BaseNestedProps extends Omit<BaseBoxProps, 'as'> {
    as?: React.ElementType;
    /** How much breathing room between the child's edge and the
     *  parent's inner edge. Same trio as the Density Cascade. */
    inset?: NestInset;
    /** Surface treatment relative to the parent (which is typically
     *  `--bg-card`). Default is same surface; elevated lifts above;
     *  sunken sinks below. */
    surface?: NestSurface;
    /** Show a hairline border. Default true (matches the standard
     *  nested-badge look). */
    border?: boolean;
}

export const BaseNested = React.forwardRef<HTMLElement, BaseNestedProps>(function BaseNested({
    as = 'span',
    inset = 'tight',
    surface = 'elevated',
    border = true,
    className,
    style,
    children,
    ...rest
}, ref) {
    const { parentRadius, parentPaddingX, parentPaddingY } = React.useContext(NestableContext);
    const insetSpace = INSET_SPACE[inset];
    const innerRadiusVar = `var(--radius-${parentRadius}-inner-${INSET_INNER_SUFFIX[inset]})`;

    /* Negate the parent's padding so the child's INSET is the total
     * visible gap from the parent's border. Without this, the gap
     * would be parent.padding + child.margin (double-spaced).
     *
     * marginX = inset - parent.padding-x  (pulled back through padding)
     * marginY = inset - parent.padding-y
     *
     * When parent padding > inset, the result is negative — the child
     * overhangs into the parent's padding zone, landing at the inset
     * distance from the BORDER (which is what the visual reading of
     * "nested inside the parent's silhouette at distance X" requires). */
    const marginX = `calc(${insetSpace} - ${parentPaddingX})`;
    const marginY = `calc(${insetSpace} - ${parentPaddingY})`;

    const composedStyle: React.CSSProperties = {
        marginLeft: marginX,
        marginRight: marginX,
        marginTop: marginY,
        marginBottom: marginY,
        borderRadius: innerRadiusVar,
        backgroundColor: SURFACE_BG[surface],
        ...(border ? { border: '1px solid var(--border-main)' } : {}),
        /* Stretch on the cross-axis so vertical margins ACT as
         * margins. Without this, a flex-centred parent (the common
         * BaseTile shape) honours horizontal margin literally but
         * centres the child vertically — making the symmetric inset
         * contract asymmetric in render. Stretch forces the child to
         * occupy the full cross-axis space minus the margins, so
         * inset-Y produces a visible inset-Y. */
        alignSelf: 'stretch',
        ...style,
    };
    return (
        <BaseBox
            ref={ref}
            as={as}
            className={['base-nested', className].filter(Boolean).join(' ')}
            style={composedStyle}
            {...rest}
        >
            {children}
        </BaseBox>
    );
});
