/* Isolated timer regression: real timer/audio scheduler, invented reps, mocked
 * native bridge, and no remote requests. No account or workout is persisted.
 * Run: node tests/emom-timer/check.cjs
 * Uses the existing tests/mobile-layout Playwright installation.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');
const { chromium } = createRequire(path.join(__dirname, '../mobile-layout/check.cjs'))('playwright');

const root = path.resolve(__dirname, '../..');
const entry = 'virtual:emom-timer-check';
const output = path.join(root, 'tests/mobile-layout/node_modules/.cache/emom-timer');
const bridgeMock = `
  export const nativeMonotonicSeconds = async () => Date.now() / 1000;
  export const setNativeKeepAwake = async enabled => window.__timerTest.wake.push(enabled);
  export const playNativeCue = kind => window.__timerTest.cues.push(kind);
`;

(async () => {
  const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')).href);
  let server;
  let browser;
  try {
    server = await createServer({
      root,
      logLevel: 'error',
      cacheDir: path.join(output, 'vite-cache'),
      server: { host: '127.0.0.1', port: 0 },
      plugins: [{
        name: 'isolated-emom-timer-check',
        enforce: 'pre',
        resolveId(id) { if (id === entry) return '\0' + entry; },
        load(id) {
          if (id.split('?')[0] === path.join(root, 'src/lib/native-bridges.ts')) return bridgeMock;
          if (id.split('?')[0] === path.join(root, 'src/lib/platform.ts')) return 'export const isNative = () => true;';
          if (id === '\0' + entry) return `
            import React from 'react';
            import { createRoot } from 'react-dom/client';
            import EmomTimer from '/src/components/emom/EmomTimer.tsx';
            import '/src/index.css';
            const mode = new URLSearchParams(location.search).get('mode');
            createRoot(document.getElementById('root')).render(
              React.createElement(EmomTimer, {
                exerciseId: 'regular_pushup',
                phase: mode === 'baseline' ? 'baseline' : 'standard',
                prescription: [12, 12, 11, 11, 10, 10, 9, 9, 8, -1],
                isChallenge: mode === 'challenge',
                onComplete: session => { window.__timerTest.session = session; },
                onCancel: () => {},
              }));
          `;
        },
        configureServer(vite) {
          vite.middlewares.use('/__timer-check', async (_request, response, next) => {
            try {
              const html = await vite.transformIndexHtml('/__timer-check', `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><main id="root" style="max-width: 32rem; padding: 1rem; margin: auto"></main><script type="module" src="/@id/__x00__${entry}"></script></body></html>`);
              response.setHeader('Content-Type', 'text/html');
              response.end(html);
            } catch (error) { next(error); }
          });
        },
      }],
    });
    await server.listen();
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ channel: process.env.LAYOUT_BROWSER_CHANNEL || 'chrome', headless: true });
    for (const mode of ['standard', 'baseline', 'challenge']) {
      const context = await browser.newContext({ viewport: { width: 320, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
      await context.addInitScript(() => {
        window.__timerTest = { now: 1800000000000, wake: [], cues: [], session: null };
        Date.now = () => window.__timerTest.now;
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/__timer-check?mode=' + mode, { waitUntil: 'networkidle' });
      const header = page.getByText(/^Set \d+ of 10$/);
      const gridSet = number => page.getByRole('button', { name: new RegExp(`^Set ${number} `) });
      const advanceTo = async (wallSeconds, clockText, currentSet) => {
        await page.evaluate(seconds => { window.__timerTest.now = 1800000000000 + seconds * 1000; }, wallSeconds);
        await page.getByText(clockText, { exact: true }).waitFor();
        if (currentSet !== undefined) assert.equal(await header.textContent(), `Set ${currentSet} of 10`);
      };
      const editSet = async (number, reps) => {
        await gridSet(number).click();
        await page.getByRole('button', { name: String(reps), exact: true }).click();
        assert.match(await gridSet(number).innerText(), new RegExp(`Set ${number}\\s+${reps}\\s+`, 'i'));
      };

      await page.getByRole('button', { name: 'START', exact: true }).click();
      await page.getByRole('button', { name: 'Pause', exact: true }).waitFor();
      await advanceTo(1, '9:59', 1);
      await page.getByRole('button', { name: '12', exact: true }).click();
      await advanceTo(125, '7:55');
      await gridSet(3).click();
      await page.getByRole('button', { name: '9', exact: true }).click();
      await editSet(1, 7);
      assert.equal(await header.textContent(), 'Set 3 of 10', 'Editing a past set must not relabel the running minute');
      await page.getByText(/Editing Set 1/).waitFor();
      assert.match(await gridSet(3).innerText(), /Set 3\s+9\s+/i, 'Editing past reps must preserve live-set reps');
      assert.deepEqual(await page.evaluate(() => window.__timerTest.wake), [true], 'Rep editing must not release the native wake lock');

      // A minute boundary must advance the timer while the editor stays on Set 1.
      await advanceTo(180, '7:00', 4);
      await page.getByText(/Editing Set 1/).waitFor();
      await page.getByRole('button', { name: '8', exact: true }).click();
      assert.match(await gridSet(1).innerText(), /Set 1\s+8\s+/i);
      await page.waitForFunction(() => window.__timerTest.cues.length >= 2);
      assert.deepEqual(await page.evaluate(() => window.__timerTest.cues), ['hard', 'hard'], 'Native minute cues must continue during rep editing');

      // Pausing and editing another set must leave both clock and header intact.
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await page.getByRole('button', { name: 'Resume', exact: true }).waitFor();
      await editSet(2, 6);
      await advanceTo(210, '7:00', 4);
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
      await page.getByRole('button', { name: 'Pause', exact: true }).waitFor();
      await advanceTo(220, '6:50', 4);
      assert.deepEqual(await page.evaluate(() => window.__timerTest.wake), [true, false, true]);

      // Returning to the live set restores the existing automatic editor follow.
      await gridSet(4).click();
      await advanceTo(275, '5:55', 5);
      assert.equal(await page.getByText(/Editing Set/).count(), 0);
      await page.getByRole('button', { name: '11', exact: true }).click();
      assert.match(await gridSet(5).innerText(), /Set 5\s+11\s+/i);

      await advanceTo(631, '0:00', 10);
      await editSet(1, 10);
      assert.equal(await header.textContent(), 'Set 10 of 10', 'Post-workout corrections must preserve the finished timer');
      await page.getByRole('button', { name: mode === 'challenge' ? 'Submit Challenge' : 'Complete Workout', exact: true }).click();
      const session = await page.evaluate(() => window.__timerTest.session);
      assert.deepEqual(session.sets.map(set => set.actualReps), [10, 6, 9, null, 11, null, null, null, null, null]);
      assert.equal(session.totalReps, 36);
      assert.equal(session.phase, mode === 'challenge' ? 'completed' : mode);
      assert.equal((await page.evaluate(() => window.__timerTest.wake)).at(-1), false);
      assert.deepEqual(errors, [], 'Unexpected browser errors');
      console.log(`PASS ${mode}: independent timer/edit selection, minute cues, pause/resume, auto-follow, and saved reps`);
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    if (server) await server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
