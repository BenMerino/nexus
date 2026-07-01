import React, { useEffect, useRef } from 'react';
import { ES } from './tenant-i18n';
import { cycleSkyMode, getSkyMode, type SkyMode } from './public-theme-toggle';
import { BaseAction } from '../ui/primitives';

interface TenantLike { name: string; ror_id: string | null; logo_url: string | null; }
export interface PublicNavItem { id: string; label: string; }

const ROR_HOST = 'https://ror.org/';
function rorHref(raw: string): string { return raw.startsWith('http') ? raw : `${ROR_HOST}${raw}`; }
function rorId(raw: string): string { const m = raw.match(/([^/]+)$/); return m ? m[1] : raw; }

// Two-state theme toggle: day (forced) ↔ night (forced). One icon per mode;
// clicking flips it and the sky pipeline repaints instantly via nexus:sky-mode.
const MODE_LABEL: Record<SkyMode, string> = { day: 'Day', night: 'Night' };

function ModeIcon({ mode }: { mode: SkyMode }) {
  const c = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 } as const;
  if (mode === 'day') return (
    <svg {...c}><circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.6M12 18.9v2.6M21.5 12h-2.6M5.1 12H2.5M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6" strokeLinecap="round" /></svg>
  );
  return (
    <svg {...c}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z" strokeLinejoin="round" /></svg>
  );
}

function ThemeButton() {
  const [mode, setLocalMode] = React.useState<SkyMode>(() => getSkyMode());
  const label = `Theme: ${MODE_LABEL[mode]}`;
  return (
    <BaseAction variant="ghost" iconOnly className="theme-btn"
                aria-label={label} title={label}
                onClick={() => setLocalMode(cycleSkyMode())}>
      <ModeIcon mode={mode} />
    </BaseAction>
  );
}

export function TenantPublicHeader({
  tenant, items, currentId, onNavigate, yearRange, lastUpdated, signedIn,
}: {
  tenant: TenantLike;
  items: PublicNavItem[];
  currentId: string;
  onNavigate: (id: string) => void;
  yearRange?: { minYear: string | null; maxYear: string | null };
  lastUpdated?: string | null;
  /** True on the authed app shell (AuthLayout) — hides "sign in", the user is
   *  already in. Defaults to false (public pages always show it). */
  signedIn?: boolean;
}) {

  // The header is fixed chrome; content is inset BELOW its real height. Publish
  // the actual rendered height to --chrome-bar-h-actual so .public-main's top
  // offset tracks it (it can still wrap responsively at narrow widths) —
  // content stays inset, never tucked under.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publish = () =>
      document.documentElement.style.setProperty('--chrome-bar-h-actual', `${el.offsetHeight}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    /* ONE unified floating glass bar. .public-header carries the glass; the two
       .public-header-seg groups (breadcrumb · aux) just lay out inside it. */
    <header className="public-header" ref={ref}>
      {/* The header is now a breadcrumb, not the brand — product identity
          (mark + "Research Intelligence") lives in the sidebar's tenant-chip.
          Starts from the tenant itself; ROR trails as plain metadata. */}
      <div className="public-header-seg public-header-left">
        <div className="public-breadcrumb">
          <span className="public-tenant-name">{tenant.name}</span>
          {tenant.ror_id ? (
            <span className="public-tenant-sub">
              ROR <a href={rorHref(tenant.ror_id)} target="_blank" rel="noopener noreferrer">{rorId(tenant.ror_id)}</a>
            </span>
          ) : null}
        </div>
      </div>
      <div className="public-header-seg public-header-right">
        {!signedIn && <a href="/login.html" className="public-signin">{ES.signIn}</a>}
        <ThemeButton />
      </div>
    </header>
  );
}
