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
