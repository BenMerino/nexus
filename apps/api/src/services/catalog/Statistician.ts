/* ── Statistician (Resolver) ───────────────────────────────────
 * Pure, scope-narrowed bibliometric READS over Publication + Author + Venue —
 * the DGA read role for the dashboard, researcher portfolio, org tree, node
 * detail, and graph metadata. NO writes, NO events (role-contracts: a Resolver
 * reads any aggregate, writes none). Wraps the already entity-migrated `lib/*`
 * read functions (dashboard-stats, portfolio, org-tree, graph-meta, node-detail)
 * behind one typed surface; handlers delegate here instead of importing the libs
 * directly. The libs stay the data layer (N4) — this is the role boundary, not a
 * rewrite. A later pass moves SQL into withTenant for RLS.
 *
 * `ActorContext` doubles as the read scope: its {tenantId, orcid, ror, role}
 * match what the lib functions expect, so ctx is passed straight through.
 * ──────────────────────────────────────────────────────────── */

import type { ActorContext } from "../../substrate/actor";

// Entity-backed read libs (CJS) — required lazily so the resolver module loads
// even before dist mirrors are present at bootstrap scan time.
const dashboard = require("../../lib/dashboard-stats");
const portfolio = require("../../lib/portfolio");
const orgTree = require("../../lib/org-tree");
const graphMeta = require("../../lib/graph-meta");
const nodeDetail = require("../../lib/node-detail-resolvers");

// The read scope the lib functions consume (a subset of ActorContext).
type Scope = Pick<ActorContext, "tenantId" | "orcid" | "role"> & { ror?: string | null };
const scopeOf = (ctx: ActorContext): Scope =>
  ({ tenantId: ctx.tenantId, orcid: ctx.orcid ?? null, ror: (ctx as any).ror ?? null, role: ctx.role });

class Statistician {
  // ── Dashboard ──
  summary(ctx: ActorContext) { return dashboard.getSummary(scopeOf(ctx)); }
  byYear(ctx: ActorContext) { return dashboard.getByYearAndSource(scopeOf(ctx)); }
  collaborations(ctx: ActorContext) { return dashboard.getCollaborations(scopeOf(ctx)); }
  countries(ctx: ActorContext) { return dashboard.getCountries(scopeOf(ctx)); }
  topJournals(ctx: ActorContext) { return dashboard.getTopJournals(scopeOf(ctx)); }
  recentPapers(ctx: ActorContext) { return dashboard.getRecentPapers(scopeOf(ctx)); }

  // ── Researcher portfolio + collaborators ──
  portfolio(ctx: ActorContext, orcid: string) { return portfolio.getResearcherPortfolio(orcid, ctx.tenantId); }
  collaborators(ctx: ActorContext, orcid: string, limit = 10) { return portfolio.findCollaborators(orcid, ctx.tenantId, limit); }

  // ── Org tree + graph metadata ──
  orgTree(ctx: ActorContext) { return orgTree.queryOrgTree(ctx.tenantId); }
  graphMetadata(ctx: ActorContext) { return graphMeta.getGraphMetadata(scopeOf(ctx)); }

  // ── Node detail (author / institution / journal / paper) ──
  node(ctx: ActorContext, kind: string, extId: string, label?: string) {
    const s = scopeOf(ctx);
    if (kind === "author") return nodeDetail.authorDetail(s, extId, label);
    if (kind === "institution") return nodeDetail.institutionDetail(s, extId, label);
    if (kind === "journal") return nodeDetail.journalDetail(s, extId, label);
    if (kind === "paper") return nodeDetail.paperDetail(s, extId);
    throw new Error(`unknown node kind: ${kind}`);
  }
}

export const statistician = new Statistician();
