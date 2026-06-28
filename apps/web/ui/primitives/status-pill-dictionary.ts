/** Tone resolvers for every status domain that ships with StatusPill.
 *  One source of truth for "what color + label is this enum value?"
 *  Add a new domain by extending `STATUS_DICTIONARY` — the type system
 *  enforces every union member has a row. */

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'orange';
export interface StatusToneEntry { tone: StatusTone; label: string }

const ORDER_STATUS = {
    open:      { tone: 'info',    label: 'Open' },
    archived:  { tone: 'neutral', label: 'Archived' },
    cancelled: { tone: 'danger',  label: 'Cancelled' },
} as const satisfies Record<string, StatusToneEntry>;

const PAYMENT_STATUS = {
    paid:     { tone: 'neutral', label: 'Paid' },
    partial:  { tone: 'warning', label: 'Partial' },
    unpaid:   { tone: 'danger',  label: 'Unpaid' },
    refunded: { tone: 'orange',  label: 'Refunded' },
} as const satisfies Record<string, StatusToneEntry>;

const APPOINTMENT_STATUS = {
    reserved:  { tone: 'info',    label: 'Reserved' },
    confirmed: { tone: 'info',    label: 'Confirmed' },
    completed: { tone: 'success', label: 'Completed' },
    cancelled: { tone: 'neutral', label: 'Cancelled' },
    noshow:    { tone: 'danger',  label: 'No-show' },
} as const satisfies Record<string, StatusToneEntry>;

const PROVIDER_STATUS = {
    active:   { tone: 'success', label: 'Active' },
    inactive: { tone: 'neutral', label: 'Inactive' },
    archived: { tone: 'neutral', label: 'Archived' },
} as const satisfies Record<string, StatusToneEntry>;

/** Service-catalog lifecycle. Distinct from PROVIDER_STATUS — services
 *  have a `paused` state (temporarily unavailable but not retired) that
 *  providers don't. Mirrors the schema enum in services-paginated.ts. */
const SERVICE_STATUS = {
    active:   { tone: 'success', label: 'Active' },
    paused:   { tone: 'warning', label: 'Paused' },
    archived: { tone: 'neutral', label: 'Archived' },
} as const satisfies Record<string, StatusToneEntry>;

/** Draft-order lifecycle. A draft is `open` until it passes the confirm
 *  gate, then `completed` (converted to a real order). Distinct from
 *  ORDER_STATUS — drafts never archive or cancel; they convert or are dropped. */
const DRAFT_STATUS = {
    open:      { tone: 'info',    label: 'Open' },
    completed: { tone: 'success', label: 'Converted' },
} as const satisfies Record<string, StatusToneEntry>;

const STATUS_DICTIONARY = {
    orderStatus:       ORDER_STATUS,
    paymentStatus:     PAYMENT_STATUS,
    appointmentStatus: APPOINTMENT_STATUS,
    providerStatus:    PROVIDER_STATUS,
    serviceStatus:     SERVICE_STATUS,
    draftStatus:       DRAFT_STATUS,
} as const;

export type StatusKind = keyof typeof STATUS_DICTIONARY;
export type StatusValueFor<K extends StatusKind> = keyof (typeof STATUS_DICTIONARY)[K] & string;

const NEUTRAL_FALLBACK: StatusToneEntry = { tone: 'neutral', label: '' };

/** Resolve a status enum value to its tone + label. Unknown values fall
 *  back to neutral with the raw value as label, so a stale enum doesn't
 *  blank the UI. */
export function statusPillResolve<K extends StatusKind>(
    kind: K,
    value: StatusValueFor<K> | string,
): StatusToneEntry {
    const dict = STATUS_DICTIONARY[kind] as Record<string, StatusToneEntry>;
    return dict[value] ?? { ...NEUTRAL_FALLBACK, label: String(value) };
}

/** Read-only catalog for DNA showcase + tests. Don't mutate. */
export const STATUS_PILL_CATALOG = STATUS_DICTIONARY;
