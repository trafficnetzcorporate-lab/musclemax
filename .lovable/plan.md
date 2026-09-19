# Native iOS Conversion Plan (Capacitor)

## Verdict

The project is well suited to Capacitor: a pure client-side Vite + React 18 single-page app, backend reached over HTTPS, and timer/audio/sharing already isolated in small modules. No rewrite of the workout experience or Friend Challenge flow — the web code ships as-is inside the native shell, with thin native bridges added on top.

Confirmed from the project:
- Build command: `npm run build` (`vite build`). Output directory: `dist` (Vite default; no `build.outDir` override).
- Routing: `BrowserRouter` with routes `/`, `/calculator`, `/female`, `/auth`, `/challenges`, `/challenge/:challengeId`, `*`.
- Sharing already goes through one module (`src/lib/share.ts`).
- The timer already derives elapsed seconds from wall-clock timestamps; audio is a single engine (`src/lib/emomAudio.ts`) that pre-schedules cues.

## Phase 1 — Capacitor shell (iOS only)

1. Add `@capacitor/core`, `@capacitor/cli` (dev), `@capacitor/ios`. No Android for now.
2. `npx cap init` with app name `musclemax`, web directory `dist`. **Bundle ID is NOT the generated Lovable project ID** — configure `capacitor.config` with the permanent production Bundle ID `com.jms.musclemax` (adjustable if the user prefers another) so the iOS project and App Store record are created under the permanent identity from day one.
3. Add the dev hot-reload `server.url` block for device testing from the sandbox; it must be absent from release builds (enforced as an App Store requirement below).

## Phase 2 — Configuration and routing

- Add a single configurable public app URL (`PUBLIC_APP_URL`, e.g. `https://musclemax.lovable.app` today, permanent custom domain later). **All Friend Challenge links always use this HTTPS public URL** — never the native scheme, never the preview origin.
- Replace the three hard-coded `window.location.origin` uses (share link, `emailRedirectTo`, OAuth `redirect_uri`) with one environment helper that returns the native redirect on iOS and `PUBLIC_APP_URL` for shared links.
- Email confirmation redirect on native must point at a link the app can handle (Universal Link or custom scheme).
- Universal Links: `PUBLIC_APP_URL/challenge/:id` routes directly into the existing challenge page when the app is installed, and falls back to the same web challenge page in Safari when it is not. Associated Domains entitlement + `apple-app-site-association` file are configured once the permanent domain and Apple Team/App ID are available — the URL structure and the app-open listener that maps `/challenge/:id` into the router are built now so only the AASA hosting step remains.
- Preserve the pending Friend Challenge through every sign-in round trip (existing pending-challenge key already survives; the native redirect must land back on the same `/challenge/:id`).

## Phase 3 — Native authentication (no OAuth page inside the WebView)

- **Google**: use an iOS-supported flow — native Google Sign-In (or an external/system authentication session such as `ASWebAuthenticationSession`) — never Google's authorization page inside the Capacitor WKWebView. On completion, pass the tokens back and establish the session in the existing Supabase/lovable auth layer, so the profile remains keyed to the same provider-independent user id.
- **Apple**: implement Sign in with Apple for the iOS release (required by Apple when another social provider is present), using the same provider-independent auth layer. Enable the Apple provider on the backend and add the Apple capability in Xcode.
- Both flows must preserve the pending challenge: `/challenge/:id` → Sign in with Google/Apple → return → same `/challenge/:id`, unchanged.

## Phase 4 — Native bridges

### 1. Timer recovery (no background hacks)
The goal is correct recovery, not keeping JS alive while suspended. The EMOM state is authoritative from a saved workout start time:
- Store `wallStart` (and paused-elapsed) at workout start/resume.
- Prefer a native monotonic clock (e.g. `ProcessInfo.systemUptime` / `mach_absolute_time`) exposed via a tiny bridge, so manual clock changes can't shift the workout; fall back to `Date.now()` on web.
- When the app backgrounds, let iOS suspend normally. On becoming active again, immediately recompute elapsed time, current EMOM round, and seconds within the round from the stored start time — the existing `getElapsed()` contract already supports this, so no workout-logic changes.
- No background modes, no scheduled OS notifications or background cues in this implementation (can be added separately later).

### 2. Keep screen awake during active workouts
Native keep-awake plugin/bridge (`UIApplication.isIdleTimerDisabled = true`) acquired on workout start/resume, released on pause/finish/unmount — matching the existing wake-lock call sites. Web wake lock stays as browser fallback.

### 3. Per-cue EMOM sound with temporary ducking
New native bridge method, e.g.:

```text
playEmomCue(kind: 'minute' | 'countdown' | 'finish') -> Promise<void>
```

Behavior, executed natively per cue:
1. Activate an AVAudioSession configured with `.duckOthers` — briefly lowering other playing audio.
2. Play the Muscle Max EMOM cue natively (the existing heavy-thump cue sound, shipped as a native asset).
3. Wait until the cue finishes.
4. Immediately deactivate the session with `.notifyOthersOnDeactivation` so the user's music returns to normal volume.

Ducking happens only around each short cue — the session is NOT held active for the whole workout. The existing Web Audio engine remains the browser fallback; the timer's cue scheduler calls the native bridge when available, otherwise the web engine. Default is ducking only — no `interruptSpokenAudioAndMixWithOthers` unless testing shows we intentionally want podcasts/spoken audio to pause.

### 4. Native share
Extend `src/lib/share.ts` with a native branch (Capacitor Share plugin), keeping `shareChallenge` / `canNativeShare` signatures unchanged. Shared URLs come from `PUBLIC_APP_URL`.

## Phase 5 — App Store requirements (implementation, not just risks)

- Sign in with Apple alongside Google (Phase 3).
- In-app initiation of permanent account deletion, deleting the user's account and associated data (profiles, sessions, progress, challenges they created, attempts) — implemented before TestFlight/App Store submission.
- Google AdSense script removed from the native iOS build (web keeps it).
- Release Capacitor configuration contains no development `server.url`.
- Email auto-confirm (currently on for testing) turned off before release, with the confirm-email redirect pointing at a native-openable link.

## Phase 6 — Verification and deliverables

Re-run the existing acceptance suite on a real iPhone, plus native checks:
- Timer: background for 3+ minutes mid-workout (including a phone call) → resume shows the mathematically correct round/seconds; screen stays awake while active; cues duck music and restore volume after each cue.
- Auth: Google and Apple sign-in from `/challenge/:id` both return to the same challenge.
- Links: cold-start from a challenge URL opens the app to the challenge page; without the app it opens the web page.
- Account deletion removes the account and data.

Final report will include: files changed, the exact native bridge API created, the exact Mac terminal commands, the exact remaining Xcode configuration, and the real-iPhone acceptance test steps.

## Project-specific risks

- **OAuth redirect is the most likely breakage point** — covered by the native auth phase; without it, Google sign-in fails on device even though everything else works.
- **Shared links must stay web URLs** — if a challenge link ever picks up the native scheme or preview origin, the viral loop breaks; explicit test included.
- **Universal Links need control of the domain root** for the AASA file; until the permanent domain/Team ID exist, links open the web page (functional but weaker).
- **PWA/native duplication**: the installed web app and native app keep separate local caches; cloud is canonical for signed-in users, but signed-out local-only history on the PWA won't appear in the native app until sign-in on both.
- **AdSense in the store binary** risks rejection — must be stripped from the native build.
- **Account deletion scope**: deleting a creator's challenges must be defined (challenges with live attempts are anonymized/deactivated rather than broken for participants).

## Preserved / out of scope

Preserve the existing workout engine, progression logic, Friend Challenges, account system, routing, and UI — no rebuild. Still not built: leaderboards, squads, leagues, notifications, background cue scheduling, Android.
