// English UI strings for the public tenant profile. Centralised so every
// surface (header, tabs, tables, panels, charts) speaks the same dialect.
// The exported identifiers keep their historical *_ES / Es names to avoid
// churning every importer; the values are English.

import type { VelocityLabels } from './portfolio-velocity';
import type { CadenceLabels } from './portfolio-cadence';

export const ES = {
  /* Page chrome / tabs */
  research: 'Research',
  publicProfile: 'Public research profile',
  researchIntelligence: 'Research Intelligence · Public',
  signIn: 'sign in',
  publicProfileBadge: 'Public profile',
  updatedPrefix: 'Updated',
  themeToggle: 'Toggle light / dark',

  /* Page head — the viewing-scope flag (headline + lede removed) */
  pageHead: {
    scopeLabel: 'Viewing scope',
    allUnits: 'All units',
    allUnitsNote: 'complete institutional corpus',
  },

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

  /* Org tree (now the contributors ranking + the scope picker) */
  orgTree: {
    allOrganization: 'Entire organization',
    noRoster: 'No academic staff loaded for this organization yet.',
    kindLabel: { faculty: 'Faculty', institute: 'Institute', other: 'Other' } as const,
    paperOne: 'paper',
    paperMany: 'papers',
    orcidNone: 'no ORCID',
  },

  /* Charts panel section titles */
  charts: {
    citationVelocity: 'Citation velocity',
    citationsPerYear: 'Citations received per year',
    publicationCadence: 'Publication cadence',
    byDocType: 'Output by document type',
    byIndexSource: 'Segmented by indexing source',
    yearAxis: 'Year',
    articles: 'Papers',
    pubsByYear: 'Publications per year',
    pubsByType: 'Publications by type',
    topJournals: 'Top journals',
    topInstitutions: 'Top collaborating institutions',
    topCountries: 'Top collaborating countries',
    type: 'Type',
  },
};

export const VELOCITY_LABELS_ES: VelocityLabels = {
  score: 'score',
  trend: { rising: 'rising', flat: 'flat', falling: 'falling' },
  actual: 'Actual citations',
  forecast: 'Forecast',
};

export const CADENCE_LABELS_ES: CadenceLabels = {
  avgPerYear: 'papers / year (average)',
};

// Publication type labels.
const TYPE_LABELS_ES: Record<string, string> = {
  'journal-article': 'Article',
  'conference-paper': 'Conference',
  'preprint': 'Preprint',
  'review': 'Review',
  'book-chapter': 'Book chapter',
  'book': 'Book',
  'dataset': 'Dataset',
  'editorial': 'Editorial',
  'letter': 'Letter',
  'erratum': 'Erratum',
  'paratext': 'Paratext',
  'unknown': 'Other',
  'other': 'Other',
};
export const typeLabelEs = (t: string): string => TYPE_LABELS_ES[t] || t;
