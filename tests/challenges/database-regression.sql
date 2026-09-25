-- Run as the database owner after migration 0002. All fixture rows and role/JWT
-- settings are rolled back inside an exception subtransaction, on pass or fail.
-- Synthetic caller IDs never create or modify authentication accounts.
CREATE OR REPLACE FUNCTION pg_temp.verify_challenge_access()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_creator UUID := gen_random_uuid();
  v_participant UUID := gen_random_uuid();
  v_other_participant UUID := gen_random_uuid();
  v_outsider UUID := gen_random_uuid();
  v_challenge UUID := gen_random_uuid();
  v_other_challenge UUID := gen_random_uuid();
  v_deleted_challenge UUID := gen_random_uuid();
  v_attempt UUID;
  v_started_attempt UUID;
  v_count BIGINT;
BEGIN
  BEGIN
    INSERT INTO public.challenges (id, creator_user_id, exercise_id, prescription, creator_total_reps, status)
    VALUES
      (v_challenge, v_creator, 'regular_pushup', ARRAY[1,1,1,1,1,1,1,1,1,1], 10, 'open'),
      (v_other_challenge, v_outsider, 'regular_pushup', ARRAY[1,1,1,1,1,1,1,1,1,1], 10, 'open'),
      (v_deleted_challenge, v_creator, 'regular_pushup', ARRAY[1,1,1,1,1,1,1,1,1,1], 10, 'deleted');

    INSERT INTO public.challenge_attempts (challenge_id, participant_user_id)
    VALUES (v_challenge, v_participant) RETURNING id INTO v_attempt;
    INSERT INTO public.challenge_attempts (challenge_id, participant_user_id)
    VALUES (v_challenge, v_other_participant);

    PERFORM set_config('request.jwt.claim.sub', v_creator::TEXT, true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_creator, 'role', 'authenticated')::TEXT, true);
    PERFORM set_config('role', 'authenticated', true);

    SELECT count(*) INTO v_count FROM public.challenges WHERE id = v_challenge;
    IF v_count <> 1 THEN RAISE EXCEPTION 'Creator cannot read own challenge'; END IF;
    SELECT count(*) INTO v_count FROM public.challenge_attempts WHERE challenge_id = v_challenge;
    IF v_count <> 2 THEN RAISE EXCEPTION 'Creator cannot read all attempts on own challenge'; END IF;
    SELECT count(*) INTO v_count FROM public.challenges WHERE id = v_other_challenge;
    IF v_count <> 0 THEN RAISE EXCEPTION 'Creator can read an unrelated challenge'; END IF;
    IF NOT public.is_challenge_creator(v_challenge) OR public.is_challenge_participant(v_challenge) THEN
      RAISE EXCEPTION 'Creator membership helpers returned an incorrect result';
    END IF;

    PERFORM set_config('request.jwt.claim.sub', v_participant::TEXT, true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_participant, 'role', 'authenticated')::TEXT, true);
    SELECT count(*) INTO v_count FROM public.challenges WHERE id = v_challenge;
    IF v_count <> 1 THEN RAISE EXCEPTION 'Participant cannot read attempted challenge'; END IF;
    SELECT count(*) INTO v_count FROM public.challenge_attempts WHERE challenge_id = v_challenge;
    IF v_count <> 1 THEN RAISE EXCEPTION 'Participant can read another participant attempt'; END IF;
    SELECT count(*) INTO v_count FROM public.challenges WHERE id = v_other_challenge;
    IF v_count <> 0 THEN RAISE EXCEPTION 'Participant can read unrelated challenge'; END IF;
    IF public.is_challenge_creator(v_challenge) OR NOT public.is_challenge_participant(v_challenge) THEN
      RAISE EXCEPTION 'Participant membership helpers returned an incorrect result';
    END IF;
    SELECT public.start_challenge_attempt(v_challenge) INTO v_started_attempt;
    IF v_started_attempt IS DISTINCT FROM v_attempt THEN RAISE EXCEPTION 'Existing attempt was not reused'; END IF;

    PERFORM set_config('request.jwt.claim.sub', v_outsider::TEXT, true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_outsider, 'role', 'authenticated')::TEXT, true);
    SELECT count(*) INTO v_count FROM public.challenges WHERE id = v_challenge;
    IF v_count <> 0 THEN RAISE EXCEPTION 'Unrelated caller can read challenge before joining'; END IF;
    SELECT count(*) INTO v_count FROM public.challenge_attempts WHERE challenge_id = v_challenge;
    IF v_count <> 0 THEN RAISE EXCEPTION 'Unrelated caller can read attempts before joining'; END IF;
    SELECT public.start_challenge_attempt(v_challenge) INTO v_started_attempt;
    IF v_started_attempt IS NULL THEN RAISE EXCEPTION 'New attempt did not return an ID'; END IF;
    IF public.start_challenge_attempt(v_challenge) IS DISTINCT FROM v_started_attempt THEN
      RAISE EXCEPTION 'Starting an attempt twice created a duplicate';
    END IF;
    SELECT count(*) INTO v_count FROM public.challenges WHERE id = v_challenge;
    IF v_count <> 1 THEN RAISE EXCEPTION 'New participant cannot read challenge'; END IF;
    SELECT count(*) INTO v_count FROM public.challenge_attempts WHERE challenge_id = v_challenge;
    IF v_count <> 1 THEN RAISE EXCEPTION 'New participant can read other attempts'; END IF;

    BEGIN
      PERFORM public.start_challenge_attempt(v_deleted_challenge);
      RAISE EXCEPTION 'Deleted challenge unexpectedly accepted an attempt';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'Challenge not found' THEN RAISE; END IF;
    END;
    BEGIN
      PERFORM public.start_challenge_attempt(gen_random_uuid());
      RAISE EXCEPTION 'Missing challenge unexpectedly accepted an attempt';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'Challenge not found' THEN RAISE; END IF;
    END;

    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    PERFORM set_config('role', 'anon', true);
    SELECT count(*) INTO v_count FROM public.get_public_challenge(v_challenge);
    IF v_count <> 1 THEN RAISE EXCEPTION 'Public challenge link no longer resolves'; END IF;
    SELECT count(*) INTO v_count FROM public.get_public_challenge(v_deleted_challenge);
    IF v_count <> 0 THEN RAISE EXCEPTION 'Deleted challenge is publicly visible'; END IF;
    SELECT count(*) INTO v_count FROM public.challenges WHERE id = v_challenge;
    IF v_count <> 0 THEN RAISE EXCEPTION 'Anonymous caller can read private challenge rows'; END IF;
    SELECT count(*) INTO v_count FROM public.challenge_attempts WHERE challenge_id = v_challenge;
    IF v_count <> 0 THEN RAISE EXCEPTION 'Anonymous caller can read private attempt rows'; END IF;
    BEGIN
      PERFORM public.start_challenge_attempt(v_challenge);
      RAISE EXCEPTION 'Anonymous caller can start an attempt';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
      PERFORM public.is_challenge_creator(v_challenge);
      RAISE EXCEPTION 'Anonymous caller can invoke creator membership helper';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
      PERFORM public.is_challenge_participant(v_challenge);
      RAISE EXCEPTION 'Anonymous caller can invoke participant membership helper';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    -- Force a rollback even when every assertion passed.
    RAISE EXCEPTION USING ERRCODE = 'ZX001', MESSAGE = 'challenge regression passed';
  EXCEPTION WHEN SQLSTATE 'ZX001' THEN
    RETURN 'PASS: creator/participant privacy, new and repeated attempts, deleted/missing challenges, anonymous access; all fixture changes rolled back';
  END;
END;
$$;

SELECT pg_temp.verify_challenge_access() AS result;
