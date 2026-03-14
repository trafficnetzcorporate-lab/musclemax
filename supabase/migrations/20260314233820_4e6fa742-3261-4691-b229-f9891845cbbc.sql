-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Athlete'));
  
  -- Create default exercise progress entries
  INSERT INTO public.exercise_progress (user_id, exercise_id) VALUES
    (NEW.id, 'regular_pushup'),
    (NEW.id, 'chin_up'),
    (NEW.id, 'neutral_grip_pullup');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();