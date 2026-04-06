import { useState, useEffect } from 'react';
import type { RawNode } from './relationship-types';

interface UserProfile {
  name: string;
  affiliation: string;
}

/** Normalize for fuzzy matching: lowercase, collapse hyphens/spaces */
function norm(s: string): string {
  return s.toLowerCase().replace(/[-]/g, ' ').trim();
}

/** Find author node matching user's name (exact or surname+firstname) */
function findAuthorNode(name: string, nodes: RawNode[]): RawNode | undefined {
  const normalized = norm(name);
  const surname = normalized.split(' ').pop() || '';
  const firstName = name.split(' ')[0].toLowerCase();
  return nodes.find(n => {
    if (n.group !== 'author') return false;
    const an = norm(n.label);
    return an === normalized || (an.includes(surname) && an.includes(firstName));
  });
}

/** Find institution node matching user's affiliation */
function findInstitutionNode(affiliation: string, nodes: RawNode[]): RawNode | undefined {
  const normalized = norm(affiliation);
  return nodes.find(n => n.group === 'institution' && norm(n.label) === normalized);
}

/**
 * Fetches user profile and returns default pinned tags (author + institution).
 * Only sets pins once when graph data first loads. Returns empty array if not logged in.
 */
export function useDefaultPins(rawNodes: RawNode[]): {
  defaultPins: string[];
  defaultSelected: string | null;
  ready: boolean;
} {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch('/api/auth?action=me')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.profile) setProfile(d.profile); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  if (!ready || !profile || !rawNodes.length) {
    return { defaultPins: [], defaultSelected: null, ready };
  }

  const pins: string[] = [];
  let selected: string | null = null;

  const authorNode = findAuthorNode(profile.name, rawNodes);
  if (authorNode) {
    pins.push(authorNode.id);
    selected = authorNode.id;
  }

  const instNode = findInstitutionNode(profile.affiliation, rawNodes);
  if (instNode) pins.push(instNode.id);

  return { defaultPins: pins, defaultSelected: selected, ready };
}
