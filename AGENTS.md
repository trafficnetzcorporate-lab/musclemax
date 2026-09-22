# Muscle Max working rules

## Preserve working behavior

For visual changes, preserve workout calculations, timing, native audio ducking,
keep-awake calls, authentication, accounts, and Friend Challenges. Edit the React
source under `src/`; do not patch generated `dist` or `ios/App/App/public` files.

## Mobile text and layout

- Check the UI at 320 CSS pixels, including enlarged text. The connected iPhone
  can expose a 320px viewport when Display Zoom is enabled.
- Use natural content heights and minimum touch sizes instead of fixed-height
  text containers. Buttons and form controls should have at least 44px targets.
- Flex/grid text children need `min-width: 0`. Use normal word wrapping and
  `overflow-wrap: anywhere` for long names. Wrap text in a shrinkable span when
  it shares a flex row with an icon.
- Use responsive, content-sized grids for controls and set counts. Avoid fixed
  columns that split two-digit values or squeeze navigation into letter stacks.
- Show complete exercise names and instructional copy. Do not use clipping,
  page-level `overflow-x: hidden`, or smaller text to conceal an overflow bug.
- Dialogs must fit within the viewport and allow their contents to scroll.
- Keep the existing dark/gold visual system and visible focus/pressed states.

After UI changes, run `npm run test:layout` and inspect the screenshots. Setup
and scope are in `docs/mobile-layout-quality.md`. Also build and verify the
bundled app on the phone when a native development build is requested.

## Native development and Git

Bundled iPhone testing uses `npm run ios:sync:bundled`, then a Debug build/install
from Xcode. Lovable hot reload is opt-in. See `docs/ios-development.md`.
Never assume Xcode pulls GitHub automatically or that an installed bundled app
updates itself. Preserve uncommitted work when bringing in upstream changes.
Do not submit to TestFlight or the App Store without a separate request.
