/* ── StatComposer (Composer) ───────────────────────────────────
 * The DGA chart-composition seam for Statistician-backed dashboards: a
 * `kind → compose(ctx) → GraphDirective` registry. A Composer assembles UI
 * directives from READS (the Statistician resolver) — no DB access, no writes.
 * Emits the same `{type, title, yLabel?, data: GraphDataPoint[]}` shape the
 * frontend's GraphRender already consumes, but SERVER-side and typed against the
 * shared data vocabulary (@nexus/shared) — generalizing the `kind` dispatch that
 * `architect-replay.recompose` does for the atom/replay charts.
 *
 * This is the explicit chart registry DGA_DESIGN calls for (no AI shape
 * inference — known code paths, known shapes). Frontend client builders still
 * exist; they migrate to consume these server directives incrementally.
 * ──────────────────────────────────────────────────────────── */

import type { ActorContext } from "../../substrate/actor";
import type { GraphDataPoint } from "@nexus/shared/graph-data.types";
import { statistician } from "../catalog/Statistician";
import { composeCadence } from "./PublicationCharts";

/** Minimal server-emitted chart directive (the contract GraphRender reads).
 *  The frontend GraphDirective is a superset with render-runtime fields the
 *  server never sets. */
export interface ServerGraphDirective {
  type: "bar" | "donut" | "line" | "stacked-bar";
  title: string;
  yLabel?: string;
  data: GraphDataPoint[];
}

const top = (s: string, n = 30) => (s || "").slice(0, n);

// kind → async compose(ctx) → directive. Pure reads via the Statistician.
// `unknown` return so atom-bearing time-series directives (PublicationCharts)
// register alongside the simple category directives — both are GraphDirectives
// the frontend GraphRenders; the difference is data vs atoms.
const COMPOSERS: Record<string, (ctx: ActorContext) => Promise<unknown>> = {
  // Per-researcher cadence (scoped by ctx.orcid) — the same Composer the public
  // tenant page uses, here under the authenticated scope. Atom-bearing → uniform
  // legend-toggle drop, like the public one.
  "publications.cadence": (ctx) => composeCadence(ctx),
  async publicationsByYear(ctx) {
    const rows: Array<{ year: string; count: string | number }> = await statistician.byYear(ctx);
    const byYear = new Map<string, number>();
    for (const r of rows) byYear.set(r.year, (byYear.get(r.year) || 0) + Number(r.count));
    const years = [...byYear.keys()].sort();
    if (years.length <= 1) return null;
    return { type: "bar", title: "Publications by Year", yLabel: "Articles",
      data: years.map((year) => ({ label: year, value: byYear.get(year)! })) };
  },
  async topJournals(ctx) {
    const rows: Array<{ value: string; count: string | number }> = await statistician.topJournals(ctx);
    if (!rows.length) return null;
    return { type: "bar", title: "Top Journals", yLabel: "Publications",
      data: rows.map((r) => ({ label: top(r.value), value: Number(r.count) })) };
  },
  async collaboratingInstitutions(ctx) {
    const rows: Array<{ value: string; count: string | number }> = await statistician.collaborations(ctx);
    if (!rows.length) return null;
    return { type: "bar", title: "Top Collaborating Institutions", yLabel: "Co-authored Papers",
      data: rows.slice(0, 15).map((r) => ({ label: top(r.value), value: Number(r.count) })) };
  },
  async countries(ctx) {
    const rows: Array<{ country: string; count: string | number }> = await statistician.countries(ctx);
    if (!rows.length) return null;
    return { type: "donut", title: "Publications by Country",
      data: rows.slice(0, 12).map((r) => ({ label: r.country, value: Number(r.count) })) };
  },
};

class StatComposer {
  kinds() { return Object.keys(COMPOSERS); }
  async compose(ctx: ActorContext, kind: string): Promise<unknown> {
    const fn = COMPOSERS[kind];
    if (!fn) { const e: any = new Error(`Unknown chart kind: ${kind}`); e.code = "UNKNOWN_KIND"; throw e; }
    return fn(ctx);
  }
  /** Compose all DASHBOARD charts (the simple category set). Dotted kinds
   *  (e.g. `publications.cadence`) are explicit-fetch only — not part of the
   *  all-charts sweep — so the dashboard grid keeps its fixed card set. */
  async dashboard(ctx: ActorContext): Promise<ServerGraphDirective[]> {
    const dashKinds = this.kinds().filter((k) => !k.includes("."));
    const out = await Promise.all(dashKinds.map((k) => this.compose(ctx, k)));
    return out.filter((d): d is ServerGraphDirective => d !== null);
  }
}

export const statComposer = new StatComposer();
