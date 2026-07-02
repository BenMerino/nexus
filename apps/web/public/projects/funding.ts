// Funding-source catalog + faculty list + CLP formatter for the Projects page.
// Ported verbatim from the legacy claustro-funding.js (values unchanged) into a
// plain data module the React page imports — no window.* globals.

export interface FundingSource {
  id: string;
  name: string;
  external: boolean;
  concursable: boolean;
  agency: string;
}

export const FUNDING_SOURCES: FundingSource[] = [
  { id: 'fondecyt-regular', name: 'Fondecyt Regular', external: true, concursable: true, agency: 'ANID' },
  { id: 'fondecyt-iniciacion', name: 'Fondecyt Iniciación', external: true, concursable: true, agency: 'ANID' },
  { id: 'fondecyt-postdoc', name: 'Fondecyt Postdoctorado', external: true, concursable: true, agency: 'ANID' },
  { id: 'fondef', name: 'FONDEF IDeA', external: true, concursable: true, agency: 'ANID' },
  { id: 'fondap', name: 'FONDAP', external: true, concursable: true, agency: 'ANID' },
  { id: 'milenio', name: 'Iniciativa Milenio', external: true, concursable: true, agency: 'ANID' },
  { id: 'anillos', name: 'Anillos ANID', external: true, concursable: true, agency: 'ANID' },
  { id: 'corfo', name: 'CORFO', external: true, concursable: true, agency: 'CORFO' },
  { id: 'fia', name: 'FIA', external: true, concursable: true, agency: 'FIA' },
  { id: 'vrid', name: 'Internal VRID (UTalca)', external: false, concursable: true, agency: 'UTalca' },
  { id: 'extension', name: 'Outreach / Engagement', external: false, concursable: false, agency: 'UTalca' },
  { id: 'contrato-empresa', name: 'Company contract', external: true, concursable: false, agency: 'Private' },
  { id: 'consultoria', name: 'Consulting', external: true, concursable: false, agency: 'Private' },
  { id: 'otro', name: 'Other', external: false, concursable: false, agency: '—' },
];

// Faculty list — ported from claustro-form.js FACULTADES (English labels, N7).
export const FACULTIES: string[] = [
  'Faculty of Agricultural Sciences',
  'Faculty of Architecture, Music and Design',
  'Faculty of Economics and Business',
  'Faculty of Education Sciences',
  'Faculty of Engineering',
  'Faculty of Legal and Social Sciences',
  'Faculty of Medicine',
  'Faculty of Dentistry',
  'Faculty of Psychology',
  'Faculty of Health Sciences',
  'Faculty of Industrial Technologies',
  'Institute of Mathematics',
  'Institute of Natural Resource Chemistry',
  'Institute of Biological Sciences',
  'Juan Ignacio Molina Institute of Humanistic Studies',
];

export function fundingById(id: string): FundingSource | null {
  return FUNDING_SOURCES.find((f) => f.id === id) ?? null;
}

export function fundingByName(name: string): FundingSource | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  return FUNDING_SOURCES.find((f) => f.name.toLowerCase() === lower) ?? null;
}

export function fmtCLP(n: number | null | undefined): string {
  const num = Number(n);
  if (!n || !Number.isFinite(num)) return '$0';
  return '$' + num.toLocaleString('es-CL');
}
