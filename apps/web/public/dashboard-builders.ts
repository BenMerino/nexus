import type { GraphDirective } from '../architect/graph-composer.types';
import type { Velocity } from './portfolio-velocity';
import type { Cadence } from './portfolio-cadence';
import type { TopCitedItem } from './portfolio-topcited';
import type { Concept } from './portfolio-concepts';
import type { Suggested } from './portfolio-collaborators';

interface YearSource { year: string; source: string; count: string; }
interface Collab { value: string; count: string; }
interface Country { country: string; count: string; }

export interface TopJournal { value: string; key: string; count: string }
export interface RecentPaper { doi: string; title: string | null; published: string | null; citation_count: number | null; journal: string | null; type: string | null }

export interface CoauthorNode { id: string; label: string; group: string; weight: number; isMe?: boolean; affiliation?: { ror: string; name: string } | null }
export interface CoauthorEdge { source: string; target: string; weight: number }
export interface CoauthorGraph { nodes: CoauthorNode[]; edges: CoauthorEdge[] }

export interface Portfolio {
  works: { doi: string; title: string | null; year: string | null; citation_count: number | null }[];
  velocity: Velocity;
  collaborators: { existing: string[]; suggested: Suggested[] };
  concepts?: Concept[];
  cadence?: Cadence;
  topCited?: TopCitedItem[];
  coauthorGraph?: CoauthorGraph;
}

export interface ViewedUser {
  user: string;
  profile: {
    name?: string;
    researcherName?: string;
    orcid?: string;
    position?: string;
    faculty?: string;
    titles?: string[];
  };
  hIndex: number | null;
  hIndexByType: Record<string, number> | null;
}

interface DashboardData {
  totalPubs: number;
  totalCitations: number;
  oaCount: number;
  authorCount: number;
  yearSource: YearSource[];
  collabs: Collab[];
  countries: Country[];
  topJournals?: TopJournal[];
  recentPapers?: RecentPaper[];
  portfolio?: Portfolio;
  viewedUser?: ViewedUser | null;
}

function buildYearSourceChart(data: DashboardData): GraphDirective | null {
  const byYear = new Map<string, Map<string, number>>();
  for (const row of data.yearSource) {
    if (!byYear.has(row.year)) byYear.set(row.year, new Map());
    byYear.get(row.year)!.set(row.source, parseInt(row.count));
  }
  const years = [...byYear.keys()].sort();
  if (years.length <= 1) return null;

  return {
    type: 'bar',
    title: 'Publications by Year',
    yLabel: 'Articles',
    data: years.map(year => {
      const sources = byYear.get(year)!;
      let total = 0;
      for (const c of sources.values()) total += c;
      return { label: year, value: total };
    }),
  };
}

function buildCollabChart(data: DashboardData): GraphDirective | null {
  const top = data.collabs.slice(0, 15);
  if (!top.length) return null;
  return {
    type: 'bar',
    title: 'Top Collaborating Institutions',
    yLabel: 'Co-authored Papers',
    data: top.map(c => ({ label: c.value.substring(0, 30), value: parseInt(c.count) })),
  };
}

function buildCountryChart(data: DashboardData): GraphDirective | null {
  if (!data.countries.length) return null;
  return {
    type: 'donut',
    title: 'Publications by Country',
    data: data.countries.slice(0, 12).map(c => ({
      label: c.country, value: parseInt(c.count),
    })),
  };
}

export function buildDashboardCharts(data: DashboardData): GraphDirective[] {
  return [
    buildYearSourceChart(data),
    buildCollabChart(data),
    buildCountryChart(data),
  ].filter((c): c is GraphDirective => c !== null);
}

export type { DashboardData };
