
-- Fix RLS on classes: allow head_of_training to manage classes
DROP POLICY IF EXISTS "Admins can manage classes" ON public.classes;
CREATE POLICY "Staff can manage classes"
ON public.classes FOR ALL
TO authenticated
USING (
  is_admin(auth.uid()) 
  OR has_role(auth.uid(), 'registration_officer'::app_role)
  OR has_role(auth.uid(), 'head_of_training'::app_role)
)
WITH CHECK (
  is_admin(auth.uid()) 
  OR has_role(auth.uid(), 'registration_officer'::app_role)
  OR has_role(auth.uid(), 'head_of_training'::app_role)
);

-- Create training_buildings table (separate from hostel_buildings)
CREATE TABLE IF NOT EXISTS public.training_buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  location TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Building-trade assignments (many-to-many)
CREATE TABLE IF NOT EXISTS public.building_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES public.training_buildings(id) ON DELETE CASCADE NOT NULL,
  trade_id UUID REFERENCES public.trades(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(building_id, trade_id)
);

-- Create room_type enum
DO $$ BEGIN
  CREATE TYPE public.training_room_type AS ENUM ('classroom', 'lab', 'workshop');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Training rooms inside buildings
CREATE TABLE IF NOT EXISTS public.training_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES public.training_buildings(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  room_type public.training_room_type NOT NULL DEFAULT 'classroom',
  capacity INTEGER DEFAULT 30,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.training_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.building_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_rooms ENABLE ROW LEVEL SECURITY;

-- RLS for training_buildings
CREATE POLICY "Users can view training buildings"
ON public.training_buildings FOR SELECT
TO authenticated
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "HoT and admins can manage training buildings"
ON public.training_buildings FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'head_of_training'::app_role))
)
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'head_of_training'::app_role))
);

-- RLS for building_trades
CREATE POLICY "Users can view building trades"
ON public.building_trades FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.training_buildings tb
    WHERE tb.id = building_id
    AND tb.organization_id = get_user_organization(auth.uid())
  )
);

CREATE POLICY "HoT and admins can manage building trades"
ON public.building_trades FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.training_buildings tb
    WHERE tb.id = building_id
    AND tb.organization_id = get_user_organization(auth.uid())
  )
  AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'head_of_training'::app_role))
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.training_buildings tb
    WHERE tb.id = building_id
    AND tb.organization_id = get_user_organization(auth.uid())
  )
  AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'head_of_training'::app_role))
);

-- RLS for training_rooms
CREATE POLICY "Users can view training rooms"
ON public.training_rooms FOR SELECT
TO authenticated
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "HoT and admins can manage training rooms"
ON public.training_rooms FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization(auth.uid())
  AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'head_of_training'::app_role))
)
WITH CHECK (
  organization_id = get_user_organization(auth.uid())
  AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'head_of_training'::app_role))
);
