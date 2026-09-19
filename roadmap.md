# Roadmap — Accounts + Friend Challenges + native iOS conversion

## Backend / auth / challenges (accounts loop)
- [x] Schema: profiles, workout_sessions stable ids, challenges + attempts, RLS, SECURITY DEFINER functions
- [x] Email auth + Google social auth enabled; Apple provider enabled (for iOS)
- [x] All acceptance tests 1-10 passed (workout, sync, challenge loop, security, persistence)

## Native iOS conversion (Capacitor)
- [x] Capacitor shell: @capacitor/core/cli/ios + App/Browser/Share plugins; appId com.jms.musclemax; webDir dist
- [x] PUBLIC_APP_URL platform helper; share links always use it
- [x] Native bridges: monotonicNow / setKeepAwake / playEmomCue (per-cue AVAudioSession ducking)
- [x] EmomTimer: monotonic offset clock, native keep-awake, native cue player; web fallbacks intact
- [x] Native auth path: system-browser OAuth + custom-scheme return; pending challenge preserved
- [x] appUrlOpen listener: Universal Links + auth callback routing
- [x] AdSense stripped from native build (dynamic web-only injection)
- [x] AASA file placeholder (public/.well-known/apple-app-site-association)
- [x] Account deletion: migration + delete-account edge function + dashboard UI
- [x] Type check clean, build OK, web smoke test passes (no console errors)

## Before App Store submission (needs Mac / Apple account / permanent domain)
- [ ] Xcode: Sign in with Apple capability, Associated Domains entitlement, URL Types "musclemax" scheme
- [ ] Remove dev server.url from capacitor.config.ts for release
- [ ] Host AASA at the permanent domain root (replace TEAMID placeholder)
- [ ] Turn off email auto-confirm; confirm-email redirect → native-openable link
- [ ] Allowlist com.jms.musclemax://auth-callback in auth redirect URLs if Supabase requires
- [ ] Real-iPhone acceptance tests (timer recovery, keep-awake, cue ducking, Google/Apple sign-in, Universal Links, deletion)
