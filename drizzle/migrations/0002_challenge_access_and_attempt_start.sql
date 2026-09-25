-- Break the challenges <-> challenge_attempts SELECT-policy cycle. These helpers
-- answer only whether the signed-in caller owns or participates in one challenge.
-- Running the membership lookup as the table owner avoids recursive RLS checks.
CREATE OR REPLACE FUNCTION public.is_challenge_creator(p_challenge_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = p_challenge_id AND c.creator_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_challenge_participant(p_challenge_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.challenge_attempts a
    WHERE a.challenge_id = p_challenge_id AND a.participant_user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_challenge_creator(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_challenge_participant(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_challenge_creator(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_challenge_participant(UUID) TO authenticated;

ALTER POLICY "Participants can view attempted challenges"
  ON public.challenges
  USING (public.is_challenge_participant(id));

ALTER POLICY "Creators can view attempts on their challenges"
  ON public.challenge_attempts
  USING (public.is_challenge_creator(challenge_id));

-- The lifecycle migration selected the integer 1 into a UUID variable, so every
-- valid challenge failed before an attempt could be created. Select its UUID.
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

  SELECT id INTO v_id FROM public.challenges
  WHERE id = p_challenge_id AND status <> 'deleted';
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Challenge not found';
  END IF;

  SELECT COALESCE(name, 'Athlete') INTO v_name
  FROM public.profiles WHERE user_id = v_user;

  INSERT INTO public.challenge_attempts (challenge_id, participant_user_id, participant_display_name)
  VALUES (p_challenge_id, v_user, COALESCE(v_name, 'Athlete'))
  ON CONFLICT (challenge_id, participant_user_id) DO UPDATE
    SET participant_display_name = EXCLUDED.participant_display_name
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_challenge_attempt(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_challenge_attempt(UUID) TO authenticated;
