import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { UserProfile, ExerciseProgress, WorkoutSession, ExerciseVariation, WorkoutPhase, XP_REWARDS, LEVEL_THRESHOLDS } from '@/types/emom';
import { getDefaultUnlocked, getAncestors, getDependents } from '@/lib/exercises';
import { processWorkout, calculateWorkoutXp, getBaselinePrescription } from '@/lib/emom-algorithm';
import { useAuth } from '@/hooks/useAuth';
import { collectLocalSessions, mergeAndPullProfile, pushProfileState, pushSession } from '@/lib/emom-sync';

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
    progress[id] = freshProgress(id as ExerciseVariation);
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
      for (const key of Object.keys(parsed.exerciseProgress || {})) {
        const ep = parsed.exerciseProgress[key];
        ep.currentPhase = migratePhase(ep.currentPhase as unknown as string);
        // Ensure every session has a stable id so cloud merges can dedupe reliably.
        ep.history = (ep.history || []).map(s =>
          s.id ? s : { ...s, id: `${new Date(s.date).getTime()}-${ep.exerciseId}` }
        );
      }
      return parsed;
    }
  } catch { /* ignore malformed storage */ }
  return createDefaultProfile();
}

interface EmomStoreValue {
  profile: UserProfile;
  loaded: boolean;
  syncing: boolean;
  getExerciseProgress: (exerciseId: string) => ExerciseProgress | null;
  startExercise: () => void;
  completeWorkout: (session: WorkoutSession) => void;
  unlockExercise: (exerciseId: ExerciseVariation) => void;
  applyChallengeWin: (session: WorkoutSession) => void;
  applyChallengePartial: (exerciseId: ExerciseVariation) => void;
  resetProfile: () => void;
}

const EmomStoreContext = createContext<EmomStoreValue | null>(null);

export function EmomStoreProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(loadProfile);
  const [syncing, setSyncing] = useState(false);
  const syncedUserRef = useRef<string | null>(null);
  const pushedSessionIds = useRef<Set<string>>(new Set());

  // localStorage is the offline cache (and the source of truth while signed out).
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  // On sign-in: merge this device's local history into the account, then adopt the
  // cloud-derived profile as canonical.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      syncedUserRef.current = null;
      pushedSessionIds.current = new Set();
      return;
    }
    if (syncedUserRef.current === user.id) return;
    syncedUserRef.current = user.id;

    let cancelled = false;
    setSyncing(true);
    (async () => {
      try {
        const canonical = await mergeAndPullProfile(user.id, loadProfile());
        if (cancelled) return;
        pushedSessionIds.current = new Set(collectLocalSessions(canonical).map(s => s.id));
        setProfile(canonical);
      } catch {
        /* offline: keep using the local cache, sync retries on next sign-in/load */
        syncedUserRef.current = null;
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user, authLoading]);

  // Push new sessions + derived state upward while signed in.
  useEffect(() => {
    if (!user || syncing || syncedUserRef.current !== user.id) return;
    const sessions = collectLocalSessions(profile);
    const unsynced = sessions.filter(s => !pushedSessionIds.current.has(s.id));
    (async () => {
      try {
        for (const s of unsynced) {
          await pushSession(user.id, s);
          pushedSessionIds.current.add(s.id);
        }
        await pushProfileState(user.id, profile);
      } catch {
        /* queued: retried on the next change or next sign-in sync */
      }
    })();
  }, [profile, user, syncing]);

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
   */
  const applyChallengeWin = useCallback((session: WorkoutSession) => {
    setProfile(prev => {
      const id = session.exerciseId;
      const unlocked = new Set(prev.unlockedExercises);
      const progressMap: Record<string, ExerciseProgress> = { ...prev.exerciseProgress };

      for (const anc of getAncestors(id)) {
        if (!unlocked.has(anc.id)) {
          unlocked.add(anc.id);
          progressMap[anc.id] = freshProgress(anc.id);
        }
      }

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

  const value: EmomStoreValue = {
    profile,
    loaded: true,
    syncing,
    getExerciseProgress,
    startExercise: () => {},
    completeWorkout,
    unlockExercise,
    applyChallengeWin,
    applyChallengePartial,
    resetProfile,
  };

  return React.createElement(EmomStoreContext.Provider, { value }, children);
}

export function useEmomStore(): EmomStoreValue {
  const ctx = useContext(EmomStoreContext);
  if (!ctx) throw new Error('useEmomStore must be used inside EmomStoreProvider');
  return ctx;
}
