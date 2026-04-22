/** One piece of a rich label: a run of characters with inline styling flags.
 *  Scientific titles from CrossRef / OpenAlex commonly carry <i>, <em>, <b>,
 *  <strong>, <sub>, <sup>, and HTML entities (&amp;, &ndash;, &alpha;, etc.)
 *  which SVG <text> renders as literal markup unless we parse them out. */
export interface LabelRun {
  text: string;
  italic?: boolean;
  bold?: boolean;
  sub?: boolean;
  sup?: boolean;
}

const NAMED_ENTITY: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  times: '×', divide: '÷', plus: '+', minus: '−',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ',
  eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ',
  nu: 'ν', xi: 'ξ', omicron: 'ο', pi: 'π', rho: 'ρ', sigma: 'σ',
  tau: 'τ', upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Alpha: 'Α', Beta: 'Β', Gamma: 'Γ', Delta: 'Δ', Epsilon: 'Ε', Zeta: 'Ζ',
  Eta: 'Η', Theta: 'Θ', Iota: 'Ι', Kappa: 'Κ', Lambda: 'Λ', Mu: 'Μ',
  Nu: 'Ν', Xi: 'Ξ', Omicron: 'Ο', Pi: 'Π', Rho: 'Ρ', Sigma: 'Σ',
  Tau: 'Τ', Upsilon: 'Υ', Phi: 'Φ', Chi: 'Χ', Psi: 'Ψ', Omega: 'Ω',
  deg: '°', plusmn: '±', micro: 'µ', trade: '™', copy: '©', reg: '®',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#(\d+)|#x([0-9a-f]+)|([a-zA-Z]+));/g, (m, _, dec, hex, name) => {
    if (dec) return String.fromCodePoint(parseInt(dec, 10));
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    return NAMED_ENTITY[name] ?? m;
  });
}

const TAG_MAP: Record<string, keyof LabelRun> = {
  i: 'italic', em: 'italic',
  b: 'bold', strong: 'bold',
  sub: 'sub', sup: 'sup',
};

/** Parse a label with inline HTML into a flat sequence of styled text runs.
 *  Unknown tags are skipped; their text content is preserved as plain text. */
export function parseLabel(raw: string): LabelRun[] {
  if (!raw) return [];
  const runs: LabelRun[] = [];
  const stack: Partial<LabelRun>[] = [{}];
  const tagRe = /<\/?\s*([a-zA-Z0-9]+)[^>]*>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const push = (text: string) => {
    if (!text) return;
    const top = stack[stack.length - 1];
    runs.push({ text: decodeEntities(text), ...top });
  };
  while ((m = tagRe.exec(raw)) !== null) {
    if (m.index > last) push(raw.slice(last, m.index));
    const full = m[0];
    const name = m[1].toLowerCase();
    const closing = full.startsWith('</');
    const flag = TAG_MAP[name];
    if (closing) {
      if (flag) stack.pop();
    } else if (flag) {
      stack.push({ ...stack[stack.length - 1], [flag]: true });
    }
    last = m.index + full.length;
  }
  if (last < raw.length) push(raw.slice(last));
  return runs;
}

/** Convenience: strip markup entirely. Same runs, concatenated. */
export function plainText(raw: string): string {
  return parseLabel(raw).map(r => r.text).join('');
}
