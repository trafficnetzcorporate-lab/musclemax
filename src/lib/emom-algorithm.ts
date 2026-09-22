import { WorkoutPhase, WorkoutSession, WorkoutSet, ExerciseProgress } from '@/types/emom';

import { NUM_SETS, MAX_REPS_PER_SET, TARGET_TOTAL_REPS, MILESTONE_REPS_PER_SET } from './emom-limits';

/**
 * Distribute total reps evenly across 10 sets, front-loading the remainder.
 * Each set is capped at 30. The earned 12×10 milestone remains separate.
 */
export function evenOutReps(totalReps: number): number[] {
  const capped = Math.min(Math.max(0, Math.floor(Number.isFinite(totalReps) ? totalReps : 0)), TARGET_TOTAL_REPS);
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
 *   At 12 per set the existing milestone is earned. Training continues up to 30.
 */
export function processWorkout(
  session: WorkoutSession,
  _currentProgress: ExerciseProgress
): { nextPrescription: number[]; nextPhase: WorkoutPhase } {
  const totalReps = session.sets.reduce((sum, s) => sum + (s.actualReps || 0), 0);
  const nextPrescription = evenOutReps(totalReps);
  const milestoneReached = nextPrescription.every(r => r >= MILESTONE_REPS_PER_SET);
  const nextPhase: WorkoutPhase = milestoneReached ? 'completed' : 'standard';
  return { nextPrescription, nextPhase };
}

/**
 * Calculate XP earned from a workout
 */
export function calculateWorkoutXp(session: WorkoutSession, isMastery: boolean): number {
  let xp = 50; // base
  // AMRAP bonus on set 10 (every standard session has one)
  const set10 = session.sets[9];
  if (set10?.isAmrap && set10.actualReps && set10.actualReps > MILESTONE_REPS_PER_SET) {
    xp += (set10.actualReps - MILESTONE_REPS_PER_SET) * 5;
  }
  if (isMastery) xp += 500;
  return xp;
}

/**
 * Get the prescription for the first workout (baseline)
 */
export function getBaselinePrescription(): number[] {
  return Array(NUM_SETS).fill(MAX_REPS_PER_SET);
}

/**
 * Build WorkoutSets from a prescription for a given phase.
 * Baseline: every set has a 30-rep logging limit.
 * Standard / earned milestone: sets 1-9 use prescription; set 10 is AMRAP up to 30.
 */
export function buildWorkoutSets(prescription: number[], phase: WorkoutPhase): WorkoutSet[] {
  return prescription.map((targetReps, i) => {
    const isAmrap = phase !== 'baseline' && i === NUM_SETS - 1;
    return {
      setNumber: i + 1,
      targetReps: phase === 'baseline' || isAmrap ? MAX_REPS_PER_SET : Math.max(0, Math.min(MAX_REPS_PER_SET, targetReps)),
      actualReps: null,
      isAmrap,
    };
  });
}
