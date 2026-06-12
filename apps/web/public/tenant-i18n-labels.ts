// Chart-label dialects + publication-type labels, split from tenant-i18n.ts
// (N5). Re-exported there so importers keep one entry point.

import type { VelocityLabels } from './portfolio-velocity';
import type { CadenceLabels } from './portfolio-cadence';

export const VELOCITY_LABELS_ES: VelocityLabels = {
  score: 'score',
  trend: { rising: 'rising', flat: 'flat', falling: 'falling' },
  actual: 'Actual citations',
  forecast: 'Forecast',
};

export const CADENCE_LABELS_ES: CadenceLabels = {
  avgPerYear: 'papers / year (average)',
};

// Chart panel section titles (moved from tenant-i18n.ts for N5 headroom;
// reaches importers as ES.charts).
export const CHART_STRINGS = {
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
  researchAreas: 'Research areas',
  researchAreasSub: 'OpenAlex concepts on the corpus',
  segByType: 'By type',
  segByIndex: 'By index',
  segTotal: 'Total',
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
