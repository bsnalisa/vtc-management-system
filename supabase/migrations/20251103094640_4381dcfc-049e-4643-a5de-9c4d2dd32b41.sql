-- Create messages table for internal messaging
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE
);

-- Create system_audit_logs table for tracking system activity
CREATE TABLE public.system_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on messages table
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Messages policies
CREATE POLICY "Users can view their sent messages"
ON public.messages
FOR SELECT
USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "Users can send messages"
ON public.messages
FOR INSERT
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update their received messages"
ON public.messages
FOR UPDATE
USING (receiver_id = auth.uid());

-- Enable RLS on system_audit_logs
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit logs policies
CREATE POLICY "Super admins can view all audit logs"
ON public.system_audit_logs
FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Admins can view their organization audit logs"
ON public.system_audit_logs
FOR SELECT
USING (is_admin(auth.uid()) AND organization_id = get_user_organization(auth.uid()));

CREATE POLICY "System can insert audit logs"
ON public.system_audit_logs
FOR INSERT
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_receiver ON public.messages(receiver_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_audit_logs_user ON public.system_audit_logs(user_id);
CREATE INDEX idx_audit_logs_org ON public.system_audit_logs(organization_id);
CREATE INDEX idx_audit_logs_created_at ON public.system_audit_logs(created_at DESC);

-- Add trigger to update updated_at on messages
CREATE TRIGGER update_messages_updated_at
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action TEXT,
  _table_name TEXT DEFAULT NULL,
  _record_id UUID DEFAULT NULL,
  _old_data JSONB DEFAULT NULL,
  _new_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _log_id UUID;
  _org_id UUID;
BEGIN
  _org_id := get_user_organization(auth.uid());
  
  INSERT INTO public.system_audit_logs (
    user_id,
    organization_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) VALUES (
    auth.uid(),
    _org_id,
    _action,
    _table_name,
    _record_id,
    _old_data,
    _new_data
  )
  RETURNING id INTO _log_id;
  
  RETURN _log_id;
END;
$$;