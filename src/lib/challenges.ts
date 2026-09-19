import { supabase } from '@/integrations/supabase/client';
import { ExerciseVariation } from '@/types/emom';

export interface PublicChallenge {
  id: string;
  creatorDisplayName: string;
  exerciseId: ExerciseVariation;
  format: string;
  prescription: number[];
  creatorTotalReps: number;
  parentChallengeId: string | null;
  createdAt: string;
  attemptCount: number;
}

export type ChallengeOutcome = 'won' | 'lost' | 'tied';

export interface AttemptResult {
  outcome: ChallengeOutcome;
  creatorTotalReps: number;
  participantTotalReps: number;
  creatorDisplayName: string;
}

/** Public, anonymous-safe read. Exposes only what's needed to take the challenge. */
export async function getPublicChallenge(id: string): Promise<PublicChallenge | null> {
  const { data, error } = await supabase.rpc('get_public_challenge', { p_challenge_id: id });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    id: row.id,
    creatorDisplayName: row.creator_display_name,
    exerciseId: row.exercise_id as ExerciseVariation,
    format: row.format,
    prescription: row.prescription || [],
    creatorTotalReps: row.creator_total_reps,
    parentChallengeId: row.parent_challenge_id,
    createdAt: row.created_at,
    attemptCount: Number(row.attempt_count || 0),
  };
}

/** Challenge is built server-side from the real completed session — never client-declared. */
export async function createChallengeFromSession(
  clientSessionId: string,
  parentChallengeId?: string | null
): Promise<string> {
  const { data, error } = await supabase.rpc('create_challenge_from_session', {
    p_client_session_id: clientSessionId,
    p_parent_challenge_id: parentChallengeId ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function startChallengeAttempt(challengeId: string): Promise<void> {
  const { error } = await supabase.rpc('start_challenge_attempt', { p_challenge_id: challengeId });
  if (error) throw error;
}

/** Outcome is derived in the database from the two stored scores. */
export async function completeChallengeAttempt(
  challengeId: string,
  clientSessionId: string
): Promise<AttemptResult> {
  const { data, error } = await supabase.rpc('complete_challenge_attempt', {
    p_challenge_id: challengeId,
    p_client_session_id: clientSessionId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    outcome: row.outcome as ChallengeOutcome,
    creatorTotalReps: row.creator_total_reps,
    participantTotalReps: row.participant_total_reps,
    creatorDisplayName: row.creator_display_name,
  };
}

export interface ChallengeRow {
  id: string;
  creator_user_id: string;
  creator_display_name: string;
  exercise_id: string;
  creator_total_reps: number;
  created_at: string;
  parent_challenge_id: string | null;
}

export interface AttemptRow {
  id: string;
  challenge_id: string;
  participant_user_id: string;
  participant_display_name: string;
  total_reps: number | null;
  outcome: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
}

export async function listSentChallenges(userId: string) {
  const { data: challenges, error } = await supabase
    .from('challenges')
    .select('id, creator_user_id, creator_display_name, exercise_id, creator_total_reps, created_at, parent_challenge_id')
    .eq('creator_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const ids = (challenges || []).map(c => c.id);
  let attempts: AttemptRow[] = [];
  if (ids.length) {
    const { data } = await supabase
      .from('challenge_attempts')
      .select('*')
      .in('challenge_id', ids);
    attempts = (data || []) as AttemptRow[];
  }
  return { challenges: (challenges || []) as ChallengeRow[], attempts };
}

export async function listMyAttempts(userId: string) {
  const { data: attempts, error } = await supabase
    .from('challenge_attempts')
    .select('*')
    .eq('participant_user_id', userId)
    .order('started_at', { ascending: false });
  if (error) throw error;

  const ids = Array.from(new Set((attempts || []).map(a => a.challenge_id)));
  let challenges: ChallengeRow[] = [];
  if (ids.length) {
    const { data } = await supabase
      .from('challenges')
      .select('id, creator_user_id, creator_display_name, exercise_id, creator_total_reps, created_at, parent_challenge_id')
      .in('id', ids);
    challenges = (data || []) as ChallengeRow[];
  }
  return { attempts: (attempts || []) as AttemptRow[], challenges };
}
