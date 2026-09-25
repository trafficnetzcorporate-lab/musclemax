/* Real Dashboard → Summary → Share dialog, with invented accounts/workouts and
 * controlled upload/RPC promises. All external browser requests are blocked.
 * Run: node tests/challenges/check.cjs
 * Uses the pinned tests/mobile-layout Playwright installation.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');
const { chromium } = createRequire(path.join(__dirname, '../mobile-layout/check.cjs'))('playwright');
const { session, challengeId, mocks } = require('./fixtures.cjs');

const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'tests/mobile-layout/node_modules/.cache/challenges');
const entry = 'virtual:challenge-check';
const base = 'http://127.0.0.1:4182';
const publicOrigin = 'https://musclemax-fixture.example.test';
const genericMessage = 'Could not create the challenge. Your workout is saved on this device. Please try again.';
const networkMessage = 'Could not reach Muscle Max. Your workout is saved on this device. Check your connection and try again.';
const authMessage = 'Please sign in again to share your workout. Your workout is saved on this device.';
const syncMessage = 'Your workout has not finished syncing yet. Please try again in a moment.';

(async () => {
  const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')).href);
  let server;
  let browser;
  let activePage;
  try {
    await fs.mkdir(output, { recursive: true });
    server = await createServer({
      root,
      logLevel: 'error',
      cacheDir: path.join(output, 'vite-cache'),
      define: { 'import.meta.env.VITE_PUBLIC_APP_URL': JSON.stringify(publicOrigin) },
      server: { host: '127.0.0.1', port: 4182, strictPort: true, hmr: false },
      plugins: [{
        name: 'isolated-challenge-check',
        enforce: 'pre',
        resolveId(id) { if (id === entry) return '\0' + entry; },
        load(id) {
          const relative = path.relative(root, id.split('?')[0]);
          if (mocks[relative]) return mocks[relative];
          if (id === '\0' + entry) return `
            import React from 'react';
            import { createRoot } from 'react-dom/client';
            import { MemoryRouter } from 'react-router-dom';
            import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
            import { Toaster } from 'sonner';
            import EmomDashboard from '/src/components/emom/EmomDashboard.tsx';
            import { challengeErrorMessage } from '/src/lib/challenge-errors.ts';
            import '/src/index.css';
            window.__challengeMessage = challengeErrorMessage;
            createRoot(document.getElementById('root')).render(
              React.createElement(MemoryRouter, null,
                React.createElement(QueryClientProvider, { client: new QueryClient() },
                  React.createElement(EmomDashboard), React.createElement(Toaster))));
          `;
        },
        configureServer(vite) {
          vite.middlewares.use('/__challenge-check', async (_request, response, next) => {
            try {
              const html = await vite.transformIndexHtml('/__challenge-check', `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><div id="root"></div><script type="module" src="/@id/__x00__${entry}"></script></body></html>`);
              response.setHeader('Content-Type', 'text/html');
              response.end(html);
            } catch (error) { next(error); }
          });
        },
      }],
    });
    await server.listen();
    browser = await chromium.launch({ channel: process.env.LAYOUT_BROWSER_CHANNEL || 'chrome', headless: true });

    for (const scenario of ['success', 'upload-error', 'backend-error', 'network-error']) {
      const context = await browser.newContext({ viewport: { width: 320, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
      await context.addInitScript(() => {
        window.__challengeTest = { calls: [], completed: [], shared: [], upload: null, rpc: null };
        // Even an accidental test click must not open a system share sheet or clipboard.
        Object.defineProperty(navigator, 'share', { configurable: true, value: async payload => {
          window.__challengeTest.shared.push(['share', payload]);
        } });
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => {
          window.__challengeTest.shared.push(['copy', text]);
        } } });
      });
      const page = await context.newPage();
      activePage = page;
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/__challenge-check', { waitUntil: 'networkidle' });
      assert.equal(await page.locator('vite-error-overlay').count(), 0);
      await page.getByRole('button', { name: /^Regular Push-Up / }).click();
      await page.getByRole('button', { name: 'Start Workout', exact: true }).click();
      await page.getByRole('button', { name: 'Complete fixture workout', exact: true }).click();
      await page.getByRole('heading', { name: 'Workout Complete', exact: true }).waitFor();
      assert.deepEqual(await page.evaluate(() => window.__challengeTest.completed), [session]);

      const challenge = page.getByRole('button', { name: 'Challenge a Friend', exact: true });
      const dialog = page.getByRole('dialog', { name: 'Friend Challenge created' });
      const calls = () => page.evaluate(() => window.__challengeTest.calls);
      const begin = async () => {
        const previousCalls = await calls();
        await challenge.click();
        await page.waitForFunction(length => window.__challengeTest.calls.length > length, previousCalls.length);
        assert.ok(await challenge.isDisabled(), 'Sharing must be disabled while upload is pending');
        assert.deepEqual((await calls()).slice(previousCalls.length), [['upload', 'challenge-ui-user-fixture', session]], 'RPC must wait for upload success');
        assert.equal(await dialog.count(), 0, 'A challenge URL must not appear before upload/RPC finish');
      };
      const finishUpload = async () => {
        await page.evaluate(() => { window.__challengeTest.upload.resolve(); });
        await page.waitForFunction(() => window.__challengeTest.calls.at(-1)?.[1] === 'create_challenge_from_session');
        assert.ok(await challenge.isDisabled(), 'Sharing must stay disabled while the RPC is pending');
        assert.deepEqual((await calls()).at(-1), ['rpc', 'create_challenge_from_session', {
          p_client_session_id: session.id, p_parent_challenge_id: null,
        }]);
      };
      const finishSuccess = async () => {
        await page.evaluate(id => { window.__challengeTest.rpc.resolve({ data: id, error: null }); }, challengeId);
        await dialog.waitFor();
        await dialog.getByText(`${publicOrigin}/challenge/${challengeId}`, { exact: true }).waitFor();
        await dialog.getByText('CANONICAL TEST ATHLETE JUST HIT A NEW MAX', { exact: true }).waitFor();
        await dialog.getByText('83', { exact: true }).waitFor();
        assert.deepEqual((await calls()).at(-1), ['rpc', 'get_public_challenge', { p_challenge_id: challengeId }]);
        assert.deepEqual(await page.evaluate(() => window.__challengeTest.shared), [], 'Creating a challenge must not send it or copy anything');
        await page.screenshot({ path: path.join(output, `${scenario}-320.png`), fullPage: true });
        await dialog.getByRole('button', { name: 'Close', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        assert.ok(await challenge.isEnabled(), 'Closing sharing must return to the usable workout summary');
        await page.getByRole('heading', { name: 'Workout Complete', exact: true }).waitFor();
      };

      await begin();
      if (scenario === 'upload-error') {
        await page.evaluate(() => { window.__challengeTest.upload.reject(new Error('Upload refused by backend')); });
        await page.getByText(genericMessage, { exact: true }).waitFor();
        assert.equal((await calls()).filter(call => call[0] === 'rpc').length, 0, 'Failed upload must prevent challenge RPC');
      } else {
        await finishUpload();
        if (scenario === 'backend-error') {
          await page.evaluate(() => { window.__challengeTest.rpc.resolve({
            data: null, error: { code: '23502', message: 'null value in column creator_user_id violates not-null constraint' },
          }); });
          await page.getByText(genericMessage, { exact: true }).waitFor();
          assert.equal(await page.getByText(networkMessage, { exact: true }).count(), 0, 'Database failures must not be described as lost connectivity');
        } else if (scenario === 'network-error') {
          await page.evaluate(() => { window.__challengeTest.rpc.reject(new TypeError('Failed to fetch')); });
          await page.getByText(networkMessage, { exact: true }).waitFor();
        } else {
          await finishSuccess();
        }
      }

      if (scenario !== 'success') {
        assert.ok(await challenge.isEnabled(), 'A failed attempt must release the pending state');
        assert.equal(await dialog.count(), 0, 'A failed attempt must not show a stale challenge');
        // A desktop pointer left over the mobile-width toast pauses its dismissal.
        await page.mouse.move(0, 0);
        await page.locator('[data-sonner-toast]').waitFor({ state: 'hidden' });
        await begin();
        await finishUpload();
        await finishSuccess();
      }
      if (scenario === 'success') {
        const results = await page.evaluate(() => [
          null, undefined, {}, new Error('Unexpected failure'),
          { code: '23502', message: 'Failed to fetch database row' },
          new TypeError('Failed to fetch'), { message: 'NetworkError when attempting to fetch resource.' },
          { message: 'Load failed' }, { message: 'Network request failed' },
          { status: 401 }, { code: 'PGRST301' }, { code: 'PGRST302' }, { code: 'PGRST303' },
          new Error('Authentication required'), new Error('JWT expired'), new Error('Invalid JWT'),
          { code: 'P0001', message: 'Session not found' },
        ].map(error => window.__challengeMessage(error)));
        assert.deepEqual(results, [
          genericMessage, genericMessage, genericMessage, genericMessage, genericMessage,
          networkMessage, networkMessage, networkMessage, networkMessage,
          authMessage, authMessage, authMessage, authMessage, authMessage, authMessage, authMessage,
          syncMessage,
        ]);
        console.log('PASS error classification: server, fetch/network, auth/JWT, session-sync, and unknown errors');
      }
      assert.deepEqual(errors, [], `Unexpected browser errors in ${scenario}`);
      assert.deepEqual(await page.evaluate(() => window.__challengeTest.completed), [session], 'Sharing/retrying must not re-complete the workout');
      console.log(`PASS ${scenario}: summary share dialog, upload/RPC order, pending state${scenario === 'success' ? '' : ', recovery and successful retry'}`);
      await context.close();
    }
    console.log(`Challenge UI regression passed. Screenshots: ${output}`);
  } catch (error) {
    if (activePage && !activePage.isClosed()) {
      await activePage.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
      console.error('Failure screen:', await activePage.locator('body').innerText());
    }
    throw error;
  } finally {
    if (browser) await browser.close();
    if (server) await server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
