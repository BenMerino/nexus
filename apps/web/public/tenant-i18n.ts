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
  signIn: 'sign in',
  publicProfileBadge: 'Public profile',
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

  /* Unit scope picker (Overview) */
  unitPicker: {
    allTenant: 'All of the university',
    search: 'Search faculty or department…',
    noMatch: 'No matching unit',
    scopedNote: (name: string) => `Showing ${name}. Time-series charts (cadence, indexation) remain university-wide.`,
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

  /* Org tree */
  orgTree: {
    faculties: (n: number) => `${n} ${n === 1 ? 'faculty' : 'faculties'}`,
    institutes: (n: number) => `${n} ${n === 1 ? 'institute' : 'institutes'}`,
    headcount: (n: number) => `${n} ${n === 1 ? 'academic' : 'academics'}`,
    withOrcid: (n: number) => `${n} with ORCID`,
    papers: (n: number) => `${n} ${n === 1 ? 'paper' : 'papers'}`,
    academics: (n: number) => `${n === 1 ? 'academic' : 'academics'}`,
    orcidRatio: 'ORCID',
    papersWord: (n: number) => `${n === 1 ? 'paper' : 'papers'}`,
    noRoster: 'No academic staff loaded for this organization yet.',
    kindLabel: { faculty: 'Faculty', institute: 'Institute', other: 'Other' } as const,
    paperOne: 'paper',
    paperMany: 'papers',
    academicOne: 'academic',
    academicMany: 'academics',
    orcidNone: 'no ORCID',
  },

  /* Charts panel section titles */
  charts: {
    citationVelocity: 'Citation velocity',
    publicationCadence: 'Publication cadence',
    yearAxis: 'Year',
    articles: 'Papers',
    pubsByYear: 'Publications per year',
    pubsByType: 'Publications by type',
    topJournals: 'Top journals',
    topInstitutions: 'Top collaborating institutions',
    pubsByCountry: 'Publications by country',
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
