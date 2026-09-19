# Native iOS Conversion Plan (Capacitor)

## Verdict

The project is well suited to Capacitor. It is a pure client-side Vite + React 18 single-page app with no server rendering, the backend is reached over HTTPS, and the timer, audio, sharing and challenge layers are already isolated behind small modules. No rewrite of the workout experience or the Friend Challenge flow is needed — the web code ships as-is inside the native shell, and four thin native bridges are added on top.

Confirmed from the project:
- Build command: `npm run build` (`vite build`). Output directory: `dist` (Vite default; no `build.outDir` override in the config).
- Routing: `BrowserRouter` with routes `/`, `/calculator`, `/female`, `/auth`, `/challenges`, `/challenge/:challengeId`, `*`.
- Sharing already goes through one module (`src/lib/share.ts`) with a `shareChallenge` / `challengeUrl` surface.
- The timer already derives elapsed seconds from wall-clock timestamps and already asks for a screen wake lock and re-arms audio on返回 to the foreground.
- Audio is a single engine class (`src/lib/emomAudio.ts`) that pre-schedules cues.

## Phase 1 — Capacitor shell

1. Add `@capacitor/core`, `@capacitor/cli` (dev), `@capacitor/ios`, `@capacitor/android`.
2. `npx cap init` with app ID `app.lovable.f86be05fd3d845ba9896ffd439c44b15`, app name `musclemax`, web directory `dist`.
3. Add the dev hot-reload `server.url` block pointing at the sandbox preview so the app can be tested on a device before the bundle is embedded. This block must be removed before any App Store build.
4. The user then exports to GitHub, pulls, runs `npm install`, `npx cap add ios`, `npm run build`, `npx cap sync`, `npx cap run ios` (Mac + Xcode required).

## Phase 2 — Routing and auth adjustments

- Switch the router to a Capacitor-aware basename/history so deep links resolve under the native scheme. `BrowserRouter` works inside the Capacitor WebView (it serves over a real origin), so no switch to hash routing is required; the change is limited to handling links that arrive from outside the app.
- Replace the three hard-coded uses of `window.location.origin` with one environment helper:
  - `challengeUrl()` must always produce the public `https://musclemax.lovable.app/challenge/:id` link, never the native scheme, or shared links break.
  - Email sign-up `emailRedirectTo` and OAuth `redirect_uri` must use a registered custom scheme / Universal Link on native, because `capacitor://localhost` is not a valid OAuth redirect target.
- Preserve the existing challenge-context redirect: the pending-challenge key already survives sign-in, and the native redirect must land back on the same `/challenge/:id`.
- Sign in with Apple must be added before submission because the app contains Google sign-in. The auth hook is already provider-agnostic (`OAuthProviderId` union, profile keyed off the stable user id), so this is a provider entry plus an Apple capability in Xcode.

## Phase 3 — Native bridges

### 1. Elapsed-time truth across background/foreground
The timer already treats wall-clock deltas as authoritative, so it recovers correctly on resume; what iOS breaks is the *cue delivery* while suspended. Add a small native plugin (or use a background-mode/local-notification plugin) that:
- registers the workout's remaining cue schedule with the OS when the app leaves the foreground,
- reports the true elapsed interval on resume from native time, not JS,
- lets `getElapsed()` keep its exact current contract so no workout logic changes.

### 2. Disable idle sleep during active workouts
Replace the `navigator.wakeLock` call path with a capability check that prefers a native keep-awake plugin (`UIApplication.isIdleTimerDisabled`) and falls back to the existing web wake lock. Acquire on start/resume, release on pause, finish and unmount — the existing acquire/release call sites are already in the right places.

### 3. AVAudioSession ducking for short EMOM cues
Add a native audio-session bridge that configures `.playback` with `.duckOthers` (and `.interruptSpokenAudioAndMixWithOthers` as appropriate), activates it when a workout starts, and deactivates when it ends, so cues cut through the user's music without stopping it. Keep the existing Web Audio engine as the sound source and the web fallback; the bridge only owns the session category. Also handle interruption and route-change notifications to re-arm the engine.

### 4. Native share and Universal Links
- Extend `src/lib/share.ts` with a native branch using the Capacitor Share plugin, keeping `shareChallenge` / `canNativeShare` signatures unchanged.
- Configure Associated Domains for `musclemax.lovable.app`, host an `apple-app-site-association` file, and add an app-open listener that maps an incoming `/challenge/:id` URL into the router so the challenge opens directly. Challenge IDs already live in the backend and are independent of frontend state, so no data changes are needed.

## Phase 4 — Verification

Re-run the existing acceptance suite on device: signed-out workout, account create/sign-out/sign-in with merged history, challenge creation and share, cold-start Universal Link into a challenge, logged-out view then sign-in returning to the same challenge, accept/complete/outcome, rematch and challenge-someone-else, plus new native checks (screen stays awake, cues duck music, timer correct after 3+ minutes backgrounded and after a phone call).

## Project-specific risks

- **Google AdSense script in `index.html`** — a web ad script inside a native app is an App Store rejection risk and will likely fail to render. It should be stripped from the native build.
- **`server.url` hot-reload block** — convenient for testing, but shipping it means the store binary loads remote code. Must be removed for release builds.
- **OAuth redirect is the most likely breakage point.** `window.location.origin` inside the WebView is not a valid provider redirect; without the scheme/Universal Link work in Phase 2, Google sign-in fails on device even though everything else works.
- **Shared links must stay web URLs.** If `challengeUrl()` picks up the native origin, every shared challenge link becomes unopenable for recipients — this is the core viral loop, so it needs an explicit test.
- **Universal Links require control of the published domain's root** to host the association file; if that file cannot be served, links will open in Safari instead of the app (still functional, but a weaker loop).
- **Auto-confirm email is currently on** from testing. Before release it should be turned off, which makes `emailRedirectTo` a real user-facing path that must point at a link the native app can handle.
- **Apple review requires Sign in with Apple** alongside Google, plus an in-app account-deletion path — neither exists yet.
- **PWA/native duplication**: the installed web app and the native app keep separate local caches. Since the cloud is canonical for signed-in users this resolves on sign-in, but a signed-out user with local-only history on the PWA will not see it in the native app until they sign in on both.
- **Clock trust**: elapsed time derived from `Date.now()` can be shifted by manually changing the device clock mid-workout. Not a V1 concern, but the native bridge should prefer a monotonic native clock.
