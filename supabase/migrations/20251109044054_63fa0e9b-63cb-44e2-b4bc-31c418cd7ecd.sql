-- Create training modules table
CREATE TABLE IF NOT EXISTS public.training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  duration_minutes INTEGER,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN DEFAULT true,
  role_specific TEXT[], -- Array of roles this module applies to
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create onboarding progress table
CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 1,
  profile_completed BOOLEAN DEFAULT false,
  training_started BOOLEAN DEFAULT false,
  training_completed BOOLEAN DEFAULT false,
  completed_modules UUID[] DEFAULT '{}',
  onboarding_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Create module completions tracking table
CREATE TABLE IF NOT EXISTS public.module_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  score INTEGER,
  feedback TEXT,
  UNIQUE(user_id, module_id)
);

-- Enable RLS
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for training_modules
CREATE POLICY "Training modules are viewable by authenticated users"
  ON public.training_modules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage training modules"
  ON public.training_modules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'organization_admin')
    )
  );

-- RLS Policies for onboarding_progress
CREATE POLICY "Users can view their own onboarding progress"
  ON public.onboarding_progress FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own onboarding progress"
  ON public.onboarding_progress FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own onboarding progress"
  ON public.onboarding_progress FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all onboarding progress"
  ON public.onboarding_progress FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'organization_admin')
    )
  );

-- RLS Policies for module_completions
CREATE POLICY "Users can view their own module completions"
  ON public.module_completions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own module completions"
  ON public.module_completions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all module completions"
  ON public.module_completions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'organization_admin')
    )
  );

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_training_modules_updated_at
  BEFORE UPDATE ON public.training_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_onboarding_progress_updated_at
  BEFORE UPDATE ON public.onboarding_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default training modules
INSERT INTO public.training_modules (title, description, content, duration_minutes, order_index, is_required, role_specific) VALUES
('Welcome & System Overview', 'Introduction to the VTC Management System and its core features', 'Learn about the VTC system, navigation, and basic functionalities that will help you succeed in your role.', 15, 1, true, '{}'),
('Security & Data Protection', 'Understanding security protocols and data protection requirements', 'Learn about password security, data handling, privacy policies, and your responsibilities in protecting sensitive information.', 20, 2, true, '{}'),
('Role & Responsibilities', 'Understanding your role and key responsibilities', 'Detailed overview of your specific role, daily tasks, and performance expectations.', 30, 3, true, '{}'),
('Communication Tools', 'Using the messaging and notification system effectively', 'Learn how to use internal messaging, notifications, and communication best practices.', 15, 4, true, '{}');