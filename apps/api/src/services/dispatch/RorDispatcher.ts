/* ── RorDispatcher (Dispatcher) ────────────────────────────────
 * Outbound lookup: a typed university name → candidate ROR identities, via
 * OpenAlex's institutions search. A Dispatcher (talks to an external system);
 * read-only here (no side effects beyond the HTTP call). Used at provision time
 * so an admin can pick/confirm the ROR for a new tenant instead of hand-typing
 * it. Wraps the existing `openalex.lookupInstitution` — no new HTTP client.
 * ──────────────────────────────────────────────────────────── */

const { lookupInstitution } = require("../../lib/openalex");

export interface RorSuggestion {
  name: string;
  ror: string | null;
  openAlexId: string;
}

class RorDispatcher {
  /** Suggest ROR identities for a typed institution name (best matches first). */
  async suggestRor(name: string): Promise<RorSuggestion[]> {
    if (!name || !name.trim()) return [];
    const hits = await lookupInstitution(name.trim());
    return hits.map((h: any) => ({ name: h.name, ror: h.ror, openAlexId: h.id }));
  }
}

export const rorDispatcher = new RorDispatcher();
