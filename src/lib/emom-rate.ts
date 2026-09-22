import type { WorkoutSession } from '@/types/emom';
import { MAX_REPS_PER_SET, NUM_SETS } from './emom-limits';

export interface RateInputs {
  currentTotal: number;
  targetPerSet: number;
  gainPerSession: number;
  sessionsPerWeek: number;
}

export type RateProjection =
  | { status: 'invalid'; message: string }
  | { status: 'no-growth'; remainingReps: number; targetTotal: number }
  | {
      status: 'projected' | 'reached';
      remainingReps: number;
      targetTotal: number;
      sessions: number;
      weeks: number;
      calendarDays: number;
    };

/** A linear planning scenario. Gain is TOTAL extra reps per completed session. */
export function projectEmomRate(input: RateInputs): RateProjection {
  const { currentTotal, targetPerSet, gainPerSession, sessionsPerWeek } = input;
  if (!Number.isInteger(currentTotal) || currentTotal < 0 || currentTotal > NUM_SETS * MAX_REPS_PER_SET) {
    return { status: 'invalid', message: `Enter a current total from 0 to ${NUM_SETS * MAX_REPS_PER_SET}.` };
  }
  if (!Number.isInteger(targetPerSet) || targetPerSet < 1 || targetPerSet > MAX_REPS_PER_SET) {
    return { status: 'invalid', message: `Enter a target from 1 to ${MAX_REPS_PER_SET} reps per set.` };
  }
  if (!Number.isFinite(sessionsPerWeek) || sessionsPerWeek < 1 || sessionsPerWeek > 7) {
    return { status: 'invalid', message: 'Enter a training frequency from 1 to 7 sessions per week.' };
  }
  if (!Number.isFinite(gainPerSession)) {
    return { status: 'invalid', message: 'Enter your average gain in total reps per session.' };
  }
  const targetTotal = targetPerSet * NUM_SETS;
  const remainingReps = Math.max(0, targetTotal - currentTotal);
  if (remainingReps === 0) {
    return { status: 'reached', remainingReps, targetTotal, sessions: 0, weeks: 0, calendarDays: 0 };
  }
  if (gainPerSession <= 0) return { status: 'no-growth', remainingReps, targetTotal };
  // Small epsilon prevents floating-point noise from inventing an extra session.
  const sessions = Math.ceil(remainingReps / gainPerSession - 1e-10);
  const weeks = sessions / sessionsPerWeek;
  const calendarDays = Math.ceil(weeks * 7 - 1e-10);
  if (![sessions, weeks, calendarDays].every(Number.isFinite)) {
    return { status: 'invalid', message: 'That gain is too small to produce a usable estimate.' };
  }
  return { status: 'projected', remainingReps, targetTotal, sessions, weeks, calendarDays };
}

function validSession(session: WorkoutSession): boolean {
  return Number.isFinite(Date.parse(session.date)) && session.sets.length === NUM_SETS &&
    session.sets.every(set => Number.isInteger(set.actualReps) && set.actualReps !== null && set.actualReps >= 0);
}

/** Count only reps within the new per-set goal; never modify historical records. */
export function sessionGoalTotal(session: WorkoutSession): number {
  return session.sets.reduce((total, set) => total + Math.min(MAX_REPS_PER_SET, Math.max(0, set.actualReps ?? 0)), 0);
}

/** Recent completed sessions of ONE exercise; stalls and losses stay in the rate. */
export function observedEmomRate(history: WorkoutSession[], exerciseId: string) {
  const unique = new Map(history.filter(session => session.exerciseId === exerciseId && validSession(session))
    .map(session => [session.id, session]));
  const sessions = [...unique.values()].sort((a, b) => Date.parse(a.date) - Date.parse(b.date)).slice(-10);
  const latest = sessions[sessions.length - 1];
  const comparisons = Math.max(0, sessions.length - 1);
  const totals = sessions.map(sessionGoalTotal);
  const improved = totals.slice(1).filter((total, index) => total > totals[index]).length;
  return {
    sessionCount: sessions.length,
    comparisonCount: comparisons,
    latestTotal: latest ? sessionGoalTotal(latest) : null,
    latestDate: latest?.date ?? null,
    averageGain: comparisons ? (totals[totals.length - 1] - totals[0]) / comparisons : null,
    improvedSessions: improved,
    improvementPercent: comparisons ? improved / comparisons * 100 : null,
  };
}
