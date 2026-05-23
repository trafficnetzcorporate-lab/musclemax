
-- Add missing DELETE/UPDATE policies scoped to the owning user
CREATE POLICY "Users can delete their own exercise progress"
ON public.exercise_progress FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own leg workout logs"
ON public.leg_workout_logs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leg workout logs"
ON public.leg_workout_logs FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own workout sessions"
ON public.workout_sessions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workout sessions"
ON public.workout_sessions FOR DELETE
USING (auth.uid() = user_id);

-- Revoke direct EXECUTE on SECURITY DEFINER helper functions; they're only
-- needed as trigger functions and should not be callable via the API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
