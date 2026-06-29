// English UI strings for the public tenant profile. Centralised so every
// surface (header, tabs, tables, panels, charts) speaks the same dialect.
// The exported identifiers keep their historical *_ES / Es names to avoid
// churning every importer; the values are English.

// Chart-label dialects + type labels live in tenant-i18n-labels.ts (N5 split);
// re-exported here so importers keep one entry point.
export { VELOCITY_LABELS_ES, CADENCE_LABELS_ES, typeLabelEs } from './tenant-i18n-labels';
import { CHART_STRINGS } from './tenant-i18n-labels';

export const ES = {
  /* Page chrome / tabs */
  research: 'Research',
  publicProfile: 'Public research profile',
  researchIntelligence: 'Research Intelligence · Public',
  signIn: 'sign in',
  publicProfileBadge: 'Public profile',
  updatedPrefix: 'Updated',
  themeToggle: 'Toggle light / dark',

  /* Scope rail head + the "all units" row label */
  scopeRail: {
    title: 'Scope · Faculties & Institutes',
    note: 'Select a unit to focus every chart on its output.',
    allUnitsKind: 'Institution-wide',
  },
  nav: {
    overview: 'Overview',
    charts: 'Charts',
    graph: 'Collaboration network',
    orgTree: 'Organizational scheme',
    authors: 'Author directory',
  },

  /* Loading / error states */
  loading: 'Loading…',
  loadingLabel: (what: string) => `Loading ${what}…`,
  failedPrefix: 'Error',
  missingSlug: 'Missing organization identifier.',
  tenantNotFound: 'Organization not found.',
  collaborationGraph: 'collaboration network',
  orgSchemeLoading: 'organizational scheme',

  /* Summary cards */
  summary: {
    publications: 'Publications',
    citations: 'Citations',
    openAccess: 'Open access',
    authors: 'Authors',
  },

  /* Biggest-contributors ranking (Overview, university scope) */
  contributors: {
    title: 'Biggest contributors',
    titleIn: (name: string) => `Contributors — ${name}`,
    volume: 'Publications',
    perCapita: 'Per academic',
    citations: 'Citations',
    backToFaculties: '← All faculties',
    drillHint: 'Click to see this unit’s departments',
    noData: 'No data for this metric',
    footnote: 'A paper co-authored across units counts for each, so unit totals can sum above the university total.',
  },
  subtitle: (pubs: string, authors: string) =>
    `Public research profile · ${pubs} publications · ${authors} authors`,

  /* Authors directory */
  authorsTable: {
    searchPlaceholder: 'search by name',
    name: 'Name',
    papers: 'Papers',
    hIndex: 'h-index',
    citations: 'Citations',
    orcid: 'ORCID',
    none: 'no ORCID',
    empty: 'No authors.',
    noMatches: 'No matching authors.',
    rangeOf: (start: number, end: number, total: string) => `${start}–${end} of ${total}`,
  },

  /* Individual academic profile page (/t/:slug/a/:orcid) */
  profile: {
    eyebrow: 'Academic profile',
    back: '← Back',
    backTo: (tenant: string) => `← ${tenant}`,
    viewProfile: 'Profile',
    viewProfileTitle: 'View public profile',
    papers: 'Papers',
    citations: 'Citations',
    hIndex: 'h-index',
    activeYears: 'Active years',
    outputPerYear: 'Publications per year',
    publications: 'Publications',
    onOrcid: 'ORCID record ↗',
    notFound: 'Author not found.',
    unfiled: 'No unit on record',
    topics: 'Research topics',
    mostCited: 'Most cited',
    andMore: (n: number) => `+${n} more`,
  },

  /* Org tree (now the contributors ranking + the scope picker) */
  orgTree: {
    allOrganization: 'Entire organization',
    noRoster: 'No academic staff loaded for this organization yet.',
    kindLabel: { faculty: 'Faculty', institute: 'Institute', other: 'Other' } as const,
    paperOne: 'paper',
    paperMany: 'papers',
    orcidNone: 'no ORCID',
  },

  /* Chart panel section titles (tenant-i18n-labels.ts, N5 split) */
  charts: CHART_STRINGS,

  /* Publication lists (most cited / recent) */
  works: {
    mostCited: 'Most cited',
    mostCitedSub: 'All-time citation leaders',
    recent: 'Recent publications',
    recentSub: 'Latest indexed output',
    empty: 'No publications.',
  },

  /* Omnibox search */
  searchBox: {
    placeholder: 'Search researchers, publications, units…',
    researchers: 'Researchers',
    publications: 'Publications',
    units: 'Units',
    noResults: 'No matches.',
    papersSuffix: 'papers',
  },

  /* Provenance footer */
  footer: {
    sources: 'Source data: CrossRef · OpenAlex · Semantic Scholar · DataCite',
    coverage: (min: string, max: string) => `Coverage ${min}–${max}`,
    countNote: 'Citation counts are cumulative across sources; a cross-unit paper counts once per unit.',
  },
};
