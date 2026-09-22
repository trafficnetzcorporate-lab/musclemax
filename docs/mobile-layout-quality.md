# Mobile layout quality

The layout fixes live in React components and shared UI styles. Generated web
and iOS assets are recreated from that source each time the app is built.

## Repeatable check

Install the isolated browser-check dependency once (it does not change the
application's dependencies):

```sh
npm install --prefix tests/mobile-layout
npm run test:layout
```

The check uses installed Google Chrome, starts local Vite on port 4173 if needed,
and exercises dashboard, exercise detail, active timer, legs, calculators,
authentication layouts, challenge fallback states, history, charts, long names,
summary states, and the share dialog. It checks widths 320, 375, 390, 430 and
768 pixels at 100% and 200% root text size. It fails for horizontal page/text
overflow or clipped text and saves screenshots plus a JSON report under
`tests/mobile-layout/node_modules/.cache/results`.

Each browser context is isolated and all external network requests are blocked.
Invented fixture data never reaches real accounts; no real workout is saved.
This is a layout regression check, not an account/native functionality test.
Review the screenshots as well: automated geometry checks cannot judge every
overlap, awkward line break, or future screen design.

Useful overrides:

```sh
LAYOUT_WIDTHS=320 LAYOUT_SCALES=200 npm run test:layout
LAYOUT_CASES=dashboard,exercise,active-timer,share-dialog npm run test:layout
LAYOUT_OUTPUT_DIR=/path/to/results npm run test:layout
```

If Chrome is unavailable, install Playwright's Chromium in the isolated test
directory and set `LAYOUT_BROWSER_CHANNEL=chromium`. A preinstalled Playwright
package may also be supplied via Node's standard `NODE_PATH` environment variable.

## How changes reach each copy

- **Lovable ↔ GitHub:** the linked active branch syncs between these services.
- **This Mac:** uses its own working checkout. Pull/merge upstream edits while
  preserving local work, and commit/push reviewed local changes to share them.
- **Xcode:** builds this local checkout and the web assets last copied into it.
  It does not continuously pull GitHub or rebuild web assets automatically.
- **Installed bundled iPhone app:** contains a snapshot from its last build and
  installation. After source changes, run `npm run ios:sync:bundled`, then build
  and install the Debug app again. Existing online data can sync independently
  of an app-code update.

Do not fix generated copies directly; a subsequent sync would overwrite those
changes. Keep source fixes and these quality checks together when committing.
