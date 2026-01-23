-- Create library item types enum
CREATE TYPE library_item_type AS ENUM ('book', 'journal', 'digital', 'magazine', 'reference');

-- Create borrowing status enum
CREATE TYPE borrowing_status AS ENUM ('borrowed', 'returned', 'overdue');

-- Create fine status enum
CREATE TYPE fine_status AS ENUM ('pending', 'paid', 'waived');

-- Library Categories Table
CREATE TABLE public.library_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- Library Items Table (Catalog)
CREATE TABLE public.library_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  category_id UUID REFERENCES public.library_categories(id),
  item_type library_item_type NOT NULL DEFAULT 'book',
  title TEXT NOT NULL,
  author TEXT,
  publisher TEXT,
  isbn TEXT,
  publication_year INTEGER,
  edition TEXT,
  total_copies INTEGER NOT NULL DEFAULT 1,
  available_copies INTEGER NOT NULL DEFAULT 1,
  location TEXT,
  digital_file_path TEXT,
  digital_resource_url TEXT,
  description TEXT,
  subject TEXT,
  language TEXT DEFAULT 'English',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Library Borrowing Records Table
CREATE TABLE public.library_borrowing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  library_item_id UUID NOT NULL REFERENCES public.library_items(id),
  borrower_id UUID NOT NULL,
  borrower_type TEXT NOT NULL DEFAULT 'trainee',
  borrow_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  return_date DATE,
  status borrowing_status NOT NULL DEFAULT 'borrowed',
  issued_by UUID NOT NULL,
  returned_to UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Library Fines Table
CREATE TABLE public.library_fines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  borrowing_id UUID NOT NULL REFERENCES public.library_borrowing(id),
  borrower_id UUID NOT NULL,
  fine_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance NUMERIC(10,2),
  days_overdue INTEGER NOT NULL DEFAULT 0,
  status fine_status NOT NULL DEFAULT 'pending',
  payment_date DATE,
  waived_by UUID,
  waive_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for better performance
CREATE INDEX idx_library_items_org ON public.library_items(organization_id);
CREATE INDEX idx_library_items_category ON public.library_items(category_id);
CREATE INDEX idx_library_items_type ON public.library_items(item_type);
CREATE INDEX idx_library_items_search ON public.library_items(title, author, subject);
CREATE INDEX idx_library_borrowing_org ON public.library_borrowing(organization_id);
CREATE INDEX idx_library_borrowing_item ON public.library_borrowing(library_item_id);
CREATE INDEX idx_library_borrowing_borrower ON public.library_borrowing(borrower_id);
CREATE INDEX idx_library_borrowing_status ON public.library_borrowing(status);
CREATE INDEX idx_library_fines_org ON public.library_fines(organization_id);
CREATE INDEX idx_library_fines_borrower ON public.library_fines(borrower_id);
CREATE INDEX idx_library_fines_status ON public.library_fines(status);

-- Enable RLS
ALTER TABLE public.library_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_borrowing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_fines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for library_categories
CREATE POLICY "Users can view categories in their organization"
  ON public.library_categories FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins can manage categories"
  ON public.library_categories FOR ALL
  USING (
    is_admin(auth.uid()) AND 
    organization_id = get_user_organization(auth.uid())
  );

-- RLS Policies for library_items
CREATE POLICY "Users can view items in their organization"
  ON public.library_items FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Admins and librarians can manage items"
  ON public.library_items FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'librarian'::app_role)) AND 
    organization_id = get_user_organization(auth.uid())
  );

-- RLS Policies for library_borrowing
CREATE POLICY "Users can view borrowing records in their organization"
  ON public.library_borrowing FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Librarians and admins can manage borrowing"
  ON public.library_borrowing FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'librarian'::app_role)) AND 
    organization_id = get_user_organization(auth.uid())
  );

-- RLS Policies for library_fines
CREATE POLICY "Users can view fines in their organization"
  ON public.library_fines FOR SELECT
  USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Librarians and admins can manage fines"
  ON public.library_fines FOR ALL
  USING (
    (is_admin(auth.uid()) OR has_role(auth.uid(), 'librarian'::app_role)) AND 
    organization_id = get_user_organization(auth.uid())
  );

-- Trigger for updated_at
CREATE TRIGGER update_library_categories_updated_at
  BEFORE UPDATE ON public.library_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_library_items_updated_at
  BEFORE UPDATE ON public.library_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_library_borrowing_updated_at
  BEFORE UPDATE ON public.library_borrowing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_library_fines_updated_at
  BEFORE UPDATE ON public.library_fines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update available copies when borrowing
CREATE OR REPLACE FUNCTION public.update_library_item_copies()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'borrowed' THEN
    UPDATE public.library_items
    SET available_copies = available_copies - 1
    WHERE id = NEW.library_item_id AND available_copies > 0;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'borrowed' AND NEW.status = 'returned' THEN
    UPDATE public.library_items
    SET available_copies = available_copies + 1
    WHERE id = NEW.library_item_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_library_copies
  AFTER INSERT OR UPDATE ON public.library_borrowing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_library_item_copies();

-- Function to calculate fine balance
CREATE OR REPLACE FUNCTION public.calculate_fine_balance()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.balance := NEW.fine_amount - NEW.amount_paid;
  
  IF NEW.balance <= 0 AND NEW.status = 'pending' THEN
    NEW.status := 'paid';
    NEW.payment_date := CURRENT_DATE;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_calculate_fine_balance
  BEFORE INSERT OR UPDATE ON public.library_fines
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_fine_balance();