// Dashboard data + entity types. The chart BUILDERS that used to live here
// (buildYearSourceChart/buildCollabChart/buildCountryChart) were removed once
// the dashboard moved to server-composed charts (<ServerCharts> →
// /api/architect/charts); this file is now types only.
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

export type { DashboardData };
