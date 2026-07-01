import React, { useEffect, useRef } from 'react';
import { ES } from './tenant-i18n';
import { cycleSkyMode, getSkyMode, type SkyMode } from './public-theme-toggle';
import { BaseAction } from '../ui/primitives';

interface TenantLike { name: string; ror_id: string | null; logo_url: string | null; }
export interface PublicNavItem { id: string; label: string; }

const ROR_HOST = 'https://ror.org/';
function rorHref(raw: string): string { return raw.startsWith('http') ? raw : `${ROR_HOST}${raw}`; }
function rorId(raw: string): string { const m = raw.match(/([^/]+)$/); return m ? m[1] : raw; }
// Talca sits at the foot of Volcán Descabezado Grande — the brand mark is a
// glass volcano tile (no per-tenant logo upload wired up yet), same footprint
// as the old initial-letter crest. 8 vertical bars, one per column, heights
// forming a mountain profile (short at the edges, tall at center); the two
// peak bars stop one cell short of the top — the crater notch.
const BAR_HEIGHTS = [2, 4, 6, 7, 7, 6, 4, 2] as const;
const GRID_ROWS = 8;

function VolcanoMark() {
  return (
    <div className="public-logo-mark" aria-hidden="true">
      <div className="volcano-grid">
        {BAR_HEIGHTS.map((h, x) => (
          <div className="volcano-bar" key={x}>
            {Array.from({ length: GRID_ROWS }, (_, i) => GRID_ROWS - 1 - i).map(rowFromBottom => {
              const filled = rowFromBottom < h;
              const opacity = 0.35 + (0.65 * (GRID_ROWS - rowFromBottom)) / GRID_ROWS;
              return (
                <span key={rowFromBottom}
                  style={filled ? { opacity, background: 'var(--fg)' } : undefined} />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

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
    /* ONE unified floating glass bar. .public-header carries the glass; the three
       .public-header-seg groups (brand · search · aux) just lay out inside it. */
    <header className="public-header" ref={ref}>
      <div className="public-header-seg public-header-left">
        <div className="public-brand">
          <VolcanoMark />
          <div>
            <div className="public-tenant-name">{tenant.name}</div>
            <div className="public-tenant-sub">
              <span>{ES.researchIntelligence}</span>
              {tenant.ror_id ? <> · <a href={rorHref(tenant.ror_id)} target="_blank" rel="noopener noreferrer">ROR {rorId(tenant.ror_id)}</a></> : null}
            </div>
          </div>
        </div>
      </div>
      {search ? <div className="public-header-seg public-header-center">{search}</div> : null}
      <div className="public-header-seg public-header-right">
        <a href="/login.html" className="public-signin">{ES.signIn}</a>
        <ThemeButton />
      </div>
    </header>
  );
}
