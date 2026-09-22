# 30-rep logging and progress rate

All push and pull workouts accept 0–30 reps per set. Baseline targets use 30,
and the next prescription can distribute up to 300 reps across ten sets.
The existing 12×10 milestone, unlocks, and AMRAP XP threshold are retained.
An earned milestone no longer removes the Start Workout action, and its
500 XP award is not granted again when continuing to train.

The **Rate** link on the dashboard opens the calculator. An exercise detail
also links directly to its own projection. Calculations do not change workout
history, training prescriptions, or account data.

## Planning calculation

- Starting point: the current total across ten sets, editable and optionally
  populated from the latest complete workout of the selected exercise.
- Goal: target reps per set × 10 (default 30 × 10 = 300).
- Rate: average gain in **total** reps per completed workout, not gain per set.
- Frequency: sessions per week for that exercise, default 6.
- Sessions remaining: `ceil(max(0, goal - current total) / average gain)`.
- Weeks: remaining sessions / sessions per week.
- Approximate calendar days: weeks × 7, rounded up. Exact dates depend on the
  actual training/rest-day schedule, so no exact completion date is promised.

At a starting total of 120, a goal of 300, and six sessions per week:

| Average gain per session | More sessions | Approximate calendar days |
| --- | ---: | ---: |
| +1 total rep | 180 | 210 |
| +2 total reps | 90 | 105 |
| +3 total reps | 60 | 70 |
| +4 total reps | 45 | 53 |

Other positive rates, including fractions, can be entered. Zero/negative rates
show no arrival estimate. Missing or invalid inputs are explained instead of
silently treated as zero. A total-based estimate does not prove an even set
breakdown; each set still needs to meet the target.

## Observed rate

Only complete, dated sessions of the selected exercise are used. Sessions are
deduplicated by ID, sorted, and limited to the most recent ten. For N sessions,
the observed rate is `(last total - first total) / (N - 1)`. Stalls and losses
remain in the calculation. The percentage of comparisons with an increased
total describes past sessions; it is not a future success probability.

Recorded reps beyond 30 in a single historical set contribute only 30 toward
this goal; historical records themselves are never rewritten. The planned
gain and observed gain are separate, with an explicit Use observed rate button.

Sleep/protein habits are not assigned invented numerical growth multipliers.
The projection is a constant-rate scenario that can be revised using logged
performance. Sixty unbroken push-ups in two minutes is a separate performance
goal from an EMOM session that allows rest within each minute.

## Checks

`npm run test:emom` checks the projection, historical-rate calculations, bounds,
rep distribution, retained milestone, and existing AMRAP XP math.

`npm run test:layout` includes the calculator's empty, planned, stalled,
goal-reached, and recorded-history states at five widths and doubled text size.
Setup is described in `docs/mobile-layout-quality.md`.

The optional `tests/emom-rate/browser.cjs` regression uses isolated browser
contexts, invented local history, and blocked external requests to verify
logging 30 across ten sets in both push and pull exercises, persisting the
300-rep session, preserving prior milestones, and avoiding duplicate rewards.
Run it against a local Vite server with Playwright supplied through `NODE_PATH`:

```sh
NODE_PATH="$PWD/tests/mobile-layout/node_modules" LAYOUT_BASE_URL=http://127.0.0.1:4175 node tests/emom-rate/browser.cjs
```

This source update still needs a bundled iOS build/sync and device installation
before it appears in an already-installed app. No database migration or native
plugin change is required.
