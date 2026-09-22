import assert from 'node:assert/strict';
import test from 'node:test';
import { observedEmomRate, projectEmomRate, sessionGoalTotal } from '../../src/lib/emom-rate';
import { buildWorkoutSets, calculateWorkoutXp, evenOutReps, getBaselinePrescription, processWorkout } from '../../src/lib/emom-algorithm';
import type { ExerciseProgress, ExerciseVariation, WorkoutSession } from '../../src/types/emom';

const plan = { currentTotal: 120, targetPerSet: 30, gainPerSession: 1, sessionsPerWeek: 6 };
const session = (total: number, index = 0, exerciseId: ExerciseVariation = 'regular_pushup'): WorkoutSession => ({
  id: `${exerciseId}-${index}`, date: new Date(Date.UTC(2026, 8, 1 + index)).toISOString(), exerciseId,
  phase: 'standard', totalReps: total,
  sets: evenOutReps(total).map((reps, i) => ({ setNumber: i + 1, actualReps: reps, targetReps: reps, isAmrap: i === 9 })),
});

test('120 → 300 at +1 total rep and six sessions/week is 180 sessions, 30 weeks', () => {
  assert.deepEqual(projectEmomRate(plan), { status: 'projected', remainingReps: 180, targetTotal: 300, sessions: 180, weeks: 30, calendarDays: 210 });
});
test('different gains change the projection without multiplying the gain by ten', () => {
  for (const [gain, sessions, days] of [[2, 90, 105], [3, 60, 70], [4, 45, 53]]) {
    const result = projectEmomRate({ ...plan, gainPerSession: gain });
    assert.equal(result.status, 'projected');
    if (result.status === 'projected') { assert.equal(result.sessions, sessions); assert.equal(result.calendarDays, days); }
  }
});
test('fractional average gains and weekly frequency are supported', () => {
  const result = projectEmomRate({ ...plan, gainPerSession: 0.5, sessionsPerWeek: 3.5 });
  assert.equal(result.status, 'projected');
  if (result.status === 'projected') { assert.equal(result.sessions, 360); assert.equal(result.calendarDays, 720); }
});
test('a partial final session rounds up', () => {
  const result = projectEmomRate({ ...plan, currentTotal: 299, gainPerSession: 4 });
  assert.equal(result.status, 'projected');
  if (result.status === 'projected') assert.equal(result.sessions, 1);
});
test('zero and declining gains never produce an arrival date', () => {
  for (const gainPerSession of [0, -1, -0.25]) assert.equal(projectEmomRate({ ...plan, gainPerSession }).status, 'no-growth');
});
test('already-reached goals require zero future sessions', () => {
  const result = projectEmomRate({ ...plan, currentTotal: 300, gainPerSession: 0 });
  assert.equal(result.status, 'reached');
  if (result.status === 'reached') assert.equal(result.sessions, 0);
});
test('invalid totals, targets, frequencies, and non-finite gains are rejected', () => {
  const overrides = [{ currentTotal: -1 }, { currentTotal: 301 }, { currentTotal: 1.2 }, { currentTotal: NaN },
    { targetPerSet: 0 }, { targetPerSet: 31 }, { targetPerSet: 12.5 }, { sessionsPerWeek: 0 },
    { sessionsPerWeek: 8 }, { sessionsPerWeek: NaN }, { gainPerSession: Infinity }, { gainPerSession: NaN }];
  overrides.forEach(value => assert.equal(projectEmomRate({ ...plan, ...value }).status, 'invalid'));
});
test('a lower per-set goal has its own target total', () => {
  const result = projectEmomRate({ ...plan, currentTotal: 100, targetPerSet: 15, gainPerSession: 5 });
  assert.equal(result.status, 'projected');
  if (result.status === 'projected') { assert.equal(result.targetTotal, 150); assert.equal(result.sessions, 10); }
});
test('observed gain includes stalls and losses, rather than only successful sessions', () => {
  const history = [100, 104, 104, 102, 108].map((total, index) => session(total, index));
  const result = observedEmomRate(history, 'regular_pushup');
  assert.equal(result.averageGain, 2);
  assert.equal(result.comparisonCount, 4);
  assert.equal(result.improvementPercent, 50);
  assert.equal(result.latestTotal, 108);
});
test('observed rate uses only the selected exercise and complete valid sessions', () => {
  const incomplete = session(140, 3); incomplete.sets[0].actualReps = null;
  const invalidDate = { ...session(180, 4), date: 'invalid' };
  const result = observedEmomRate([session(100), session(102, 1), session(250, 2, 'chin_up'), incomplete, invalidDate], 'regular_pushup');
  assert.equal(result.sessionCount, 2); assert.equal(result.averageGain, 2);
});
test('one session has a starting total but no invented historical rate', () => {
  const result = observedEmomRate([session(100)], 'regular_pushup');
  assert.equal(result.latestTotal, 100); assert.equal(result.averageGain, null); assert.equal(result.improvementPercent, null);
});
test('observed rate sorts, deduplicates, uses the last ten and never mutates history', () => {
  const history = Array.from({ length: 12 }, (_, i) => session(100 + i, i)).reverse();
  history.push(history[0]); const before = JSON.stringify(history);
  const result = observedEmomRate(history, 'regular_pushup');
  assert.equal(result.sessionCount, 10); assert.equal(result.comparisonCount, 9); assert.equal(result.averageGain, 1);
  assert.equal(JSON.stringify(history), before);
});
test('reps beyond a single-set cap do not make up for an unfinished set in goal totals', () => {
  const s = session(300); s.sets[0].actualReps = 40; s.sets[1].actualReps = 20;
  assert.equal(sessionGoalTotal(s), 290);
});
test('baseline allows 30 and distribution continues beyond 120', () => {
  assert.deepEqual(getBaselinePrescription(), Array(10).fill(30));
  assert.deepEqual(evenOutReps(121), [13,12,12,12,12,12,12,12,12,12]);
  assert.deepEqual(evenOutReps(299), [30,30,30,30,30,30,30,30,30,29]);
  assert.deepEqual(evenOutReps(301), Array(10).fill(30));
});
test('all push/pull phases share the new cap and completed exercises retain AMRAP', () => {
  for (const phase of ['baseline', 'standard', 'completed'] as const) {
    const sets = buildWorkoutSets(Array(10).fill(31), phase);
    assert.ok(sets.every(s => s.targetReps === 30));
    assert.equal(sets[9].isAmrap, phase !== 'baseline');
  }
});
test('earned 12×10 milestone stays compatible while prescriptions can grow to 30×10', () => {
  const placeholder = {} as ExerciseProgress;
  assert.equal(processWorkout(session(119), placeholder).nextPhase, 'standard');
  assert.equal(processWorkout(session(120), placeholder).nextPhase, 'completed');
  assert.deepEqual(processWorkout(session(300), placeholder).nextPrescription, Array(10).fill(30));
});
test('existing AMRAP XP calculation remains separate from the new logging limit', () => {
  const s = session(120); s.sets[9].actualReps = 20;
  assert.equal(calculateWorkoutXp(s, false), 90);
  assert.equal(calculateWorkoutXp(s, true), 590);
});
