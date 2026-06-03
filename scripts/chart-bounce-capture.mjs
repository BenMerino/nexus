/* Headless capture of chart MOUNT churn — the "bounce/reload".
 *
 * Unlike the toggle capture, this watches the page from load through settle
 * and counts how many times each chart instance MOUNTS. Zincro mounts each
 * chart once; if nexus mounts the same chart repeatedly (a new mountId
 * seconds apart with no user action), that's the bounce. Also logs what fires
 * between mounts (fetches, WS) so we see the trigger.
 *
 * Usage: node scripts/chart-bounce-capture.mjs [baseUrl] [slug]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'https://nexus-web-production-9df1.up.railway.app';
const SLUG = process.argv[3] || 'utalca';
const URL = `${BASE}/t/${SLUG}#charts`;

const events = []; // {ms, kind, text}
const t0 = Date.now();
const stamp = () => Date.now() - t0;

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('console', (m) => {
  const t = m.text();
  if (t.includes('[nexus:')) events.push({ ms: stamp(), kind: 'trace', text: t });
});
page.on('request', (r) => {
  const u = r.url();
  if (u.includes('/api/')) events.push({ ms: stamp(), kind: 'api', text: `${r.method()} ${u.replace(/^https?:\/\/[^/]+/, '')}` });
});
page.on('framenavigated', (f) => {
  if (f === page.mainFrame()) events.push({ ms: stamp(), kind: 'nav', text: f.url() });
});

// Enable trace BEFORE first paint via an init script (runs on every navigation,
// before page scripts) so we catch the very first mount.
await page.addInitScript(() => {
  try { localStorage.setItem('nexus:debug', 'charts,anim'); } catch {}
});

await page.goto(URL, { waitUntil: 'load', timeout: 45000 });
// Watch the page SETTLE for several seconds — no user interaction at all.
await page.waitForTimeout(6000);

await browser.close();

// Report: timeline + mount counts per mountId.
console.log('=== TIMELINE (load → +6s, NO user action) ===');
for (const e of events) {
  const tag = e.kind === 'api' ? 'API ' : e.kind === 'nav' ? 'NAV ' : '    ';
  console.log(`  +${String(e.ms).padStart(5)}ms ${tag}${e.text}`);
}

const mounts = events.filter((e) => e.text.includes('animation MOUNT'));
const inits = events.filter((e) => e.text.includes('INIT activeSet'));
console.log('\n=== MOUNT CHURN ===');
console.log(`  animation MOUNT events: ${mounts.length}`);
console.log(`  toggleFilters INIT events: ${inits.length}`);
console.log('\n=== VERDICT ===');
if (mounts.length > inits.length * 2 || mounts.length > 12) {
  console.log('  BOUNCE: charts mounted repeatedly with no user action → the reload.');
} else {
  console.log(`  charts mounted ~once each (${mounts.length} mounts). If you still see a bounce, it may be a specific trigger (tab switch / WS).`);
}
