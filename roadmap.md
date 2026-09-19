# Roadmap — Accounts + Friend Challenges

## Backend
- [ ] Schema: profiles (username, avatar_url), workout_sessions stable client id + challenge_id
- [ ] challenges table (immutable after publish) + GRANTs + RLS
- [ ] challenge_attempts table (many per challenge) + GRANTs + RLS
- [ ] SECURITY DEFINER: public challenge view fn, create_challenge_from_session, submit_attempt (derives outcome)
- [ ] Enable email auth + Google social auth
- [ ] Regenerate types

## Auth (optional accounts)
- [ ] Provider-agnostic auth context (email/password + Google, Apple-ready)
- [ ] /auth page with redirect-back context (challenge id preserved)
- [ ] Header sign-in / sign-out entry

## Sync
- [ ] Stable session ids in local store
- [ ] Merge/dedupe local -> cloud on first authenticated sync per device
- [ ] Cloud canonical when signed in; local cache otherwise

## Friend Challenges
- [ ] Challenge a Friend on workout summary
- [ ] /challenge/:id public page (signed-out viewable)
- [ ] Accept -> existing EmomTimer with challenge prescription
- [ ] Result screen WON/LOST/TIED (derived) + Rematch + Challenge Someone Else
- [ ] Share module (copy link + web share)
- [ ] Result card component
- [ ] Challenge history screen (sent/received/pending/completed)

## Verification
- [ ] Acceptance tests 1-10 incl. regression on existing workout flow
