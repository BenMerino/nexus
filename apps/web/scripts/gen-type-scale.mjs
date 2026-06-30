/**
 * gen-type-scale.mjs — render the type system from ui/dna/type-scale.js into
 * BOTH artifacts (dna.css type block + tokens.ts typography map), between
 * sentinel markers. Idempotent: same source → byte-identical output.
 *
 *   npm run gen:type            # write
 *   npm run gen:type -- --check # CI: exit 1 if artifacts are stale (drifted)
 *
 * The markers are the contract. Everything between them is GENERATED — never
 * hand-edit; edit ui/dna/type-scale.js and re-run.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAMILIES, TYPE_ROLES, GENERAL } from '../ui/dna/type-scale.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const CSS = resolve(WEB, 'public/dna.css');
const TOKENS = resolve(WEB, 'ui/primitives/tokens.ts');

const BEGIN = (id) => `/* @generated:type-scale ${id} — DO NOT EDIT. Source: ui/dna/type-scale.js. Run: npm run gen:type */`;
const END = (id) => `/* @end:type-scale ${id} */`;
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));

/** Replace the block between the BEGIN/END sentinels for `id` in `text`. */
function splice(text, id, body) {
  const b = BEGIN(id), e = END(id);
  const bi = text.indexOf(b), ei = text.indexOf(e);
  if (bi === -1 || ei === -1) throw new Error(`sentinels for "${id}" not found in target — add ${b} … ${e}`);
  return text.slice(0, bi + b.length) + '\n' + body + '\n  ' + text.slice(ei);
}

// ── CSS body: families + per-role size/weight/leading/tracking ──────────────
function cssBody() {
  const L = [];
  L.push('  /* Families — role tokens (raw stacks in shared.css :root). */');
  for (const f of Object.values(FAMILIES)) L.push(`  ${pad(f.token + ':', 16)}${pad(f.value + ';', 18)}/* ${f.note} */`);
  L.push('');
  L.push('  /* Sizes (rem so they scale with root font-size). */');
  for (const [k, r] of Object.entries(TYPE_ROLES)) L.push(`  ${pad('--text-' + k + ':', 16)}${pad(r.size + ';', 11)}/* ${r.px}px — ${r.note} */`);
  L.push('');
  L.push('  /* Weights. */');
  for (const [k, r] of Object.entries(TYPE_ROLES)) L.push(`  ${pad('--weight-' + k + ':', 18)}${r.weight};`);
  L.push('');
  L.push('  /* Leading — per role + general escape hatches. */');
  for (const [k, v] of Object.entries(GENERAL.leading)) L.push(`  ${pad('--leading-' + k + ':', 19)}${v};`);
  for (const [k, r] of Object.entries(TYPE_ROLES)) L.push(`  ${pad('--leading-' + k + ':', 19)}${r.leading};`);
  L.push('');
  L.push('  /* Tracking — per role (roles with tracking:inherit are omitted) + general. */');
  L.push(`  ${pad('--tracking-tight:', 20)}${GENERAL.tracking.tight};`);
  L.push(`  ${pad('--tracking-h:', 20)}-0.005em;  /* sans headings */`);
  L.push(`  ${pad('--tracking-body:', 20)}0;`);
  for (const [k, r] of Object.entries(TYPE_ROLES)) {
    if (r.tracking === 'inherit' || k === 'h1' || k === 'h2' || k === 'body') continue;
    L.push(`  ${pad('--tracking-' + k + ':', 20)}${r.tracking};`);
  }
  return L.join('\n');
}

/** Which --tracking-* var a role points at. h1/h2 share the sans-heading
 *  token, body the body token; the rest own a per-role token. Mirrors the CSS
 *  emitter so the two artifacts can never reference an undefined var. */
function trackingVar(k) {
  if (k === 'h1' || k === 'h2') return '--tracking-h';
  if (k === 'body') return '--tracking-body';
  return `--tracking-${k}`;
}

// ── tokens.ts body: the typography map (one CSSProperties per role) ─────────
function tokensBody() {
  const fam = { display: 'var(--font-display)', body: 'var(--font-body)', mono: 'var(--font-mono)' };
  const L = ['export const typography: Record<string, React.CSSProperties> = {'];
  for (const [k, r] of Object.entries(TYPE_ROLES)) {
    const parts = [
      `fontFamily: '${fam[r.family]}'`,
      `fontSize: 'var(--text-${k})'`,
      `fontWeight: w('var(--weight-${k})')`,
      `lineHeight: 'var(--leading-${k})'`,
    ];
    if (r.tracking !== 'inherit') parts.push(`letterSpacing: 'var(${trackingVar(k)})'`);
    if (r.uppercase) parts.push(`textTransform: 'uppercase'`);
    L.push(`  ${k}: { ${parts.join(', ')} },`);
  }
  L.push('};');
  return L.join('\n');
}

function apply(path, id, body, indent) {
  const before = readFileSync(path, 'utf8');
  const after = splice(before, id, body.split('\n').map((l) => (l ? indent + l : l)).join('\n'));
  return { before, after, path };
}

const check = process.argv.includes('--check');
const jobs = [
  apply(CSS, 'css', cssBody(), ''),
  apply(TOKENS, 'tokens', tokensBody(), ''),
];

let stale = 0;
for (const j of jobs) {
  if (j.before === j.after) { console.log(`✓ ${j.path.replace(WEB + '/', '')} up to date`); continue; }
  if (check) { console.error(`✗ STALE: ${j.path.replace(WEB + '/', '')} — run \`npm run gen:type\``); stale++; continue; }
  writeFileSync(j.path, j.after);
  console.log(`✓ wrote ${j.path.replace(WEB + '/', '')}`);
}
if (check && stale) process.exit(1);
console.log(check ? '✓ type artifacts in sync with source' : `✓ generated ${Object.keys(TYPE_ROLES).length} roles from ui/dna/type-scale.js`);
