// Exercise variations and progression system

export type PushVariation =
  | 'regular_pushup'
  | 'diamond_pushup'
  | 'wide_pushup'
  | 'decline_pushup'
  | 'pike_pushup'
  | 'archer_pushup'
  | 'pseudo_planche_pushup'
  | 'wall_handstand_pushup'
  | 'stomach_wall_handstand_pushup'
  | 'freestanding_handstand_pushup'
  | 'planche_pushup';

export type PullVariation =
  | 'chin_up'
  | 'neutral_grip_pullup'
  | 'regular_pullup'
  | 'wide_grip_pullup'
  | 'archer_pullup'
  | 'typewriter_pullup'
  | 'muscle_up'
  | 'front_lever_raise'
  | 'front_lever_pullup';

export type ExerciseVariation = PushVariation | PullVariation;
export type ExerciseCategory = 'push' | 'pull';

export interface ExerciseInfo {
  id: ExerciseVariation;
  name: string;
  category: ExerciseCategory;
  tier: number; // 1-5 difficulty tier
  description: string;
  prerequisiteId?: ExerciseVariation;
  requiredRepsToUnlock: number; // must hit 12x10 on prerequisite
  icon: string; // emoji
}

export type WorkoutPhase =
  | 'baseline'      // Phase 1: Go to failure each set, find capacity
  | 'evening_out'   // Phase 2: Distribute reps evenly
  | 'amrap'         // Phase 3: Sets 1-9 at standard, set 10 AMRAP
  | 'front_load'    // Phase 4: Add surplus to front, re-distribute
  | 'completed';    // Hit 12x10 — mastered

export interface WorkoutSet {
  setNumber: number; // 1-10
  targetReps: number;
  actualReps: number | null;
  isAmrap: boolean;
}

export interface WorkoutSession {
  id: string;
  date: string; // ISO
  exerciseId: ExerciseVariation;
  phase: WorkoutPhase;
  sets: WorkoutSet[];
  totalReps: number;
  notes?: string;
}

export interface ExerciseProgress {
  exerciseId: ExerciseVariation;
  currentPhase: WorkoutPhase;
  currentPrescription: number[]; // 10 numbers, the target reps for next workout
  totalWorkouts: number;
  bestTotalReps: number;
  history: WorkoutSession[];
  mastered: boolean;
  masteredDate?: string;
  xp: number;
}

export interface UserProfile {
  name: string;
  level: number;
  totalXp: number;
  streak: number;
  lastWorkoutDate?: string;
  exerciseProgress: Record<string, ExerciseProgress>;
  unlockedExercises: ExerciseVariation[];
}

// XP rewards
export const XP_REWARDS = {
  COMPLETE_WORKOUT: 50,
  AMRAP_BONUS_PER_REP: 5,
  MASTER_EXERCISE: 500,
  STREAK_BONUS: 25,
  FIRST_WORKOUT: 100,
} as const;

export const LEVEL_THRESHOLDS = [
  0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5200,
  6500, 8000, 10000, 12500, 15000, 18000, 21500, 25500, 30000, 35000,
] as const;
