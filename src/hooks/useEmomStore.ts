import { useState, useCallback, useEffect } from 'react';
import { UserProfile, ExerciseProgress, WorkoutSession, ExerciseVariation, WorkoutPhase, XP_REWARDS, LEVEL_THRESHOLDS } from '@/types/emom';
import { getDefaultUnlocked } from '@/lib/exercises';
import { processWorkout, calculateWorkoutXp, getBaselinePrescription } from '@/lib/emom-algorithm';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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

export function useEmomStore() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(createDefaultProfile);
  const [loaded, setLoaded] = useState(false);

  // Load from Supabase on mount / user change
  useEffect(() => {
    if (!user) {
      setProfile(createDefaultProfile());
      setLoaded(false);
      return;
    }

    const loadFromDb = async () => {
      try {
        // Load profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        // Load exercise progress
        const { data: progressData } = await supabase
          .from('exercise_progress')
          .select('*')
          .eq('user_id', user.id);

        // Load workout sessions
        const { data: sessionsData } = await supabase
          .from('workout_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('workout_date', { ascending: true });

        if (profileData) {
          const exerciseProgress: Record<string, ExerciseProgress> = {};

          if (progressData) {
            for (const ep of progressData) {
              const sessions = (sessionsData || [])
                .filter(s => s.exercise_id === ep.exercise_id)
                .map(s => ({
                  id: s.id,
                  date: s.workout_date,
                  exerciseId: s.exercise_id as ExerciseVariation,
                  phase: s.phase as WorkoutPhase,
                  sets: s.sets as any,
                  totalReps: s.total_reps,
                  notes: s.notes || undefined,
                }));

              exerciseProgress[ep.exercise_id] = {
                exerciseId: ep.exercise_id as ExerciseVariation,
                currentPhase: ep.current_phase as WorkoutPhase,
                currentPrescription: ep.current_prescription as number[],
                totalWorkouts: ep.total_workouts,
                bestTotalReps: ep.best_total_reps,
                history: sessions,
                mastered: ep.mastered,
                masteredDate: ep.mastered_date || undefined,
                xp: ep.xp,
              };
            }
          }

          setProfile({
            name: profileData.name,
            level: profileData.level,
            totalXp: profileData.total_xp,
            streak: profileData.streak,
            lastWorkoutDate: profileData.last_workout_date || undefined,
            exerciseProgress,
            unlockedExercises: (profileData.unlocked_exercises || []) as ExerciseVariation[],
          });
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
      setLoaded(true);
    };

    loadFromDb();
  }, [user]);

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

      // Persist to Supabase async
      if (user) {
        // Save workout session
        supabase.from('workout_sessions').insert({
          id: session.id,
          user_id: user.id,
          exercise_id: session.exerciseId,
          phase: session.phase,
          sets: session.sets as any,
          total_reps: totalReps,
          notes: session.notes || null,
          workout_date: session.date,
        }).then();

        // Update exercise progress
        supabase.from('exercise_progress').update({
          current_phase: nextPhase,
          current_prescription: nextPrescription,
          total_workouts: updatedProgress.totalWorkouts,
          best_total_reps: updatedProgress.bestTotalReps,
          mastered: updatedProgress.mastered,
          mastered_date: updatedProgress.masteredDate || null,
          xp: updatedProgress.xp,
        }).eq('user_id', user.id).eq('exercise_id', session.exerciseId).then();

        // Update profile
        supabase.from('profiles').update({
          total_xp: newTotalXp,
          level: newLevel,
          streak: newStreak,
          last_workout_date: new Date().toISOString(),
        }).eq('user_id', user.id).then();
      }

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
  }, [user]);

  const unlockExercise = useCallback((exerciseId: ExerciseVariation) => {
    setProfile(prev => {
      if (prev.unlockedExercises.includes(exerciseId)) return prev;

      const newUnlocked = [...prev.unlockedExercises, exerciseId];

      // Persist to Supabase
      if (user) {
        supabase.from('profiles').update({
          unlocked_exercises: newUnlocked,
        }).eq('user_id', user.id).then();

        supabase.from('exercise_progress').insert({
          user_id: user.id,
          exercise_id: exerciseId,
        }).then();
      }

      return {
        ...prev,
        unlockedExercises: newUnlocked,
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
  }, [user]);

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
