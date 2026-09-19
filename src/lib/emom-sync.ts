import { supabase } from '@/integrations/supabase/client';
import {
  ExerciseProgress, ExerciseVariation, UserProfile, WorkoutSession, WorkoutSet, LEVEL_THRESHOLDS,
} from '@/types/emom';
import { getDefaultUnlocked, getAncestors, getDependents } from '@/lib/exercises';
import { processWorkout, calculateWorkoutXp, getBaselinePrescription } from '@/lib/emom-algorithm';

/**
 * Cloud sync.
 * Signed out: localStorage is canonical.
 * Signed in: the cloud database is canonical; local storage is an offline cache.
 * Every session carries a stable id (`client_session_id`) so a device's local history can be
 * merged into the account idempotently — unique sessions inserted, known ids skipped.
 */

function getLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function collectLocalSessions(profile: UserProfile): WorkoutSession[] {
  return Object.values(profile.exerciseProgress).flatMap(p => p.history || []);
}

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

function computeStreak(sessions: WorkoutSession[]): { streak: number; last?: string } {
  if (sessions.length === 0) return { streak: 0 };
  const days = Array.from(new Set(sessions.map(s => new Date(s.date).toDateString())))
    .map(d => new Date(d).getTime())
    .sort((a, b) => b - a);
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i - 1] - days[i] === 86400000) streak += 1;
    else break;
  }
  const last = sessions
    .map(s => s.date)
    .sort()
    .slice(-1)[0];
  return { streak, last };
}

/**
 * Deterministically rebuild all derived state (prescriptions, phases, XP, level, streak,
 * mastery, unlocks) by replaying the merged session set in chronological order.
 * This is what keeps two signed-in devices from drifting apart.
 */
export function rebuildProfile(
  sessions: WorkoutSession[],
  storedUnlocked: string[],
  name: string
): UserProfile {
  const byExercise = new Map<string, WorkoutSession[]>();
  for (const s of sessions) {
    const list = byExercise.get(s.exerciseId) || [];
    list.push(s);
    byExercise.set(s.exerciseId, list);
  }

  const unlocked = new Set<string>([...getDefaultUnlocked(), ...storedUnlocked]);
  const progressMap: Record<string, ExerciseProgress> = {};
  let totalXp = 0;

  for (const [exerciseId, list] of byExercise) {
    list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let progress = freshProgress(exerciseId as ExerciseVariation);
    for (const session of list) {
      const { nextPrescription, nextPhase } = processWorkout(session, progress);
      const wasMastered = progress.mastered;
      const isMastery = nextPhase === 'completed' && !wasMastered;
      const xp = calculateWorkoutXp(session, isMastery);
      totalXp += xp;
      progress = {
        ...progress,
        currentPhase: progress.mastered ? 'completed' : nextPhase,
        currentPrescription: nextPrescription,
        totalWorkouts: progress.totalWorkouts + 1,
        bestTotalReps: Math.max(progress.bestTotalReps, session.totalReps || 0),
        history: [...progress.history, session],
        mastered: progress.mastered || nextPhase === 'completed',
        masteredDate: isMastery ? session.date : progress.masteredDate,
        xp: progress.xp + xp,
      };
    }
    progressMap[exerciseId] = progress;
    unlocked.add(exerciseId);
    if (progress.mastered) {
      for (const anc of getAncestors(exerciseId as ExerciseVariation)) unlocked.add(anc.id);
      for (const dep of getDependents(exerciseId as ExerciseVariation)) unlocked.add(dep.id);
    }
  }

  for (const id of unlocked) {
    if (!progressMap[id]) progressMap[id] = freshProgress(id as ExerciseVariation);
  }

  const { streak, last } = computeStreak(sessions);

  return {
    name,
    level: getLevel(totalXp),
    totalXp,
    streak,
    lastWorkoutDate: last,
    exerciseProgress: progressMap,
    unlockedExercises: Array.from(unlocked) as ExerciseVariation[],
  };
}

function rowToSession(row: {
  client_session_id: string | null;
  id: string;
  exercise_id: string;
  phase: string;
  sets: unknown;
  total_reps: number;
  notes: string | null;
  workout_date: string;
}): WorkoutSession {
  return {
    id: row.client_session_id || row.id,
    date: row.workout_date,
    exerciseId: row.exercise_id as ExerciseVariation,
    phase: row.phase as WorkoutSession['phase'],
    sets: (row.sets as WorkoutSet[]) || [],
    totalReps: row.total_reps,
    notes: row.notes || undefined,
  };
}

async function fetchCloudSessions(userId: string): Promise<WorkoutSession[]> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('id, client_session_id, exercise_id, phase, sets, total_reps, notes, workout_date')
    .eq('user_id', userId);
  if (error) throw error;
  return (data || []).map(rowToSession);
}

export async function pushSession(userId: string, session: WorkoutSession) {
  const { error } = await supabase.from('workout_sessions').upsert(
    {
      user_id: userId,
      client_session_id: session.id,
      exercise_id: session.exerciseId,
      phase: session.phase,
      sets: session.sets as never,
      total_reps: session.totalReps,
      notes: session.notes ?? null,
      workout_date: session.date,
    },
    { onConflict: 'user_id,client_session_id' }
  );
  if (error) throw error;
}

export async function pushProfileState(userId: string, profile: UserProfile) {
  await supabase
    .from('profiles')
    .update({
      level: profile.level,
      total_xp: profile.totalXp,
      streak: profile.streak,
      last_workout_date: profile.lastWorkoutDate ?? null,
      unlocked_exercises: profile.unlockedExercises,
    })
    .eq('user_id', userId);

  const rows = Object.values(profile.exerciseProgress).map(p => ({
    user_id: userId,
    exercise_id: p.exerciseId,
    current_phase: p.currentPhase,
    current_prescription: p.currentPrescription,
    total_workouts: p.totalWorkouts,
    best_total_reps: p.bestTotalReps,
    mastered: p.mastered,
    mastered_date: p.masteredDate ?? null,
    xp: p.xp,
  }));
  if (rows.length) {
    await supabase.from('exercise_progress').upsert(rows, { onConflict: 'user_id,exercise_id' });
  }
}

/**
 * Merge this device's local history into the account, then return the canonical
 * cloud-derived profile. Idempotent: re-running never duplicates or drops sessions.
 */
export async function mergeAndPullProfile(userId: string, localProfile: UserProfile): Promise<UserProfile> {
  const cloudSessions = await fetchCloudSessions(userId);
  const cloudIds = new Set(cloudSessions.map(s => s.id));

  const localSessions = collectLocalSessions(localProfile);
  const toUpload = localSessions.filter(s => !cloudIds.has(s.id));
  for (const s of toUpload) {
    try {
      await pushSession(userId, s);
    } catch {
      /* skip unsyncable record, keep merging */
    }
  }

  const merged = [...cloudSessions, ...toUpload];

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('name, unlocked_exercises')
    .eq('user_id', userId)
    .maybeSingle();

  const storedUnlocked = Array.from(
    new Set([...(profileRow?.unlocked_exercises || []), ...localProfile.unlockedExercises])
  );

  const rebuilt = rebuildProfile(merged, storedUnlocked, profileRow?.name || localProfile.name || 'Athlete');
  await pushProfileState(userId, rebuilt);
  return rebuilt;
}
