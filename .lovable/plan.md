# Accounts + Friend Challenges

Adds optional accounts, cloud-saved progress, and a share loop where finishing a workout lets you challenge a friend with your real score. The existing workout experience, timer, and progression rules stay exactly as they are.

## Part 1 — Accounts (optional)

- Sign in with email + password or Google. Sessions stay signed in.
- Nothing is gated: the app keeps working with no account. A small "Sign in" entry appears in the header; signed in, it shows the name and a sign-out option.
- Profile holds: unique id, display name, username (auto-generated from the name, editable), optional avatar, and join date. No setup wizard before training.
- First sign-in migrates whatever progress is already saved on the device into the account: levels, XP, streak, unlocked exercises, and every logged session. Migration runs once per device and is skipped if the account already holds history, so nothing is duplicated.

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

- **Create:** a "Challenge a Friend" button on the workout summary. The challenge is built from the finished session — exercise, 10-minute EMOM structure, per-minute targets, total reps — no manual setup.
- **Share:** copy link, plus the device share sheet where the browser supports it. Sharing is one small module so native iOS sharing can replace the surface later.
- **Result card:** a clean card in the existing dark/gold style — "MICHAEL JUST HIT A NEW MAX / 10-MINUTE PUSH-UP EMOM / 150 REPS / CAN YOU BEAT IT?" — rendered in-app and copyable as an image, kept modular.
- **Public page:** viewable signed out, showing only challenger display name, exercise, and score. Accepting requires an account; the challenge id is held through sign-in and the user lands straight back on it.
- **Recipient result:** stored as an attempt, compared to the challenger, with Rematch (back to the challenger, referencing the previous challenge) and Challenge Someone Else (their own new score becomes a fresh challenge with a new link).
- **History:** a simple Challenges screen with Sent, Received, Pending, Completed.

## Out of scope

No leaderboards, squads, leagues, tournaments, friend graphs, feeds, messaging, or notifications. No browser workarounds for background timing, screen-awake, or audio ducking — those are left for the native iOS pass.

## Technical notes

- Auth: Lovable Cloud email/password + managed Google. Optional session; existing localStorage store stays the offline source of truth and syncs upward when signed in, so no route becomes auth-gated.
- Reuse existing tables. `profiles` gains `username`, `avatar_url`; `workout_sessions` gains a nullable `challenge_id`. New tables:
  - `challenges` — id, creator_user_id, source_session_id, exercise_id, format (`emom_10`), prescription, creator_total_reps, parent_challenge_id (rematch), status, created_at.
  - `challenge_attempts` — id, challenge_id, participant_user_id, total_reps, outcome, started_at, completed_at, status.
- RLS: owner-scoped writes on attempts and challenges; a SECURITY DEFINER read function exposes only the public challenge fields (challenger display name, exercise, score) to anonymous visitors — never emails or private profile data. GRANTs added for every new table.
- Routing: `/challenge/:id` is a real backend-resolved route (no state dependency), suitable for later Universal Links. Auth redirect uses `window.location.origin` and restores the saved `/challenge/:id` path after the session hydrates.
- Challenge acceptance feeds the existing `EmomTimer` with the challenge's prescription; no second workout engine.
- Verification covers the 10 listed acceptance flows, including a regression pass on a normal workout, progression, and saved data.
