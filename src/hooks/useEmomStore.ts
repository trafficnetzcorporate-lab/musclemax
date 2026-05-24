import { useState, useCallback, useEffect } from 'react';
import { UserProfile, ExerciseProgress, WorkoutSession, ExerciseVariation, WorkoutPhase, XP_REWARDS, LEVEL_THRESHOLDS } from '@/types/emom';
import { getDefaultUnlocked } from '@/lib/exercises';
import { processWorkout, calculateWorkoutXp, getBaselinePrescription } from '@/lib/emom-algorithm';

const STORAGE_KEY = 'emom_profile';

function getLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

function createDefaultProfile(): UserProfile {
  const defaults = getDefaultUnlocked();
  const progress: Record<string, ExerciseProgress> = {};
  
  for (const id of defaults) {
    progress[id] = {
      exerciseId: id as ExerciseVariation,
      currentPhase: 'baseline',
      currentPrescription: getBaselinePrescription(),
      totalWorkouts: 0,
      bestTotalReps: 0,
      history: [],
      mastered: false,
      xp: 0,
    };
  }

  return {
    name: 'Athlete',
    level: 1,
    totalXp: 0,
    streak: 0,
    exerciseProgress: progress,
    unlockedExercises: defaults as ExerciseVariation[],
  };
}

function migratePhase(p: string): 'baseline' | 'standard' | 'completed' {
  if (p === 'baseline' || p === 'standard' || p === 'completed') return p;
  // Old phases (evening_out, amrap, front_load) all collapse to standard
  return 'standard';
}

function loadProfile(): UserProfile {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as UserProfile;
      // Migrate legacy phase names
      for (const key of Object.keys(parsed.exerciseProgress || {})) {
        const ep = parsed.exerciseProgress[key];
        ep.currentPhase = migratePhase(ep.currentPhase as unknown as string);
      }
      return parsed;
    }
  } catch {}
  return createDefaultProfile();
}

export function useEmomStore() {
  const [profile, setProfile] = useState<UserProfile>(loadProfile);
  const [loaded, setLoaded] = useState(true);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  const getExerciseProgress = useCallback((exerciseId: string): ExerciseProgress | null => {
    return profile.exerciseProgress[exerciseId] || null;
  }, [profile]);

  const completeWorkout = useCallback((session: WorkoutSession) => {
    setProfile(prev => {
      const progress = prev.exerciseProgress[session.exerciseId];
      if (!progress) return prev;

      const { nextPrescription, nextPhase } = processWorkout(session, progress);
      const isMastery = nextPhase === 'completed';
      const xpEarned = calculateWorkoutXp(session, isMastery);
      const totalReps = session.sets.reduce((s, set) => s + (set.actualReps || 0), 0);

      const updatedProgress: ExerciseProgress = {
        ...progress,
        currentPhase: nextPhase,
        currentPrescription: nextPrescription,
        totalWorkouts: progress.totalWorkouts + 1,
        bestTotalReps: Math.max(progress.bestTotalReps, totalReps),
        history: [...progress.history, session],
        mastered: isMastery || progress.mastered,
        masteredDate: isMastery ? new Date().toISOString() : progress.masteredDate,
        xp: progress.xp + xpEarned,
      };

      const today = new Date().toDateString();
      const lastWorkout = prev.lastWorkoutDate ? new Date(prev.lastWorkoutDate).toDateString() : null;
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      let newStreak = prev.streak;
      if (lastWorkout === yesterday) {
        newStreak += 1;
      } else if (lastWorkout !== today) {
        newStreak = 1;
      }

      const newTotalXp = prev.totalXp + xpEarned;
      const newLevel = getLevel(newTotalXp);

      return {
        ...prev,
        totalXp: newTotalXp,
        level: newLevel,
        streak: newStreak,
        lastWorkoutDate: new Date().toISOString(),
        exerciseProgress: {
          ...prev.exerciseProgress,
          [session.exerciseId]: updatedProgress,
        },
      };
    });
  }, []);

  const unlockExercise = useCallback((exerciseId: ExerciseVariation) => {
    setProfile(prev => {
      if (prev.unlockedExercises.includes(exerciseId)) return prev;

      return {
        ...prev,
        unlockedExercises: [...prev.unlockedExercises, exerciseId],
        exerciseProgress: {
          ...prev.exerciseProgress,
          [exerciseId]: {
            exerciseId,
            currentPhase: 'baseline' as WorkoutPhase,
            currentPrescription: getBaselinePrescription(),
            totalWorkouts: 0,
            bestTotalReps: 0,
            history: [],
            mastered: false,
            xp: 0,
          },
        },
      };
    });
  }, []);

  const resetProfile = useCallback(() => {
    setProfile(createDefaultProfile());
  }, []);

  return {
    profile,
    loaded,
    getExerciseProgress,
    startExercise: useCallback(() => {}, []),
    completeWorkout,
    unlockExercise,
    resetProfile,
  };
}
