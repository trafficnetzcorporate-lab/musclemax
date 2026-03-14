import { WorkoutPhase, WorkoutSession, WorkoutSet, ExerciseProgress } from '@/types/emom';

const NUM_SETS = 10;
const MAX_REPS_PER_SET = 12;
const MASTERY_TOTAL = MAX_REPS_PER_SET * NUM_SETS; // 120

/**
 * Phase 1 → Phase 2: Take baseline results and distribute evenly
 */
export function evenOutReps(totalReps: number): number[] {
  const base = Math.floor(totalReps / NUM_SETS);
  const remainder = totalReps % NUM_SETS;
  // Front-load the remainder
  return Array.from({ length: NUM_SETS }, (_, i) =>
    Math.min(i < remainder ? base + 1 : base, MAX_REPS_PER_SET)
  );
}

/**
 * Phase 3: Create AMRAP prescription — first 9 sets at standard, set 10 is AMRAP
 */
export function createAmrapPrescription(currentPrescription: number[]): number[] {
  return currentPrescription.map((reps, i) => (i === 9 ? -1 : reps)); // -1 = AMRAP marker
}

/**
 * Phase 4: Front-load surplus from AMRAP set
 * Takes the surplus from the AMRAP (reps above standard) and adds to set 1,
 * then re-distributes everything evenly.
 */
export function frontLoadSurplus(
  standardReps: number, // what the AMRAP set's target was
  amrapReps: number,    // what user actually did on AMRAP
  currentPrescription: number[]
): number[] {
  const surplus = Math.max(0, amrapReps - standardReps);
  if (surplus === 0) return currentPrescription;

  // Total reps = sum of first 9 sets at their prescription + the standard (not AMRAP) for set 10 + surplus
  const totalReps = currentPrescription.slice(0, 9).reduce((a, b) => a + b, 0) + standardReps + surplus;
  
  // Re-distribute evenly
  return evenOutReps(Math.min(totalReps, MASTERY_TOTAL));
}

/**
 * Determine the next phase based on workout results
 */
export function getNextPhase(
  currentPhase: WorkoutPhase,
  prescription: number[]
): WorkoutPhase {
  // Check if mastered (all sets at 12)
  const allMaxed = prescription.every(r => r >= MAX_REPS_PER_SET);
  if (allMaxed) return 'completed';

  switch (currentPhase) {
    case 'baseline':
      return 'evening_out';
    case 'evening_out':
      return 'amrap';
    case 'amrap':
      return 'front_load';
    case 'front_load':
      return 'evening_out'; // Cycle back: even → AMRAP → front load → repeat
    default:
      return 'evening_out';
  }
}

/**
 * Process a completed workout and return the next prescription + phase
 */
export function processWorkout(
  session: WorkoutSession,
  currentProgress: ExerciseProgress
): { nextPrescription: number[]; nextPhase: WorkoutPhase } {
  const { phase, sets } = session;
  const totalReps = sets.reduce((sum, s) => sum + (s.actualReps || 0), 0);

  let nextPrescription: number[];

  switch (phase) {
    case 'baseline': {
      // Even out the baseline results
      nextPrescription = evenOutReps(totalReps);
      break;
    }
    case 'evening_out': {
      // Keep same prescription but mark for AMRAP next
      nextPrescription = currentProgress.currentPrescription;
      break;
    }
    case 'amrap': {
      // Front load the surplus from set 10
      const set10 = sets[9];
      const standardReps = currentProgress.currentPrescription[9] || currentProgress.currentPrescription[0];
      nextPrescription = frontLoadSurplus(
        standardReps,
        set10.actualReps || 0,
        currentProgress.currentPrescription
      );
      break;
    }
    case 'front_load': {
      // After front-loading, we go back to evening out
      nextPrescription = evenOutReps(totalReps);
      break;
    }
    default:
      nextPrescription = currentProgress.currentPrescription;
  }

  const nextPhase = getNextPhase(phase, nextPrescription);
  return { nextPrescription, nextPhase };
}

/**
 * Calculate XP earned from a workout
 */
export function calculateWorkoutXp(session: WorkoutSession, isMastery: boolean): number {
  let xp = 50; // base
  
  // AMRAP bonus
  if (session.phase === 'amrap') {
    const set10 = session.sets[9];
    if (set10.actualReps && set10.actualReps > 12) {
      xp += (set10.actualReps - 12) * 5;
    }
  }

  // Mastery bonus
  if (isMastery) xp += 500;

  return xp;
}

/**
 * Get the prescription for the first workout (baseline)
 */
export function getBaselinePrescription(): number[] {
  // For baseline, each set is \"go to failure, max 12\"
  return Array(NUM_SETS).fill(12);
}

/**
 * Build WorkoutSets from a prescription for a given phase
 */
export function buildWorkoutSets(prescription: number[], phase: WorkoutPhase): WorkoutSet[] {
  return prescription.map((targetReps, i) => ({
    setNumber: i + 1,
    targetReps: phase === 'baseline' ? 12 : (targetReps === -1 ? 999 : targetReps),
    actualReps: null,
    isAmrap: phase === 'amrap' && i === 9,
  }));
}
