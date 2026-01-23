-- Create enums for hostel module
CREATE TYPE gender_type AS ENUM ('male', 'female', 'mixed');
CREATE TYPE room_type AS ENUM ('single', 'double', 'dormitory', 'suite');
CREATE TYPE room_status AS ENUM ('available', 'occupied', 'maintenance', 'reserved');
CREATE TYPE bed_status AS ENUM ('available', 'occupied', 'reserved', 'maintenance');
CREATE TYPE allocation_status AS ENUM ('active', 'checked_out', 'pending', 'cancelled');
CREATE TYPE hostel_maintenance_status AS ENUM ('reported', 'in_progress', 'completed', 'cancelled');

-- Hostel Buildings Table
CREATE TABLE public.hostel_buildings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  building_name TEXT NOT NULL,
  building_code TEXT NOT NULL,
  location TEXT,
  gender_type gender_type NOT NULL,
  total_floors INTEGER NOT NULL DEFAULT 1,
  total_rooms INTEGER NOT NULL DEFAULT 0,
  total_capacity INTEGER NOT NULL DEFAULT 0,
  current_occupancy INTEGER NOT NULL DEFAULT 0,
  warden_name TEXT,
  warden_contact TEXT,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, building_code)
);

-- Hostel Rooms Table
CREATE TABLE public.hostel_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  building_id UUID NOT NULL REFERENCES public.hostel_buildings(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  floor_number INTEGER NOT NULL,
  room_type room_type NOT NULL DEFAULT 'dormitory',
  gender_type gender_type NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1,
  current_occupancy INTEGER NOT NULL DEFAULT 0,
  status room_status NOT NULL DEFAULT 'available',
  monthly_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  amenities TEXT[],
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(building_id, room_number)
);

-- Hostel Beds Table
CREATE TABLE public.hostel_beds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  room_id UUID NOT NULL REFERENCES public.hostel_rooms(id) ON DELETE CASCADE,
  bed_number TEXT NOT NULL,
  status bed_status NOT NULL DEFAULT 'available',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id, bed_number)
);

-- Hostel Allocations Table
CREATE TABLE public.hostel_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  trainee_id UUID NOT NULL,
  bed_id UUID NOT NULL REFERENCES public.hostel_beds(id),
  room_id UUID NOT NULL REFERENCES public.hostel_rooms(id),
  building_id UUID NOT NULL REFERENCES public.hostel_buildings(id),
  check_in_date DATE NOT NULL,
  expected_check_out_date DATE,
  actual_check_out_date DATE,
  status allocation_status NOT NULL DEFAULT 'active',
  allocated_by UUID NOT NULL,
  checked_out_by UUID,
  monthly_fee NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Hostel Fees Table
CREATE TABLE public.hostel_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  trainee_id UUID NOT NULL,
  allocation_id UUID REFERENCES public.hostel_allocations(id),
  fee_month DATE NOT NULL,
  fee_amount NUMERIC(10,2) NOT NULL,
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance NUMERIC(10,2),
  payment_status TEXT NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL,
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Hostel Maintenance Issues Table
CREATE TABLE public.hostel_maintenance_issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  building_id UUID REFERENCES public.hostel_buildings(id),
  room_id UUID REFERENCES public.hostel_rooms(id),
  issue_number TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status hostel_maintenance_status NOT NULL DEFAULT 'reported',
  reported_by UUID NOT NULL,
  reported_date DATE NOT NULL DEFAULT CURRENT_DATE,
  assigned_to UUID,
  resolved_date DATE,
  resolution_notes TEXT,
  estimated_cost NUMERIC(10,2),
  actual_cost NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_hostel_buildings_org ON public.hostel_buildings(organization_id);
CREATE INDEX idx_hostel_rooms_building ON public.hostel_rooms(building_id);
CREATE INDEX idx_hostel_rooms_status ON public.hostel_rooms(status);
CREATE INDEX idx_hostel_beds_room ON public.hostel_beds(room_id);
CREATE INDEX idx_hostel_beds_status ON public.hostel_beds(status);
CREATE INDEX idx_hostel_allocations_trainee ON public.hostel_allocations(trainee_id);
CREATE INDEX idx_hostel_allocations_status ON public.hostel_allocations(status);
CREATE INDEX idx_hostel_fees_trainee ON public.hostel_fees(trainee_id);
CREATE INDEX idx_hostel_fees_status ON public.hostel_fees(payment_status);
CREATE INDEX idx_hostel_maintenance_status ON public.hostel_maintenance_issues(status);

-- Enable RLS
ALTER TABLE public.hostel_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_maintenance_issues ENABLE ROW LEVEL SECURITY;

-- RLS Policies for hostel_buildings
CREATE POLICY "Users can view buildings in their organization"
  ON public.hostel_buildings FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins and coordinators can manage buildings"
  ON public.hostel_buildings FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'hostel_coordinator'::app_role)) AND 
    organization_id = get_user_organization(auth.uid())
  );

-- RLS Policies for hostel_rooms
CREATE POLICY "Users can view rooms in their organization"
  ON public.hostel_rooms FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins and coordinators can manage rooms"
  ON public.hostel_rooms FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'hostel_coordinator'::app_role)) AND 
    organization_id = get_user_organization(auth.uid())
  );

-- RLS Policies for hostel_beds
CREATE POLICY "Users can view beds in their organization"
  ON public.hostel_beds FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins and coordinators can manage beds"
  ON public.hostel_beds FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'hostel_coordinator'::app_role)) AND 
    organization_id = get_user_organization(auth.uid())
  );

-- RLS Policies for hostel_allocations
CREATE POLICY "Users can view allocations in their organization"
  ON public.hostel_allocations FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins and coordinators can manage allocations"
  ON public.hostel_allocations FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'hostel_coordinator'::app_role)) AND 
    organization_id = get_user_organization(auth.uid())
  );

-- RLS Policies for hostel_fees
CREATE POLICY "Users can view fees in their organization"
  ON public.hostel_fees FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins and coordinators can manage fees"
  ON public.hostel_fees FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'hostel_coordinator'::app_role)) AND 
    organization_id = get_user_organization(auth.uid())
  );

-- RLS Policies for hostel_maintenance_issues
CREATE POLICY "Users can view maintenance issues in their organization"
  ON public.hostel_maintenance_issues FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Coordinators and admins can manage maintenance issues"
  ON public.hostel_maintenance_issues FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'hostel_coordinator'::app_role)) AND 
    organization_id = get_user_organization(auth.uid())
  );

-- Triggers for updated_at
CREATE TRIGGER update_hostel_buildings_updated_at
  BEFORE UPDATE ON public.hostel_buildings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hostel_rooms_updated_at
  BEFORE UPDATE ON public.hostel_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hostel_beds_updated_at
  BEFORE UPDATE ON public.hostel_beds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hostel_allocations_updated_at
  BEFORE UPDATE ON public.hostel_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hostel_fees_updated_at
  BEFORE UPDATE ON public.hostel_fees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hostel_maintenance_issues_updated_at
  BEFORE UPDATE ON public.hostel_maintenance_issues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update occupancy when allocating bed
CREATE OR REPLACE FUNCTION public.update_hostel_occupancy()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    -- Update bed status
    UPDATE public.hostel_beds
    SET status = 'occupied'
    WHERE id = NEW.bed_id;
    
    -- Update room occupancy
    UPDATE public.hostel_rooms
    SET current_occupancy = current_occupancy + 1,
        status = CASE 
          WHEN current_occupancy + 1 >= capacity THEN 'occupied'::room_status
          ELSE status
        END
    WHERE id = NEW.room_id;
    
    -- Update building occupancy
    UPDATE public.hostel_buildings
    SET current_occupancy = current_occupancy + 1
    WHERE id = NEW.building_id;
    
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status = 'checked_out' THEN
    -- Update bed status
    UPDATE public.hostel_beds
    SET status = 'available'
    WHERE id = NEW.bed_id;
    
    -- Update room occupancy
    UPDATE public.hostel_rooms
    SET current_occupancy = current_occupancy - 1,
        status = CASE 
          WHEN current_occupancy - 1 = 0 THEN 'available'::room_status
          ELSE status
        END
    WHERE id = NEW.room_id;
    
    -- Update building occupancy
    UPDATE public.hostel_buildings
    SET current_occupancy = current_occupancy - 1
    WHERE id = NEW.building_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_hostel_occupancy
  AFTER INSERT OR UPDATE ON public.hostel_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_hostel_occupancy();

-- Function to calculate hostel fee balance
CREATE OR REPLACE FUNCTION public.calculate_hostel_fee_balance()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.balance := NEW.fee_amount - NEW.amount_paid;
  
  IF NEW.balance <= 0 THEN
    NEW.payment_status := 'paid';
    IF NEW.paid_date IS NULL THEN
      NEW.paid_date := CURRENT_DATE;
    END IF;
  ELSIF NEW.balance < NEW.fee_amount THEN
    NEW.payment_status := 'partial';
  ELSE
    NEW.payment_status := 'pending';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_calculate_hostel_fee_balance
  BEFORE INSERT OR UPDATE ON public.hostel_fees
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_hostel_fee_balance();