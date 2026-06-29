// The public profile's section navigation, as data. The sidebar
// (tenant-sidebar.tsx) renders this; the section router (tenant.tsx) keys its
// right-pane content off `id`. Single source for what exists vs. what's a
// roadmap placeholder, so the nav and the views never drift.
//
// `status` per leaf:
//   'live'    — backed by a real catalog kind / KPI; clickable, renders content.
//   'soon'    — declared in the IA but unbuilt; shown disabled with a tag.
// A section is reachable iff it has ≥1 live leaf. All-`soon` sections still
// appear (the roadmap is visible) but their nav entry is disabled.

export type LeafStatus = 'live' | 'soon';

export interface SectionLeaf {
  id: string;
  label: string;
  status: LeafStatus;
}

export interface NavSection {
  id: string;
  label: string;
  leaves: SectionLeaf[];
}

// Status reflects the 2026-06-29 catalog audit (apps/api .../AnalyticsCatalog.ts):
// 9 server-composed kinds + KPI scalars are live; FWCI / quartiles / funding /
// emerging-talent / industry / i10 have no backing data yet.
export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'overview',
    label: 'Institutional Overview',
    leaves: [
      { id: 'global-metrics', label: 'Global Metrics', status: 'live' },
      { id: 'temporal-trends', label: 'Temporal Trends', status: 'live' },
    ],
  },
  {
    id: 'faculties',
    label: 'Faculties & Departments',
    leaves: [
      { id: 'comparative-matrix', label: 'Comparative Matrix', status: 'live' },
      { id: 'subject-categories', label: 'Subject Categories', status: 'live' },
    ],
  },
  {
    id: 'researchers',
    label: 'Researcher Profiles',
    leaves: [
      { id: 'high-impact', label: 'High-Impact Authors', status: 'live' },
      { id: 'emerging-talent', label: 'Emerging Talent', status: 'soon' },
    ],
  },
  {
    id: 'venues',
    label: 'Journal & Venue Analysis',
    leaves: [
      { id: 'open-access', label: 'Open Access Tracker', status: 'live' },
      { id: 'quartiles', label: 'Quartile Distribution', status: 'soon' },
    ],
  },
  {
    id: 'collaboration',
    label: 'Collaboration & Networks',
    leaves: [
      { id: 'international', label: 'International Co-authorship', status: 'live' },
      { id: 'industry', label: 'Industry Synergies', status: 'soon' },
    ],
  },
  {
    id: 'funding',
    label: 'Funding & Grants Performance',
    leaves: [
      { id: 'roi-mapping', label: 'ROI Mapping', status: 'soon' },
    ],
  },
];

// A section is navigable when at least one of its leaves is live.
export const sectionIsLive = (s: NavSection): boolean =>
  s.leaves.some(l => l.status === 'live');

// First live section — the default landing view.
export const firstLiveSectionId = (): string =>
  (NAV_SECTIONS.find(sectionIsLive) ?? NAV_SECTIONS[0]).id;
