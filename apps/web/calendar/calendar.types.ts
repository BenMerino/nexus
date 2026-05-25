export type CalendarView = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface CalendarBlock {
    id: string;
    startTime: string;
    endTime: string;
    [key: string]: any;
}

export interface TextSegment {
    yStart: number; yEnd: number;
    left: number; right: number;
}

export interface BlockLayout {
    left: number;
    width: number;
    polygonPoints?: string;
    textLeft?: number;
    textWidth?: number;
    fadeAt?: number;
    textSegments?: TextSegment[];
}

export interface PolygonEngineOptions {
    paddingX?: number;
}

export type AppointmentLayout = BlockLayout;

export type StatusType = 'reserved' | 'confirmed' | 'cancelled' | 'noshow' | 'completed';

export type ShiftSchedule = {
    id: string;
    providerId: string;
    dayOfWeek: number;
    start: string;
    end: string;
    breakIntervals?: { start: string; end: string }[];
    startDate?: string;
    endDate?: string;
    cycleType?: 'STANDARD' | 'BIMODAL';
    bimodalConfig?: {
        weekA: { start: string; end: string; isOff: boolean };
        weekB: { start: string; end: string; isOff: boolean };
    };
};

export type ShiftException = {
    id: string;
    providerId: string;
    date: string;
    type: 'Leave' | 'Overtime' | 'Emergency';
    status: 'Pending' | 'Approved' | 'Rejected';
    start?: string;
    end?: string;
    note?: string;
    color?: string;
};

export type ProviderStatus = 'active' | 'inactive' | 'archived';

export type Provider = {
    id: string;
    name: string;
    /** Areas the provider works in. Default capability — "I do nails." */
    areaIds: string[];
    /** Per-service opt-out within those areas — "Maria does all nails
     *  except acrylics." Replaces the legacy explicit serviceIds list. */
    excludedServiceIds?: string[];
    /** Phase L. Locations the provider does NOT work at. Empty = all
     *  locations (Shopify-channel: default available everywhere). */
    excludedLocationIds?: string[];
    phone: string;
    email: string;
    address: string;
    birthday: string;
    availabilityStart?: string;
    availabilityEnd?: string;
    status?: ProviderStatus;
    statusChangedAt?: string | null;
    statusUntil?: string | null;
    statusReason?: string | null;
};

export type Area = { id: string; name: string; color: string; sortOrder: number };

/** @deprecated Use Area. Legacy alias retained during Phase A rename. */
export type Group = Area;

/** Phase L. A tenant's physical location. Every tenant has ≥1 (a "Main
 *  location" auto-created by migration). Multi-location tenants can add
 *  more; single-location tenants never see a picker (hidden when
 *  `locations.length === 1`). */
export type Location = {
    id: string;
    name: string;
    address?: string | null;
    active: boolean;
    sortOrder: number;
    isDefault: boolean;
    createdAt?: string;
};

export type Category = { id: string; name: string; color: string; parentId?: string; bookable?: boolean; areaId?: string | null };

export type DepositType = 'none' | 'percentage' | 'fixed' | 'full';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export type Service = {
    id: string;
    name: string;
    categoryId: string;
    /** Derived at read time via category.areaId. canPerform consumes
     *  this directly so capability checks don't need a category lookup. */
    areaId?: string | null;
    duration: number;
    price: number;
    commissionRate: number;
    isSimultaneous?: boolean;
    active?: boolean;
    depositType?: DepositType;
    depositValue?: number;
    /** Phase L. Locations the service is NOT offered at. Empty = all
     *  locations (Shopify-channel: default available everywhere). */
    excludedLocationIds?: string[];
};

/* Client is a universal domain noun — definition now lives in
 * packages/shared/src/types/client.types.ts. Re-exported here so
 * existing calendar consumers keep their imports working without
 * having to touch any code. */
export type { Client } from '../types/client.types.js';

export type BookingService = { serviceId: string; startTimeOffset: number; duration: number; price: number; commission: number; isSimultaneous: boolean };

/** @deprecated Use `BookingService`. Alias retained during the Phase 6 rename window. */
export type AppointmentService = BookingService;

/**
 * `Booking` is the canonical domain noun for a scheduled service line item
 * (one row in `order_line_items` with `kind='service'` and `scheduled_*`
 * fields set). The legacy `Appointment` alias is preserved for the rename
 * window — see docs/ui/NamingTaxonomy.md §Domain Noun Canon.
 */
export type Booking = {
    id: string;
    clientId: string;
    providerId: string;
    services: BookingService[];
    date: string;
    startTime: string;
    endTime: string;
    scheduledEndTime: string;
    areaId?: string;
    status: StatusType;
    totalPrice: number;
    totalCommission: number;
    paymentStatus?: PaymentStatus;
    depositAmount?: number;
    amountPaid?: number;
    isConflict?: boolean;
    conflictReason?: string;
};

/** @deprecated Use `Booking`. Alias retained during the Phase 6 rename window. */
export type Appointment = Booking;

export type BusinessHours = {
    days: { dayOfWeek: number; isOpen: boolean; open: string; close: string }[];
    specialDays: { date: string; isOpen: boolean; open: string; close: string; note?: string }[];
};

export type BusinessInfo = {
    name: string;
    address: string;
    description: string;
    openingDate: string;
    closingDate: string;
};

export type TimeBlock = {
    start: string;
    end: string;
    type: 'blocked' | 'appointment' | 'out-of-shift' | 'business-closed' | 'unsupported-service';
    id?: string;
    title?: string;
    color?: string;
};

export interface ValidationResult {
    isSafe: boolean;
    reason?: string;
    type?: 'overlap' | 'blocked' | 'out-of-shift' | 'business-closed' | 'unsupported-service';
    details?: { providerName: string; serviceName: string };
}
