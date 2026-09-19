-- ============ PROFILES: username / avatar ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_key ON public.profiles (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- ============ WORKOUT SESSIONS: stable client id + challenge link ============
ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS client_session_id TEXT,
  ADD COLUMN IF NOT EXISTS challenge_id UUID;

UPDATE public.workout_sessions
  SET client_session_id = id::text
  WHERE client_session_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workout_sessions_user_client_key
  ON public.workout_sessions (user_id, client_session_id);

-- ============ EXERCISE PROGRESS: upsert key ============
CREATE UNIQUE INDEX IF NOT EXISTS exercise_progress_user_exercise_key
  ON public.exercise_progress (user_id, exercise_id);

-- ============ CHALLENGES (immutable once published) ============
CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID NOT NULL,
  creator_display_name TEXT NOT NULL DEFAULT 'Athlete',
  source_session_id UUID,
  exercise_id TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'emom_10',
  prescription INTEGER[] NOT NULL,
  creator_total_reps INTEGER NOT NULL,
  parent_challenge_id UUID REFERENCES public.challenges(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

-- ============ CHALLENGE ATTEMPTS (many per challenge) ============
CREATE TABLE IF NOT EXISTS public.challenge_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  participant_user_id UUID NOT NULL,
  participant_display_name TEXT NOT NULL DEFAULT 'Athlete',
  session_id UUID,
  total_reps INTEGER,
  outcome TEXT,
  status TEXT NOT NULL DEFAULT 'started',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (challenge_id, participant_user_id)
);

GRANT SELECT ON public.challenge_attempts TO authenticated;
GRANT ALL ON public.challenge_attempts TO service_role;
ALTER TABLE public.challenge_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS challenge_attempts_challenge_idx ON public.challenge_attempts (challenge_id);
CREATE INDEX IF NOT EXISTS challenges_creator_idx ON public.challenges (creator_user_id);

-- Read policies: creators see their challenges, participants see challenges they attempted.
CREATE POLICY "Creators can view their challenges"
  ON public.challenges FOR SELECT TO authenticated
  USING (creator_user_id = auth.uid());

CREATE POLICY "Participants can view attempted challenges"
  ON public.challenges FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.challenge_attempts a
    WHERE a.challenge_id = challenges.id AND a.participant_user_id = auth.uid()
  ));

CREATE POLICY "Participants can view their attempts"
  ON public.challenge_attempts FOR SELECT TO authenticated
  USING (participant_user_id = auth.uid());

CREATE POLICY "Creators can view attempts on their challenges"
  ON public.challenge_attempts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = challenge_attempts.challenge_id AND c.creator_user_id = auth.uid()
  ));

-- No INSERT/UPDATE/DELETE policies: all writes go through the definer functions below,
-- which keeps published challenges and derived outcomes out of client control.

-- ============ PUBLIC (anonymous) CHALLENGE READ ============
CREATE OR REPLACE FUNCTION public.get_public_challenge(p_challenge_id UUID)
RETURNS TABLE (
  id UUID,
  creator_display_name TEXT,
  exercise_id TEXT,
  format TEXT,
  prescription INTEGER[],
  creator_total_reps INTEGER,
  parent_challenge_id UUID,
  created_at TIMESTAMPTZ,
  attempt_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  WHERE c.id = p_challenge_id;
$$;

REVOKE ALL ON FUNCTION public.get_public_challenge(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_challenge(UUID) TO anon, authenticated;

-- ============ CREATE A CHALLENGE FROM A REAL COMPLETED SESSION ============
CREATE OR REPLACE FUNCTION public.create_challenge_from_session(
  p_client_session_id TEXT,
  p_parent_challenge_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session public.workout_sessions;
  v_name TEXT;
  v_prescription INTEGER[];
  v_new_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_session
  FROM public.workout_sessions
  WHERE user_id = v_user AND client_session_id = p_client_session_id;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Session not found for this user';
  END IF;

  SELECT COALESCE(name, 'Athlete') INTO v_name
  FROM public.profiles WHERE user_id = v_user;

  SELECT array_agg(COALESCE((s->>'actualReps')::int, 0) ORDER BY (s->>'setNumber')::int)
  INTO v_prescription
  FROM jsonb_array_elements(v_session.sets) s;

  INSERT INTO public.challenges (
    creator_user_id, creator_display_name, source_session_id, exercise_id,
    format, prescription, creator_total_reps, parent_challenge_id
  ) VALUES (
    v_user, COALESCE(v_name, 'Athlete'), v_session.id, v_session.exercise_id,
    'emom_10', v_prescription, v_session.total_reps, p_parent_challenge_id
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_challenge_from_session(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_challenge_from_session(TEXT, UUID) TO authenticated;

-- ============ START AN ATTEMPT ============
CREATE OR REPLACE FUNCTION public.start_challenge_attempt(p_challenge_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_name TEXT;
  v_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.challenges WHERE id = p_challenge_id) THEN
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
$$;

REVOKE ALL ON FUNCTION public.start_challenge_attempt(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_challenge_attempt(UUID) TO authenticated;

-- ============ COMPLETE AN ATTEMPT (outcome derived server-side) ============
CREATE OR REPLACE FUNCTION public.complete_challenge_attempt(
  p_challenge_id UUID,
  p_client_session_id TEXT
)
RETURNS TABLE (
  outcome TEXT,
  creator_total_reps INTEGER,
  participant_total_reps INTEGER,
  creator_display_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session public.workout_sessions;
  v_challenge public.challenges;
  v_outcome TEXT;
  v_name TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id;
  IF v_challenge.id IS NULL THEN
    RAISE EXCEPTION 'Challenge not found';
  END IF;

  SELECT * INTO v_session
  FROM public.workout_sessions
  WHERE user_id = v_user AND client_session_id = p_client_session_id;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Session not found for this user';
  END IF;

  IF v_session.total_reps > v_challenge.creator_total_reps THEN
    v_outcome := 'won';
  ELSIF v_session.total_reps < v_challenge.creator_total_reps THEN
    v_outcome := 'lost';
  ELSE
    v_outcome := 'tied';
  END IF;

  SELECT COALESCE(name, 'Athlete') INTO v_name FROM public.profiles WHERE user_id = v_user;

  INSERT INTO public.challenge_attempts (
    challenge_id, participant_user_id, participant_display_name,
    session_id, total_reps, outcome, status, completed_at
  ) VALUES (
    p_challenge_id, v_user, COALESCE(v_name, 'Athlete'),
    v_session.id, v_session.total_reps, v_outcome, 'completed', now()
  )
  ON CONFLICT (challenge_id, participant_user_id) DO UPDATE SET
    session_id = EXCLUDED.session_id,
    total_reps = EXCLUDED.total_reps,
    outcome = EXCLUDED.outcome,
    status = 'completed',
    completed_at = now(),
    participant_display_name = EXCLUDED.participant_display_name;

  UPDATE public.workout_sessions SET challenge_id = p_challenge_id WHERE id = v_session.id;

  RETURN QUERY SELECT v_outcome, v_challenge.creator_total_reps, v_session.total_reps,
                      v_challenge.creator_display_name;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_challenge_attempt(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_challenge_attempt(UUID, TEXT) TO authenticated;

-- ============ SIGNUP TRIGGER: add username, provider-agnostic ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
BEGIN
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    'Athlete'
  );

  INSERT INTO public.profiles (user_id, name, username, avatar_url)
  VALUES (
    NEW.id,
    v_name,
    'athlete_' || substr(replace(NEW.id::text, '-', ''), 1, 10),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.exercise_progress (user_id, exercise_id) VALUES
    (NEW.id, 'regular_pushup'),
    (NEW.id, 'chin_up'),
    (NEW.id, 'neutral_grip_pullup')
  ON CONFLICT (user_id, exercise_id) DO NOTHING;

  RETURN NEW;
END;
$$;
