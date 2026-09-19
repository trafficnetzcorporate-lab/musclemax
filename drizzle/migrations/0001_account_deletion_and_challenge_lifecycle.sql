-- Account deletion support (App Store requirement).
-- A deleted creator's challenges are anonymized and deactivated, never deleted,
-- so other participants' attempts and history are preserved.

ALTER TABLE public.challenges ALTER COLUMN creator_user_id DROP NOT NULL;

-- Public challenge page: deactivated challenges no longer resolve.
CREATE OR REPLACE FUNCTION public.get_public_challenge(p_challenge_id uuid)
 RETURNS TABLE(id uuid, creator_display_name text, exercise_id text, format text, prescription integer[], creator_total_reps integer, parent_challenge_id uuid, created_at timestamp with time zone, attempt_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id,
         c.creator_display_name,
         c.exercise_id,
         c.format,
         c.prescription,
         c.creator_total_reps,
         c.parent_challenge_id,
         c.created_at,
         (SELECT count(*) FROM public.challenge_attempts a
            WHERE a.challenge_id = c.id AND a.status = 'completed')
  FROM public.challenges c
  WHERE c.id = p_challenge_id AND c.status <> 'deleted';
$function$;

-- New attempts cannot be started on deactivated challenges.
CREATE OR REPLACE FUNCTION public.start_challenge_attempt(p_challenge_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_name TEXT;
  v_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  SELECT 1 INTO v_id FROM public.challenges
  WHERE id = p_challenge_id AND status <> 'deleted';
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Challenge not found';
  END IF;

  SELECT COALESCE(name, 'Athlete') INTO v_name FROM public.profiles WHERE user_id = v_user;

  INSERT INTO public.challenge_attempts (challenge_id, participant_user_id, participant_display_name)
  VALUES (p_challenge_id, v_user, COALESCE(v_name, 'Athlete'))
  ON CONFLICT (challenge_id, participant_user_id) DO UPDATE
    SET participant_display_name = EXCLUDED.participant_display_name
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- Keep the SECURITY DEFINER helpers private (recreated functions must stay locked down).
REVOKE EXECUTE ON FUNCTION public.get_public_challenge(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_challenge_attempt(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_challenge_attempt(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_challenge_from_session(text, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_public_challenge(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_challenge_attempt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_challenge_attempt(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_challenge_from_session(text, uuid) TO authenticated;
