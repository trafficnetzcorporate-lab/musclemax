# Accounts + Friend Challenges

Adds optional accounts, cloud-saved progress, and a share loop where finishing a workout lets you challenge a friend with your real score. The existing workout experience, timer, and progression rules stay exactly as they are.

## Part 1 — Accounts (optional)

- Sign in with email + password or Google. Sessions stay signed in.
- Nothing is gated: the app keeps working with no account. A small "Sign in" entry appears in the header; signed in, it shows the name and a sign-out option.
- Profile holds: unique id, display name, username (auto-generated from the name, editable), optional avatar, and join date. No setup wizard before training.
- Signing in on any device merges that device's saved progress into the account: every logged workout it has that the account lacks is added, anything already there is matched and left alone, so nothing is lost and nothing is duplicated. Once signed in, the account is the master copy and the same history shows on every device.

## Part 2 — Friend Challenges

Naming: the new person-vs-person feature is a **Friend Challenge**. The existing one-session unlock attempt keeps the plain name "Challenge" and is untouched.

Flow:

```text
finish workout -> summary screen -> "Challenge a Friend"
   -> link created from the real result
   -> friend opens /challenge/{id} and sees who challenged them and the score to beat
   -> Accept -> (sign in if needed, returning to the same challenge)
   -> the exact same workout loads in the existing timer
   -> result screen: WON / LOST / TIED with both scores
   -> Rematch  or  Challenge Someone Else  -> loop continues
```

Details:

- **Create:** a "Challenge a Friend" button on the workout summary. The challenge is built from the finished session — exercise, 10-minute EMOM structure, per-minute targets, total reps — no manual setup. Once posted, the challenge and its score never change, and one link can be taken on by any number of people.
- **Share:** copy link, plus the device share sheet where the browser supports it. Sharing is one small module so native iOS sharing can replace the surface later.
- **Result card:** a clean card in the existing dark/gold style — "MICHAEL JUST HIT A NEW MAX / 10-MINUTE PUSH-UP EMOM / 150 REPS / CAN YOU BEAT IT?" — rendered in-app and copyable as an image, kept modular.
- **Public page:** viewable signed out, showing only challenger display name, exercise, and score. Accepting requires an account; the challenge id is held through sign-in and the user lands straight back on it.
- **Recipient result:** stored as that person's attempt on the challenge, and won/lost/tied is worked out from the two stored scores rather than claimed by the app. Then Rematch (back to the challenger, linked to the previous challenge) and Challenge Someone Else (their own new score becomes a fresh challenge with a new link).
- **History:** a simple Challenges screen with Sent, Received, Pending, Completed.

## Out of scope

No leaderboards, squads, leagues, tournaments, friend graphs, feeds, messaging, or notifications. No browser workarounds for background timing, screen-awake, or audio ducking — those are left for the native iOS pass.

## Technical notes

- Auth: Lovable Cloud email/password + managed Google, written behind a thin provider-agnostic auth layer so Sign in with Apple drops in during the iOS pass. All app data keys off the stable account id — no Google-specific identity fields anywhere.
- Source of truth: signed out, local storage is canonical. Signed in, the cloud database is canonical and local storage is only an offline cache that replays queued writes and then re-reads from the cloud. Two signed-in devices cannot hold divergent authoritative histories.
- Sync/migration: every workout session carries a stable unique id (generated locally, preserved on upload). On each device's first authenticated sync, local history is merged into the account — unique sessions inserted, matching ids skipped via an idempotent upsert on session id. Nothing is discarded because cloud history already exists, and nothing is duplicated. Derived values (XP, level, streak, prescriptions, unlocks) are recomputed from the merged session set so all devices agree.
- Reuse existing tables. `profiles` gains `username`, `avatar_url`; `workout_sessions` gains a stable client-supplied id (unique per user) and a nullable `challenge_id`. New tables:
  - `challenges` — id, creator_user_id, source_session_id, exercise_id, format (`emom_10`), prescription, creator_total_reps, parent_challenge_id (rematch), status, created_at. One challenge is immutable once published and accepts unlimited attempts; prescription and creator score are derived from the referenced completed session, not client-declared, and cannot be updated afterwards.
  - `challenge_attempts` — id, challenge_id, participant_user_id, total_reps, outcome, started_at, completed_at, status. A challenge has zero-to-many attempts (one public link, many participants).
- Outcome integrity: WON/LOST/TIED is computed in the database from the stored creator and participant totals, not sent by the client. Attempt totals are written from the completed session; the UI only displays the derived outcome.
- RLS: owner-scoped writes on sessions, challenges, and attempts; challenges are insert/read-only after creation. A SECURITY DEFINER read function exposes only public challenge fields (challenger display name, exercise, score) to anonymous visitors — never emails or private profile data. GRANTs added for every new table.
- Routing: `/challenge/:id` is a real backend-resolved route (no state dependency), suitable for later Universal Links. Auth redirect uses `window.location.origin` and restores the saved `/challenge/:id` path after the session hydrates.
- Challenge acceptance feeds the existing `EmomTimer` with the challenge's prescription; no second workout engine.
- Verification covers the 10 listed acceptance flows, including a regression pass on a normal workout, progression, and saved data.

