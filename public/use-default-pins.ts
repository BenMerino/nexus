import { useState, useEffect } from 'react';
import type { RawNode } from './relationship-types';

interface MeData {
  profile: { name: string; affiliation: string; orcid: string | null; ror: string | null };
}

/**
 * Fetches user profile and returns default pinned tags (author + institution).
 * Uses ORCID/ROR ext_ids for reliable matching instead of fuzzy name matching.
 */
export function useDefaultPins(rawNodes: RawNode[]): {
  defaultPins: string[];
  defaultSelected: string | null;
  ready: boolean;
} {
  const [me, setMe] = useState<MeData | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch('/api/auth?action=me')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.profile) setMe(d); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  if (!ready || !me || !rawNodes.length) {
    return { defaultPins: [], defaultSelected: null, ready };
  }

  const pins: string[] = [];
  let selected: string | null = null;
  const p = me.profile;

  if (p.orcid) {
    const id = `author:${p.orcid}`;
    if (rawNodes.some(n => n.id === id)) { pins.push(id); selected = id; }
  }
  if (p.ror) {
    const id = `institution:${p.ror}`;
    if (rawNodes.some(n => n.id === id)) pins.push(id);
  }

  return { defaultPins: pins, defaultSelected: selected, ready };
}
