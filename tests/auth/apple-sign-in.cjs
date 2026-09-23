/* Isolated UI contract test: no real accounts, OAuth requests, or native bridge.
 * Run: node tests/auth/apple-sign-in.cjs
 * Uses the existing tests/mobile-layout Playwright installation.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');
const { chromium } = createRequire(path.join(__dirname, '../mobile-layout/check.cjs'))('playwright');

const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'tests/mobile-layout/node_modules/.cache/apple-sign-in');
const entry = 'virtual:apple-auth-check';
const hook = path.join(root, 'src/hooks/useAuth.tsx');
const authMock = `
  export const peekPostAuthRedirect = () => '/challenge/invented-test';
  export const takePostAuthRedirect = () => null;
  export const useAuth = () => ({
    user: null, loading: false,
    signInWithProvider: provider => {
      window.__authTest.calls.push(['provider', provider]);
      return new Promise((resolve, reject) => {
        window.__authTest.settle = (kind, message) => kind === 'reject'
          ? reject(new Error(message)) : resolve({ error: message });
      });
    },
    signInWithEmail: async (...args) => {
      window.__authTest.calls.push(['email', ...args]);
      return { error: null };
    },
    signUpWithEmail: async (...args) => {
      window.__authTest.calls.push(['signup', ...args]);
      return { error: null, needsConfirmation: true };
    },
  });
`;

(async () => {
  const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')).href);
  let server;
  let browser;
  try {
    await fs.mkdir(output, { recursive: true });
    server = await createServer({
      root,
      logLevel: 'error',
      cacheDir: path.join(output, 'vite-cache'),
      server: { host: '127.0.0.1', port: 4176, strictPort: true },
      plugins: [{
        name: 'isolated-apple-sign-in-check',
        enforce: 'pre',
        resolveId(id) { if (id === entry) return '\0' + entry; },
        load(id) {
          if (id.split('?')[0] === hook) return authMock;
          if (id === '\0' + entry) return `
            import React from 'react';
            import { createRoot } from 'react-dom/client';
            import { MemoryRouter } from 'react-router-dom';
            import { Toaster } from 'sonner';
            import Auth from '/src/pages/Auth.tsx';
            import '/src/index.css';
            createRoot(document.getElementById('root')).render(
              React.createElement(MemoryRouter, null,
                React.createElement(Auth), React.createElement(Toaster)));
          `;
        },
        configureServer(vite) {
          vite.middlewares.use('/__auth-check', async (_request, response, next) => {
            try {
              const html = await vite.transformIndexHtml('/__auth-check', `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><div id="root"></div><script type="module" src="/@id/__x00__${entry}"></script></body></html>`);
              response.setHeader('Content-Type', 'text/html');
              response.end(html);
            } catch (error) { next(error); }
          });
        },
      }],
    });
    await server.listen();
    browser = await chromium.launch({ channel: process.env.LAYOUT_BROWSER_CHANNEL || 'chrome', headless: true });
    const base = 'http://127.0.0.1:4176';
    for (const platform of ['web', 'android', 'ios']) {
      const context = await browser.newContext({ viewport: { width: 320, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
      await context.addInitScript(platform => {
        window.__authTest = { calls: [], settle: null };
        if (platform !== 'web') window.CapacitorCustomPlatform = { name: platform };
      }, platform);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/__auth-check', { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: 'Muscle Max Account' }).waitFor();
      assert.equal(await page.locator('vite-error-overlay').count(), 0);
      const apple = page.getByRole('button', { name: 'Sign in with Apple', exact: true });
      const google = page.getByRole('button', { name: 'Continue with Google', exact: true });
      await google.waitFor();
      assert.equal(await apple.count(), platform === 'ios' ? 1 : 0, `Apple visibility on ${platform}`);
      if (platform === 'ios') {
        for (const scale of [100, 200]) {
          await page.evaluate(scale => { document.documentElement.style.fontSize = scale + '%'; }, scale);
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), `${16 * scale / 100}px`);
          const geometry = await apple.evaluate(button => {
            const bounds = button.getBoundingClientRect();
            const label = button.querySelector('span');
            return {
              height: bounds.height, width: bounds.width,
              documentWidth: document.documentElement.scrollWidth,
              viewport: document.documentElement.clientWidth,
              labelOverflow: label.scrollWidth > label.clientWidth + 1,
              color: getComputedStyle(button).color,
              background: getComputedStyle(button).backgroundColor,
            };
          });
          assert.ok(geometry.height >= 44 && geometry.width >= 140, JSON.stringify(geometry));
          assert.ok(geometry.documentWidth <= geometry.viewport + 1 && !geometry.labelOverflow, JSON.stringify(geometry));
          assert.equal(geometry.color, 'rgb(0, 0, 0)');
          assert.equal(geometry.background, 'rgb(255, 255, 255)');
          const splitTabWords = await page.locator('[role="tab"]').evaluateAll(tabs => tabs.flatMap(tab => {
            const split = [];
            for (const node of tab.childNodes) {
              if (node.nodeType !== Node.TEXT_NODE) continue;
              for (const match of node.textContent.matchAll(/\S+/g)) {
                const range = document.createRange();
                range.setStart(node, match.index);
                range.setEnd(node, match.index + match[0].length);
                if (range.getClientRects().length > 1) split.push(match[0]);
              }
            }
            return split;
          }));
          assert.deepEqual(splitTabWords, [], `Account tabs must not split words at ${scale}% text`);
          await page.screenshot({ path: path.join(output, `ios-320-${scale}.png`), fullPage: true });
        }
        await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
        await apple.click();
        assert.deepEqual(await page.evaluate(() => window.__authTest.calls), [['provider', 'apple']]);
        assert.ok(await apple.isDisabled());
        assert.ok(await google.isDisabled());
        assert.ok(await page.locator('form').getByRole('button').isDisabled());
        assert.equal(await apple.getAttribute('aria-busy'), 'true');
        await page.getByRole('status').filter({ hasText: 'Opening Apple sign-in' }).waitFor();
        await page.evaluate(() => window.__authTest.settle('resolve', 'Apple provider setup is incomplete.'));
        await page.getByText('Apple provider setup is incomplete.', { exact: true }).waitFor();
        await page.waitForFunction(() => !document.querySelector('[aria-busy]')?.disabled);
        assert.ok(await google.isEnabled());
        assert.equal(await apple.getAttribute('aria-busy'), 'false');
        await apple.click();
        await page.evaluate(() => window.__authTest.settle('reject', 'Could not open Apple sign-in.'));
        await page.getByText('Could not open Apple sign-in.', { exact: true }).waitFor();
        await page.waitForFunction(() => !document.querySelector('[aria-busy]')?.disabled);
        assert.ok(await google.isEnabled());
      }
      await google.click();
      const calls = await page.evaluate(() => window.__authTest.calls);
      assert.deepEqual(calls.at(-1), ['provider', 'google']);
      await page.evaluate(() => window.__authTest.settle('resolve', null));
      await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(b => b.textContent === 'Continue with Google')?.disabled);
      await page.getByLabel('Email', { exact: true }).fill('athlete@example.test');
      await page.getByLabel('Password', { exact: true }).fill('invented-password');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      assert.deepEqual((await page.evaluate(() => window.__authTest.calls)).at(-1), ['email', 'athlete@example.test', 'invented-password']);
      await page.getByRole('tab', { name: 'Create account', exact: true }).click();
      await page.getByLabel('Display name', { exact: true }).fill('Test Athlete');
      await page.getByRole('button', { name: 'Create account', exact: true }).click();
      await page.getByText('Check your email to confirm your account.', { exact: true }).waitFor();
      assert.deepEqual((await page.evaluate(() => window.__authTest.calls)).at(-1), ['signup', 'athlete@example.test', 'invented-password', 'Test Athlete']);
      assert.deepEqual(errors, [], `Unexpected browser errors on ${platform}`);
      console.log(`PASS ${platform}: visibility, existing Google/email flows${platform === 'ios' ? ', Apple busy/errors and 320px at 100/200% text' : ''}`);
      await context.close();
    }
    console.log(`Apple sign-in UI contract passed. Screenshots: ${output}`);
  } finally {
    if (browser) await browser.close();
    if (server) await server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
