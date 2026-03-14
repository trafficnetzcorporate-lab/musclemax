import { useState, useCallback, useEffect } from 'react';
import { UserProfile, ExerciseProgress, WorkoutSession, ExerciseVariation, WorkoutPhase, XP_REWARDS, LEVEL_THRESHOLDS } from '@/types/emom';
import { getDefaultUnlocked } from '@/lib/exercises';
import { processWorkout, calculateWorkoutXp, getBaselinePrescription } from '@/lib/emom-algorithm';

const STORAGE_KEY = 'emom_user_profile';

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

function loadProfile(): UserProfile {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return createDefaultProfile();
}

export function useEmomStore() {
  const [profile, setProfile] = useState<UserProfile>(loadProfile);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  const getExerciseProgress = useCallback((exerciseId: string): ExerciseProgress | null => {
    return profile.exerciseProgress[exerciseId] || null;
  }, [profile]);

  const startExercise = useCallback((exerciseId: ExerciseVariation) => {
    setProfile(prev => {
      if (prev.exerciseProgress[exerciseId]) return prev;
      return {
        ...prev,
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
        unlockedExercises: prev.unlockedExercises.includes(exerciseId)
          ? prev.unlockedExercises
          : [...prev.unlockedExercises, exerciseId],
      };
    });
  }, []);

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

      // Check streak
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

      // Unlock exercises if mastered
      let newUnlocked = [...prev.unlockedExercises];
      if (isMastery) {
        // Import all exercises and check which ones this unlocks
        // We'll handle this in the component layer
      }

      return {
        ...prev,
        totalXp: newTotalXp,
        level: getLevel(newTotalXp),
        streak: newStreak,
        lastWorkoutDate: new Date().toISOString(),
        exerciseProgress: {
          ...prev.exerciseProgress,
          [session.exerciseId]: updatedProgress,
        },
        unlockedExercises: newUnlocked,
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
    const fresh = createDefaultProfile();
    setProfile(fresh);
  }, []);

  return {
    profile,
    getExerciseProgress,
    startExercise,
    completeWorkout,
    unlockExercise,
    resetProfile,
  };
}
