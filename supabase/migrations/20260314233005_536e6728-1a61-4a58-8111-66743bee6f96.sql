-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'Athlete',
  level INTEGER NOT NULL DEFAULT 1,
  total_xp INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_workout_date TIMESTAMP WITH TIME ZONE,
  unlocked_exercises TEXT[] NOT NULL DEFAULT ARRAY['regular_pushup', 'chin_up', 'neutral_grip_pullup'],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create exercise_progress table
CREATE TABLE public.exercise_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  exercise_id TEXT NOT NULL,
  current_phase TEXT NOT NULL DEFAULT 'baseline',
  current_prescription INTEGER[] NOT NULL DEFAULT ARRAY[12,12,12,12,12,12,12,12,12,12],
  total_workouts INTEGER NOT NULL DEFAULT 0,
  best_total_reps INTEGER NOT NULL DEFAULT 0,
  mastered BOOLEAN NOT NULL DEFAULT false,
  mastered_date TIMESTAMP WITH TIME ZONE,
  xp INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, exercise_id)
);

-- Create workout_sessions table
CREATE TABLE public.workout_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  exercise_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  sets JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_reps INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  workout_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create leg_workout_logs table
CREATE TABLE public.leg_workout_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  squat_sets INTEGER NOT NULL,
  squat_reps INTEGER NOT NULL,
  ab_sets INTEGER NOT NULL,
  ab_rest_seconds INTEGER NOT NULL,
  workout_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leg_workout_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Exercise progress policies
CREATE POLICY "Users can view their own exercise progress" ON public.exercise_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own exercise progress" ON public.exercise_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own exercise progress" ON public.exercise_progress FOR UPDATE USING (auth.uid() = user_id);

-- Workout sessions policies
CREATE POLICY "Users can view their own workout sessions" ON public.workout_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own workout sessions" ON public.workout_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Leg workout logs policies
CREATE POLICY "Users can view their own leg workout logs" ON public.leg_workout_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own leg workout logs" ON public.leg_workout_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_exercise_progress_updated_at BEFORE UPDATE ON public.exercise_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();