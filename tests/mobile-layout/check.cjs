/* Run against Vite. Separate browser contexts and blocked remote requests keep
 * these layout checks away from real accounts and workout data. */
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const base = process.env.LAYOUT_BASE_URL || 'http://127.0.0.1:4173';
const output = process.env.LAYOUT_OUTPUT_DIR || path.join(__dirname, 'node_modules/.cache/results');
const widths = (process.env.LAYOUT_WIDTHS || '320,375,390,430,768').split(',').map(Number);
const scales = (process.env.LAYOUT_SCALES || '100,200').split(',').map(Number);
const fixtures = '/tests/mobile-layout/fixtures.html?case=';
const cases = [
  ['dashboard', '/'],
  ['exercise', '/', async p => p.getByRole('button', { name: /Regular Push-Up/ }).click()],
  ['legs', '/', async p => p.getByRole('tab', { name: /Legs/ }).click()],
  ['active-timer', '/', async p => {
    await p.getByRole('button', { name: /Regular Push-Up/ }).click();
    await p.getByRole('button', { name: 'Start Workout', exact: true }).click();
    await p.getByRole('button', { name: 'START', exact: true }).click();
    await p.getByRole('button', { name: 'Pause', exact: true }).waitFor();
  }],
  ['calculator', '/calculator'],
  ['female-calculator', '/female'],
  ['rate-blank', '/rate'],
  ['rate-plan', '/rate', async p => {
    await p.getByLabel('Current total reps', { exact: true }).fill('120');
    await p.getByLabel('Planned gain per session', { exact: true }).fill('4');
  }],
  ['rate-flat', '/rate', async p => {
    await p.getByLabel('Current total reps', { exact: true }).fill('120');
    await p.getByLabel('Planned gain per session', { exact: true }).fill('0');
  }],
  ['rate-reached', '/rate', async p => p.getByLabel('Current total reps', { exact: true }).fill('300')],
  ['sign-in', '/auth'],
  ['sign-up', '/auth', async p => p.getByRole('tab', { name: 'Create account' }).click()],
  ['challenges', '/challenges'],
  ['missing-challenge', '/challenge/layout-test'],
  ['missing-page', '/layout-test-missing'],
  ...['summary', 'summary-pr', 'summary-mastery', 'challenge-result', 'share-dialog', 'history', 'weekly-chart', 'timer', 'timer-challenge', 'rate-observed'].map(name => [name, fixtures + name]),
].filter(([name]) => !process.env.LAYOUT_CASES || process.env.LAYOUT_CASES.split(',').includes(name));

async function ensureServer() {
  try { if ((await fetch(base)).ok) return null; } catch { /* Start a local Vite if needed. */ }
  if (process.env.LAYOUT_BASE_URL) throw new Error('LAYOUT_BASE_URL is not reachable');
  const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { cwd: root, stdio: 'ignore' });
  for (let attempt = 0; attempt < 50; attempt++) {
    try { if ((await fetch(base)).ok) return server; } catch { /* Wait for readiness. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  server.kill();
  throw new Error('Vite did not become ready');
}

function scanLayout() {
  const issues = [];
  const viewport = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > viewport + 2) {
    issues.push({ kind: 'page-overflow', width: document.documentElement.scrollWidth, viewport });
  }
  for (const el of document.querySelectorAll('body *')) {
    if (!(el instanceof HTMLElement) || el.closest('svg, [aria-hidden="true"], .sr-only, [hidden]')) continue;
    if (['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'NOSCRIPT'].includes(el.tagName)) continue;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') continue;
    const ownText = [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    if (!ownText.length) continue;
    const detail = { tag: el.tagName, text: el.textContent.trim().slice(0, 100), className: el.className };
    if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2 && !['auto', 'scroll'].includes(style.overflowX)) {
      issues.push({ kind: 'text-overflow', ...detail, client: el.clientWidth, scroll: el.scrollWidth });
    }
    if (['hidden', 'clip'].includes(style.overflowY) && el.scrollHeight > el.clientHeight + 2) {
      issues.push({ kind: 'text-clipped', ...detail, client: el.clientHeight, scroll: el.scrollHeight });
    }
    for (const node of ownText) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const textRect of range.getClientRects()) {
        if (textRect.width && (textRect.right > viewport + 2 || textRect.left < -2)) {
          issues.push({ kind: 'text-outside-viewport', ...detail });
          break;
        }
      }
    }
  }
  return { viewport, documentWidth: document.documentElement.scrollWidth, issues };
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  let server;
  let browser;
  const results = [];
  try {
    server = await ensureServer();
    browser = await chromium.launch({ channel: process.env.LAYOUT_BROWSER_CHANNEL || 'chrome', headless: true });
    for (const width of widths) {
      for (const scale of scales) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
        await context.route('**/*', route => {
          const url = new URL(route.request().url());
          return url.origin === new URL(base).origin ? route.continue() : route.abort();
        });
        for (const [name, route, interact] of cases) {
          const page = await context.newPage();
          const id = `${name}-${width}-${scale}`;
          try {
            await page.goto(base + route, { waitUntil: 'networkidle' });
            await page.locator('#root, #fixture-root').waitFor();
            await page.waitForFunction(() => document.querySelector('#root, #fixture-root')?.textContent.trim().length > 10);
            if (interact) await interact(page);
            await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale}%`; }, scale);
            await page.evaluate(() => document.fonts.ready);
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const result = await page.evaluate(scanLayout);
            results.push({ id, ...result });
            if (result.issues.length || (width === 320 && scale === 100)) {
              await page.screenshot({ path: path.join(output, `${id}.png`), fullPage: true });
            }
            if (result.issues.length) console.log(`FAIL ${id}: ${JSON.stringify(result.issues.slice(0, 5))}`);
          } catch (error) {
            results.push({ id, issues: [{ kind: 'test-error', message: error.message }] });
            console.log(`FAIL ${id}: ${error.message}`);
          } finally { await page.close(); }
        }
        await context.close();
      }
      console.log(`Checked ${width}px at ${scales.join('/')}% text.`);
    }
  } finally {
    if (browser) await browser.close();
    if (server) server.kill();
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  }
  const failures = results.filter(result => result.issues.length);
  console.log(`${results.length - failures.length}/${results.length} layout checks passed. Results: ${output}`);
  if (failures.length) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
