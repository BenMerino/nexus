/* Headless capture of the stacked-bar legend-toggle behavior.
 *
 * Drives the live (or any) tenant charts page with chromium, enables the
 * permanent chart-trace (localStorage['nexus:debug']), toggles a stacked-bar
 * series, and prints every [nexus:*] console line + any /api fetch fired during
 * the toggle. The mountId pattern in the output tells us tween-vs-remount.
 *
 * Usage:
 *   node scripts/chart-trace-capture.mjs [baseUrl] [slug] [seriesLabel]
 * Defaults: live deploy, slug=utalca, series=WoS.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'https://nexus-web-production-9df1.up.railway.app';
const SLUG = process.argv[3] || 'utalca';
const SERIES = process.argv[4] || 'WoS';
const URL = `${BASE}/t/${SLUG}#charts`;

const traceLines = [];
const apiCalls = [];

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('console', (msg) => {
  const t = msg.text();
  if (t.includes('[nexus:')) traceLines.push(t);
});
page.on('request', (req) => {
  const u = req.url();
  if (u.includes('/api/')) apiCalls.push(`${req.method()} ${u.replace(/^https?:\/\/[^/]+/, '')}`);
});

console.log(`→ loading ${URL}`);
await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });

// Enable the permanent trace, then reload so probes fire on a fresh mount.
await page.evaluate(() => localStorage.setItem('nexus:debug', 'charts,anim'));
await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForTimeout(1500); // let charts mount + animate

console.log(`→ trace lines during MOUNT: ${traceLines.length}`);
const mountTrace = traceLines.slice();
traceLines.length = 0;
apiCalls.length = 0;

// Find the legend pill (a <button> whose text is the series label) and click it.
const pill = page.getByRole('button', { name: SERIES, exact: false }).first();
const found = await pill.count();
console.log(`→ legend pill "${SERIES}" found: ${found > 0}`);
if (found === 0) {
  console.log('!! could not find the series pill — dumping all button labels:');
  const labels = await page.getByRole('button').allInnerTexts();
  console.log(labels.map((l) => JSON.stringify(l)).join('\n'));
  await browser.close();
  process.exit(2);
}

console.log(`→ clicking "${SERIES}" …`);
await pill.click();
await page.waitForTimeout(1200); // capture the post-toggle frames

console.log('\n=== MOUNT trace (fresh load) ===');
for (const l of mountTrace) console.log('  ' + l);
console.log('\n=== TOGGLE trace (after clicking the series) ===');
for (const l of traceLines) console.log('  ' + l);
console.log('\n=== /api calls during TOGGLE (should be empty for a query-less chart) ===');
console.log(apiCalls.length ? apiCalls.map((c) => '  ' + c).join('\n') : '  (none)');

// Verdict heuristic.
const remounted = traceLines.some((l) => l.includes('animation MOUNT') || l.includes('INIT activeSet'));
const tweened = traceLines.some((l) => l.includes('animation TWEEN'));
console.log('\n=== VERDICT ===');
let code = 0;
if (remounted) { console.log('  FAIL: REMOUNT on toggle → the "reload" (refs discarded, snap not tween).'); code = 1; }
else if (apiCalls.length) { console.log('  FAIL: a /api call fired on a query-less toggle (see above).'); code = 1; }
else if (tweened) { console.log('  PASS: TWEEN on toggle, same mountId, no refetch → animates the Y diff like Zincro.'); }
else { console.log('  INCONCLUSIVE — see trace above.'); code = 3; }

await browser.close();
process.exit(code);
