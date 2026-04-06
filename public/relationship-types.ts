export interface RawNode {
  id: string;
  label: string;
  group: string;
}

export interface RawEdge {
  source: string;
  target: string;
}

export interface TagNode {
  id: string;
  label: string;
  group: string;
  doiCount: number;
  degree: number;
  weight: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface ProjectedEdge {
  source: string;
  target: string;
  weight: number;
  sharedDois: string[];
}

export interface SimNode extends TagNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
}

export interface DoiRecord {
  doi: string;
  title: string;
  authors: string[];
  journal: string;
  citation_count: number;
  type: string;
  published: string;
}

export const TAG_CATEGORIES = ['author', 'journal', 'publisher', 'type', 'institution', 'venue', 'year'] as const;
export type Category = (typeof TAG_CATEGORIES)[number];

export const COLORS: Record<string, string> = {
  author: '#c62828',
  journal: '#2e7d32',
  publisher: '#1565c0',
  type: '#7b1fa2',
  institution: '#f57f17',
  venue: '#e65100',
  year: '#00695c',
};

export const BG_COLORS: Record<string, string> = {
  author: '#fce4ec',
  journal: '#e8f5e9',
  publisher: '#e3f2fd',
  type: '#f3e5f5',
  institution: '#fff8e1',
  venue: '#fff3e0',
  year: '#e0f2f1',
};

/** 12 visually distinct community colors (stroke / fill) */
export const COMMUNITY_COLORS = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4',
  '#42d4f4', '#f032e6', '#bfef45', '#fabebe', '#469990',
  '#dcbeff', '#9A6324',
];
export const COMMUNITY_BG = [
  '#fde0e6', '#e4f5e4', '#dfe6f8', '#fde9d4', '#ecdaf5',
  '#d8f4fb', '#f8d6f6', '#f2fad6', '#fde8e8', '#d6edea',
  '#f0e6ff', '#f0e4d0',
];
export function communityColor(id: number): string { return COMMUNITY_COLORS[id % COMMUNITY_COLORS.length]; }
export function communityBg(id: number): string { return COMMUNITY_BG[id % COMMUNITY_BG.length]; }

export type NodeRole = 'hub' | 'bridge' | 'leaf' | 'default';

export interface CategoryProfileEntry {
  category: string;
  weight: number;
}

export interface EnrichedTagNode extends TagNode {
  role: NodeRole;
  community: number;
  categoryProfile: CategoryProfileEntry[];
  haloIntensity?: number;
  openAccess?: boolean;
  topKeywords?: string[];
}

export interface EnrichedSimNode extends EnrichedTagNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
}

export function nodeRadius(weight: number, role?: NodeRole): number {
  const base = Math.max(4, Math.min(18, 4 + Math.sqrt(weight) * 2));
  if (role === 'hub') return Math.min(22, base * 1.3);
  if (role === 'leaf') return Math.max(4, base * 0.8);
  return base;
}
