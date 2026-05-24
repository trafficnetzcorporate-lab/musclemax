import { WorkoutPhase, WorkoutSession, WorkoutSet, ExerciseProgress } from '@/types/emom';

const NUM_SETS = 10;
const MAX_REPS_PER_SET = 12;
const MASTERY_TOTAL = MAX_REPS_PER_SET * NUM_SETS; // 120

/**
 * Distribute total reps evenly across 10 sets, front-loading the remainder.
 * Each set is capped at 12.
 */
export function evenOutReps(totalReps: number): number[] {
  const capped = Math.min(totalReps, MASTERY_TOTAL);
  const base = Math.floor(capped / NUM_SETS);
  const remainder = capped % NUM_SETS;
  return Array.from({ length: NUM_SETS }, (_, i) =>
    Math.min(i < remainder ? base + 1 : base, MAX_REPS_PER_SET)
  );
}

/**
 * Process a completed workout and return the next prescription + phase.
 *
 * Flow:
 * - baseline (first ever workout): go to failure each set → even out totals → standard
 * - standard: sets 1-9 prescribed, set 10 is AMRAP. Sum ALL 10 sets (incl. AMRAP),
 *   even them out, that's the new prescription. Last set is always AMRAP again next time.
 *   When the evened-out prescription is all 12s → completed (mastery).
 */
export function processWorkout(
  session: WorkoutSession,
  _currentProgress: ExerciseProgress
): { nextPrescription: number[]; nextPhase: WorkoutPhase } {
  const totalReps = session.sets.reduce((sum, s) => sum + (s.actualReps || 0), 0);
  const nextPrescription = evenOutReps(totalReps);
  const allMaxed = nextPrescription.every(r => r >= MAX_REPS_PER_SET);
  const nextPhase: WorkoutPhase = allMaxed ? 'completed' : 'standard';
  return { nextPrescription, nextPhase };
}

/**
 * Calculate XP earned from a workout
 */
export function calculateWorkoutXp(session: WorkoutSession, isMastery: boolean): number {
  let xp = 50; // base
  // AMRAP bonus on set 10 (every standard session has one)
  const set10 = session.sets[9];
  if (set10?.isAmrap && set10.actualReps && set10.actualReps > 12) {
    xp += (set10.actualReps - 12) * 5;
  }
  if (isMastery) xp += 500;
  return xp;
}

/**
 * Get the prescription for the first workout (baseline)
 */
export function getBaselinePrescription(): number[] {
  return Array(NUM_SETS).fill(12);
}

/**
 * Build WorkoutSets from a prescription for a given phase.
 * Baseline: every set is "to failure, max 12".
 * Standard: sets 1-9 use prescription; set 10 is AMRAP (no cap).
 */
export function buildWorkoutSets(prescription: number[], phase: WorkoutPhase): WorkoutSet[] {
  return prescription.map((targetReps, i) => {
    const isAmrap = phase === 'standard' && i === 9;
    return {
      setNumber: i + 1,
      targetReps: phase === 'baseline' ? 12 : (isAmrap ? 999 : targetReps),
      actualReps: null,
      isAmrap,
    };
  });
}
