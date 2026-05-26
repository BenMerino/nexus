// Spanish strings for the public tenant profile. Centralised so every
// surface (header, tabs, tables, panels, charts) speaks the same dialect.
// Default tenant audience is Chilean (UTalca), so this is es-CL where
// the vocabulary diverges from peninsular Spanish (e.g. computador).

import type { VelocityLabels } from './portfolio-velocity';
import type { CadenceLabels } from './portfolio-cadence';

export const ES = {
  /* Page chrome / tabs */
  research: 'Investigación',
  publicProfile: 'Perfil público de investigación',
  signIn: 'iniciar sesión',
  publicProfileBadge: 'Perfil público',
  nav: {
    overview: 'Resumen',
    charts: 'Gráficos',
    graph: 'Red de colaboración',
    orgTree: 'Esquema organizacional',
    authors: 'Directorio de autores',
  },

  /* Loading / error states */
  loading: 'Cargando…',
  loadingLabel: (what: string) => `Cargando ${what}…`,
  failedPrefix: 'Error',
  missingSlug: 'Falta el identificador del organismo.',
  tenantNotFound: 'Organismo no encontrado.',
  collaborationGraph: 'red de colaboración',
  orgSchemeLoading: 'esquema organizacional',

  /* Summary cards */
  summary: {
    publications: 'Publicaciones',
    citations: 'Citas',
    openAccess: 'Acceso abierto',
    authors: 'Autores',
  },
  subtitle: (pubs: string, authors: string) =>
    `Perfil público de investigación · ${pubs} publicaciones · ${authors} autores`,

  /* Authors directory */
  authorsTable: {
    searchPlaceholder: 'buscar por nombre',
    name: 'Nombre',
    papers: 'Artículos',
    hIndex: 'Índice h',
    citations: 'Citas',
    orcid: 'ORCID',
    none: 'sin ORCID',
    empty: 'Sin autores.',
    noMatches: 'Sin autores coincidentes.',
    rangeOf: (start: number, end: number, total: string) => `${start}–${end} de ${total}`,
  },

  /* Org tree */
  orgTree: {
    faculties: (n: number) => `${n} ${n === 1 ? 'facultad' : 'facultades'}`,
    institutes: (n: number) => `${n} ${n === 1 ? 'instituto' : 'institutos'}`,
    headcount: (n: number) => `${n} ${n === 1 ? 'académico' : 'académicos'}`,
    withOrcid: (n: number) => `${n} con ORCID`,
    papers: (n: number) => `${n} ${n === 1 ? 'artículo' : 'artículos'}`,
    academics: (n: number) => `${n === 1 ? 'académico' : 'académicos'}`,
    orcidRatio: 'ORCID',
    papersWord: (n: number) => `${n === 1 ? 'artículo' : 'artículos'}`,
    noRoster: 'Aún no hay personal académico cargado para este organismo.',
    kindLabel: { faculty: 'Facultad', institute: 'Instituto', other: 'Otras' } as const,
    paperOne: 'artículo',
    paperMany: 'artículos',
    academicOne: 'académico',
    academicMany: 'académicos',
    orcidNone: 'sin ORCID',
  },

  /* Charts panel section titles */
  charts: {
    citationVelocity: 'Velocidad de citación',
    publicationCadence: 'Cadencia de publicaciones',
    yearAxis: 'Año',
    articles: 'Artículos',
    pubsByYear: 'Publicaciones por año',
    pubsByType: 'Publicaciones por tipo',
    topJournals: 'Principales revistas',
    topInstitutions: 'Principales instituciones colaboradoras',
    pubsByCountry: 'Publicaciones por país',
    type: 'Tipo',
  },
};

export const VELOCITY_LABELS_ES: VelocityLabels = {
  score: 'puntaje',
  trend: { rising: 'ascendente', flat: 'estable', falling: 'descendente' },
  actual: 'Citas reales',
  forecast: 'Proyección',
};

export const CADENCE_LABELS_ES: CadenceLabels = {
  avgPerYear: 'artículos / año (promedio)',
};

// Publication type labels — Spanish where there's a clear translation.
const TYPE_LABELS_ES: Record<string, string> = {
  'journal-article': 'Artículo',
  'conference-paper': 'Congreso',
  'preprint': 'Preprint',
  'review': 'Revisión',
  'book-chapter': 'Capítulo de libro',
  'book': 'Libro',
  'dataset': 'Conjunto de datos',
  'editorial': 'Editorial',
  'letter': 'Carta',
  'erratum': 'Fe de erratas',
  'paratext': 'Paratexto',
  'unknown': 'Otro',
  'other': 'Otro',
};
export const typeLabelEs = (t: string): string => TYPE_LABELS_ES[t] || t;
