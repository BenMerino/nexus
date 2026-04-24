/** HTML-entity decoder used by the ingest pipeline.
 *
 *  Runs once at the boundary where upstream strings (CrossRef / OpenAlex /
 *  Semantic Scholar / DataCite) enter our own records. Titles and journal
 *  names sometimes arrive HTML-encoded (e.g. "Industrial &amp; Engineering"
 *  or "&lt;i&gt;n&lt;/i&gt;-hexane") and downstream code assumes plain text
 *  — by the time the graph bucketizer compares names for deduplication, or
 *  the SVG renderer emits <tspan>s for italics, the entities must already
 *  be real characters or those passes misbehave.
 *
 *  Keep this decoder small and synchronized with public/rich-label.ts. The
 *  render-side parser only needs to handle real inline HTML (<i>, <sub>...)
 *  since entities are already decoded by the time data reaches the client.
 */

const NAMED_ENTITY = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  times: "×", divide: "÷", plus: "+", minus: "−",
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", zeta: "ζ",
  eta: "η", theta: "θ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ",
  nu: "ν", xi: "ξ", omicron: "ο", pi: "π", rho: "ρ", sigma: "σ",
  tau: "τ", upsilon: "υ", phi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Alpha: "Α", Beta: "Β", Gamma: "Γ", Delta: "Δ", Epsilon: "Ε", Zeta: "Ζ",
  Eta: "Η", Theta: "Θ", Iota: "Ι", Kappa: "Κ", Lambda: "Λ", Mu: "Μ",
  Nu: "Ν", Xi: "Ξ", Omicron: "Ο", Pi: "Π", Rho: "Ρ", Sigma: "Σ",
  Tau: "Τ", Upsilon: "Υ", Phi: "Φ", Chi: "Χ", Psi: "Ψ", Omega: "Ω",
  deg: "°", plusmn: "±", micro: "µ", trade: "™", copy: "©", reg: "®",
};

function decodeEntities(s) {
  if (!s || typeof s !== "string") return s;
  return s.replace(/&(#(\d+)|#x([0-9a-f]+)|([a-zA-Z]+));/g, (m, _whole, dec, hex, name) => {
    if (dec) return String.fromCodePoint(parseInt(dec, 10));
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    return NAMED_ENTITY[name] !== undefined ? NAMED_ENTITY[name] : m;
  });
}

module.exports = { decodeEntities };
