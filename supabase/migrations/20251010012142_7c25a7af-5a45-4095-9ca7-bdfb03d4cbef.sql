-- Create enum types for the system
CREATE TYPE public.app_role AS ENUM ('admin', 'registration_officer', 'debtor_officer', 'trainer', 'hod', 'viewer');
CREATE TYPE public.gender AS ENUM ('male', 'female', 'other');
CREATE TYPE public.training_mode AS ENUM ('fulltime', 'bdl', 'shortcourse');
CREATE TYPE public.trainee_status AS ENUM ('active', 'completed', 'deferred', 'withdrawn');
CREATE TYPE public.employment_type AS ENUM ('fulltime', 'parttime', 'contract');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (CRITICAL: separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create trades/programs table
CREATE TABLE public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create trainers table
CREATE TABLE public.trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  gender gender NOT NULL,
  phone TEXT,
  email TEXT,
  designation TEXT,
  employment_type employment_type NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create trainer_trades junction table
CREATE TABLE public.trainer_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID REFERENCES public.trainers(id) ON DELETE CASCADE NOT NULL,
  trade_id UUID REFERENCES public.trades(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trainer_id, trade_id)
);

-- Create trainees table
CREATE TABLE public.trainees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  gender gender NOT NULL,
  date_of_birth DATE NOT NULL,
  national_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT NOT NULL,
  trade_id UUID REFERENCES public.trades(id) NOT NULL,
  training_mode training_mode NOT NULL,
  level INTEGER NOT NULL CHECK (level >= 1 AND level <= 5),
  academic_year TEXT NOT NULL,
  status trainee_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create fee_records table
CREATE TABLE public.fee_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id UUID REFERENCES public.trainees(id) ON DELETE CASCADE NOT NULL,
  total_fee DECIMAL(10, 2) NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0,
  balance DECIMAL(10, 2) GENERATED ALWAYS AS (total_fee - amount_paid) STORED,
  academic_year TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_record_id UUID REFERENCES public.fee_records(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  reference_number TEXT,
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create attendance_registers table
CREATE TABLE public.attendance_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID REFERENCES public.trades(id) NOT NULL,
  trainer_id UUID REFERENCES public.trainers(id) NOT NULL,
  level INTEGER NOT NULL CHECK (level >= 1 AND level <= 5),
  training_mode training_mode NOT NULL,
  academic_year TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create attendance_records table
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id UUID REFERENCES public.attendance_registers(id) ON DELETE CASCADE NOT NULL,
  trainee_id UUID REFERENCES public.trainees(id) ON DELETE CASCADE NOT NULL,
  attendance_date DATE NOT NULL,
  present BOOLEAN NOT NULL DEFAULT false,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(register_id, trainee_id, attendance_date)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Create security definer functions for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Create RLS policies for user_roles
CREATE POLICY "Admins can manage user roles"
  ON public.user_roles FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Create RLS policies for trades
CREATE POLICY "Everyone can view trades"
  ON public.trades FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage trades"
  ON public.trades FOR ALL
  USING (public.is_admin(auth.uid()));

-- Create RLS policies for trainers
CREATE POLICY "Authenticated users can view trainers"
  ON public.trainers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and registration officers can manage trainers"
  ON public.trainers FOR ALL
  USING (
    public.is_admin(auth.uid()) OR 
    public.has_role(auth.uid(), 'registration_officer')
  );

-- Create RLS policies for trainer_trades
CREATE POLICY "Authenticated users can view trainer trades"
  ON public.trainer_trades FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage trainer trades"
  ON public.trainer_trades FOR ALL
  USING (public.is_admin(auth.uid()));

-- Create RLS policies for trainees
CREATE POLICY "Authenticated users can view trainees"
  ON public.trainees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Registration officers and admins can manage trainees"
  ON public.trainees FOR ALL
  USING (
    public.is_admin(auth.uid()) OR 
    public.has_role(auth.uid(), 'registration_officer')
  );

-- Create RLS policies for fee_records
CREATE POLICY "Authenticated users can view fee records"
  ON public.fee_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Debtor officers and admins can manage fee records"
  ON public.fee_records FOR ALL
  USING (
    public.is_admin(auth.uid()) OR 
    public.has_role(auth.uid(), 'debtor_officer')
  );

-- Create RLS policies for payments
CREATE POLICY "Authenticated users can view payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Debtor officers and admins can record payments"
  ON public.payments FOR INSERT
  WITH CHECK (
    public.is_admin(auth.uid()) OR 
    public.has_role(auth.uid(), 'debtor_officer')
  );

-- Create RLS policies for attendance_registers
CREATE POLICY "Authenticated users can view attendance registers"
  ON public.attendance_registers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Trainers and admins can create attendance registers"
  ON public.attendance_registers FOR INSERT
  WITH CHECK (
    public.is_admin(auth.uid()) OR 
    public.has_role(auth.uid(), 'trainer')
  );

-- Create RLS policies for attendance_records
CREATE POLICY "Authenticated users can view attendance records"
  ON public.attendance_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Trainers and admins can manage attendance records"
  ON public.attendance_records FOR ALL
  USING (
    public.is_admin(auth.uid()) OR 
    public.has_role(auth.uid(), 'trainer')
  );

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trades_updated_at
  BEFORE UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trainers_updated_at
  BEFORE UPDATE ON public.trainers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trainees_updated_at
  BEFORE UPDATE ON public.trainees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fee_records_updated_at
  BEFORE UPDATE ON public.fee_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default trades
INSERT INTO public.trades (name, code, description) VALUES
  ('Information & Communication Technology', 'ICT', 'Computer systems, networking, and software development'),
  ('Electrical Engineering', 'ELEC', 'Electrical installations, wiring, and maintenance'),
  ('Plumbing', 'PLUMB', 'Water supply, drainage, and sanitation systems'),
  ('Carpentry & Joinery', 'CARP', 'Woodworking, furniture making, and construction'),
  ('Automotive Mechanics', 'AUTO', 'Vehicle repair, maintenance, and diagnostics'),
  ('Welding & Fabrication', 'WELD', 'Metal joining and fabrication techniques'),
  ('Hospitality Management', 'HOSP', 'Hotel and restaurant management'),
  ('Agriculture', 'AGRI', 'Farming, crop production, and livestock management');

-- Function to generate unique trainee ID
CREATE OR REPLACE FUNCTION public.generate_trainee_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_id TEXT;
  year_suffix TEXT;
  counter INTEGER;
BEGIN
  year_suffix := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(trainee_id FROM 7) AS INTEGER)), 0) + 1
  INTO counter
  FROM public.trainees
  WHERE trainee_id LIKE 'NV' || year_suffix || '%';
  
  new_id := 'NV' || year_suffix || LPAD(counter::TEXT, 4, '0');
  
  RETURN new_id;
END;
$$;