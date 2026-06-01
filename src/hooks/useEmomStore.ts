import { useState, useCallback, useEffect } from 'react';
import { UserProfile, ExerciseProgress, WorkoutSession, ExerciseVariation, WorkoutPhase, XP_REWARDS, LEVEL_THRESHOLDS } from '@/types/emom';
import { getDefaultUnlocked, getAncestors, getDependents } from '@/lib/exercises';
import { processWorkout, calculateWorkoutXp, getBaselinePrescription } from '@/lib/emom-algorithm';

const STORAGE_KEY = 'emom_profile';

function getLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

/** A fresh, unlocked-but-untrained progress entry (available for rep logging). */
function freshProgress(id: ExerciseVariation): ExerciseProgress {
  return {
    exerciseId: id,
    currentPhase: 'baseline',
    currentPrescription: getBaselinePrescription(),
    totalWorkouts: 0,
    bestTotalReps: 0,
    history: [],
    mastered: false,
    xp: 0,
  };
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
  } catch { /* ignore malformed storage */ }
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

  /**
   * Apply a won Challenge (one all-out session of 12 reps × 10 sets).
   * Effects:
   *  - the challenged exercise is marked MASTERED, with the winning session logged,
   *  - every ancestor (easier prerequisite) is UNLOCKED for rep logging — but NOT
   *    auto-mastered and its reps are NOT filled in,
   *  - the next tier (direct dependents) unlocks exactly as a normal mastery would.
   * Anything further out stays locked, per the existing tier rules.
   */
  const applyChallengeWin = useCallback((session: WorkoutSession) => {
    setProfile(prev => {
      const id = session.exerciseId;
      const unlocked = new Set(prev.unlockedExercises);
      const progressMap: Record<string, ExerciseProgress> = { ...prev.exerciseProgress };

      // Unlock ancestors for logging (don't master, don't fill reps).
      for (const anc of getAncestors(id)) {
        if (!unlocked.has(anc.id)) {
          unlocked.add(anc.id);
          progressMap[anc.id] = freshProgress(anc.id);
        }
      }

      // Master the challenged exercise itself.
      const existing = progressMap[id];
      const totalReps = session.sets.reduce((s, set) => s + (set.actualReps || 0), 0);
      const challengeXp = XP_REWARDS.COMPLETE_WORKOUT + XP_REWARDS.MASTER_EXERCISE;
      unlocked.add(id);
      progressMap[id] = {
        exerciseId: id,
        currentPhase: 'completed',
        currentPrescription: Array(10).fill(12),
        totalWorkouts: (existing?.totalWorkouts || 0) + 1,
        bestTotalReps: Math.max(existing?.bestTotalReps || 0, totalReps),
        history: [...(existing?.history || []), session],
        mastered: true,
        masteredDate: new Date().toISOString(),
        xp: (existing?.xp || 0) + challengeXp,
      };

      // Unlock the next tier (same as a normal mastery).
      for (const dep of getDependents(id)) {
        if (!unlocked.has(dep.id)) {
          unlocked.add(dep.id);
          progressMap[dep.id] = freshProgress(dep.id);
        }
      }

      const newTotalXp = prev.totalXp + challengeXp;
      return {
        ...prev,
        totalXp: newTotalXp,
        level: getLevel(newTotalXp),
        unlockedExercises: Array.from(unlocked),
        exerciseProgress: progressMap,
      };
    });
  }, []);

  /**
   * Apply a *partial* Challenge result (≥ 60 total reps but not a full 12×10).
   * The athlete proved they belong at this exercise, so:
   *  - the challenged exercise itself is UNLOCKED for normal rep-logging (not mastered),
   *  - every earlier prerequisite tier is UNLOCKED for logging too,
   *  - the next tier stays LOCKED — they didn't max it out.
   * No reps are auto-filled; this only opens things up to be trained.
   */
  const applyChallengePartial = useCallback((exerciseId: ExerciseVariation) => {
    setProfile(prev => {
      const unlocked = new Set(prev.unlockedExercises);
      const progressMap: Record<string, ExerciseProgress> = { ...prev.exerciseProgress };

      for (const anc of getAncestors(exerciseId)) {
        if (!unlocked.has(anc.id)) {
          unlocked.add(anc.id);
          progressMap[anc.id] = freshProgress(anc.id);
        }
      }
      if (!unlocked.has(exerciseId)) {
        unlocked.add(exerciseId);
        progressMap[exerciseId] = freshProgress(exerciseId);
      }

      return {
        ...prev,
        unlockedExercises: Array.from(unlocked),
        exerciseProgress: progressMap,
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
    applyChallengeWin,
    applyChallengePartial,
    resetProfile,
  };
}
