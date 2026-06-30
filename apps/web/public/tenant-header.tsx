import React, { useEffect, useRef } from 'react';
import { ES } from './tenant-i18n';
import { cycleSkyMode, getSkyMode, type SkyMode } from './public-theme-toggle';
import { BaseAction } from '../ui/primitives';

interface TenantLike { name: string; ror_id: string | null; logo_url: string | null; }
export interface PublicNavItem { id: string; label: string; }

const ROR_HOST = 'https://ror.org/';
function rorHref(raw: string): string { return raw.startsWith('http') ? raw : `${ROR_HOST}${raw}`; }
function rorId(raw: string): string { const m = raw.match(/([^/]+)$/); return m ? m[1] : raw; }
function initial(name: string): string { return (name.trim()[0] || '·').toUpperCase(); }

// Three-state theme cycle: live (real sun drives it) → day (forced) → night
// (forced) → live. One icon per mode; clicking advances the cycle and the sky
// pipeline repaints instantly via the nexus:sky-mode event.
const MODE_LABEL: Partial<Record<SkyMode, string>> = {
  live: 'Live · follows the sun', day: 'Day', night: 'Night',
};

function ModeIcon({ mode }: { mode: SkyMode }) {
  const c = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 } as const;
  if (mode === 'day') return (
    <svg {...c}><circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.6M12 18.9v2.6M21.5 12h-2.6M5.1 12H2.5M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6" strokeLinecap="round" /></svg>
  );
  if (mode === 'night') return (
    <svg {...c}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z" strokeLinejoin="round" /></svg>
  );
  // live: a sun half-eclipsed by a moon arc — "auto / follows the sky".
  return (
    <svg {...c}><circle cx="12" cy="12" r="4.2" />
      <path d="M12 3v2M12 19v2M21 12h-2M5 12H3M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4M17.7 17.7l-1.4-1.4M7.7 7.7 6.3 6.3" strokeLinecap="round" opacity="0.55" />
      <path d="M14.5 9.2A4.2 4.2 0 0 0 12 16.2a4.2 4.2 0 0 0 2.5-7z" fill="currentColor" stroke="none" opacity="0.9" /></svg>
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
  tenant, items, currentId, onNavigate, yearRange, lastUpdated, search,
}: {
  tenant: TenantLike;
  items: PublicNavItem[];
  currentId: string;
  onNavigate: (id: string) => void;
  yearRange?: { minYear: string | null; maxYear: string | null };
  lastUpdated?: string | null;
  search?: React.ReactNode;
}) {
  // Prefer the real corpus-change date (last DOI submission) over the max
  // publication year; yearRange may be absent if the analytics payload wins
  // the load race — guard so the header never throws on .maxYear.
  const updatedDate = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : yearRange?.maxYear;
  const updated = updatedDate ? `${ES.updatedPrefix} ${updatedDate}` : ES.publicProfileBadge;

  // The header is fixed chrome; content is inset BELOW its real height. Publish
  // the actual rendered height to --chrome-bar-h-actual so .public-main's top
  // offset tracks it (brand + search make the bar taller than the 60px token,
  // and it can wrap responsively) — content stays inset, never tucked under.
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
    <>
    <header className="public-header" ref={ref}>
      <div className="public-header-inner">
        <div className="public-brand">
          {tenant.logo_url
            ? <img className="public-logo" src={tenant.logo_url} alt="" />
            : <span className="public-logo-fallback" data-initial={initial(tenant.name)} />}
          <div>
            <div className="public-tenant-name">{tenant.name}</div>
            <div className="public-tenant-sub">
              <span>{ES.researchIntelligence}</span>
              {tenant.ror_id ? <> · <a href={rorHref(tenant.ror_id)} target="_blank" rel="noopener noreferrer">ROR {rorId(tenant.ror_id)}</a></> : null}
            </div>
          </div>
        </div>
        <div className="public-header-aux">
          <span className="public-updated"><span className="sync-pulse" /> <span>{updated}</span></span>
          <a href="/login.html" className="public-signin">{ES.signIn}</a>
          <ThemeButton />
        </div>
      </div>
    </header>
    {/* Search is its OWN detached floating glass bar, centred in the header zone,
        separate from the main bar above. */}
    {search ? <div className="public-search-bar">{search}</div> : null}
    </>
  );
}
