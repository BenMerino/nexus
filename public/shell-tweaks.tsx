import React, { useState } from 'react';
import { Ico } from './shell-icons';
import type { CurrentUser } from './shell-helpers';
import { useViewAs, effectiveRole } from './shell-helpers';

const VIEW_AS_ROLES = [
  { id: null, label: 'Self (superadmin)' },
  { id: 'director',   label: 'Director' },
  { id: 'secretary',  label: 'Secretary' },
  { id: 'academic',   label: 'Academic' },
  { id: 'researcher', label: 'Researcher' },
] as const;

export function RoleSwitcher({ me }: { me: CurrentUser | null }) {
  const [viewAs, setViewAs] = useViewAs();
  if (!me || me.role !== 'superadmin') return null;
  const active = effectiveRole(me, viewAs);
  return (
    <div className="role-switcher">
      <div className="role-label">View as</div>
      <div className="role-list">
        {VIEW_AS_ROLES.map(r => {
          const isActive = (r.id || 'superadmin') === active;
          return (
            <button
              key={r.id ?? 'self'}
              className={`role-btn ${isActive ? 'active' : ''}`}
              onClick={() => setViewAs(r.id)}
            >
              <span className="role-btn-label">
                <span className="role-btn-title">{r.label}</span>
                <span className="role-btn-who">{r.id ? 'view-as' : me.user}</span>
              </span>
              {isActive && <span style={{ color: 'var(--accent)', fontSize: 16, lineHeight: 1 }}>●</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface TweaksState { density: 'compact' | 'comfortable'; showGrid: boolean; }
const TWEAKS_KEY = 'nexus.tweaks';
const DEFAULT_TWEAKS: TweaksState = { density: 'comfortable', showGrid: true };

function loadTweaks(): TweaksState {
  try { return { ...DEFAULT_TWEAKS, ...JSON.parse(localStorage.getItem(TWEAKS_KEY) || '{}') }; }
  catch { return DEFAULT_TWEAKS; }
}

export function useTweaks() {
  const [tweaks, setTweaksState] = useState<TweaksState>(loadTweaks);
  const setTweak = <K extends keyof TweaksState>(key: K, value: TweaksState[K]) => {
    const next = { ...tweaks, [key]: value };
    setTweaksState(next);
    try { localStorage.setItem(TWEAKS_KEY, JSON.stringify(next)); } catch {}
  };
  return { tweaks, setTweak };
}

export function TweaksPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tweaks, setTweak } = useTweaks();
  if (!open) return null;
  return (
    <div className="tweaks-panel">
      <div className="tweaks-header">
        <span className="tweaks-title">Tweaks</span>
        <button className="close" onClick={onClose} aria-label="Close">{Ico.close}</button>
      </div>
      <div className="tweak">
        <div className="tweak-label">Density <span>{tweaks.density}</span></div>
        <div className="tweak-opts">
          {(['compact', 'comfortable'] as const).map(d => (
            <button
              key={d}
              className={`tweak-opt ${tweaks.density === d ? 'on' : ''}`}
              onClick={() => setTweak('density', d)}
            >{d}</button>
          ))}
        </div>
      </div>
      <div className="tweak">
        <div className="tweak-label">Graph grid</div>
        <div className="tweak-opts">
          {[true, false].map(v => (
            <button
              key={String(v)}
              className={`tweak-opt ${tweaks.showGrid === v ? 'on' : ''}`}
              onClick={() => setTweak('showGrid', v)}
            >{v ? 'on' : 'off'}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
