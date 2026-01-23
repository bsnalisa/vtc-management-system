import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

export interface Invoice {
  id: string;
  organization_id: string;
  invoice_number: string;
  trainee_id: string | null;
  fee_record_id: string | null;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  balance: number;
  status: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  trainees?: { trainee_id: string; first_name: string; last_name: string };
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface CreateInvoiceData {
  trainee_id?: string;
  fee_record_id?: string;
  due_date: string;
  items: { description: string; quantity: number; unit_price: number }[];
  notes?: string;
}

export const useInvoices = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["invoices", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          trainees (trainee_id, first_name, last_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!organizationId,
  });
};

export const useCreateInvoice = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (data: CreateInvoiceData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !organizationId) throw new Error("Not authenticated");

      // Generate invoice number
      const { data: invoiceNumber } = await supabase
        .rpc("generate_invoice_number", { _org_id: organizationId });

      const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
      const taxAmount = subtotal * 0.15; // 15% VAT
      const totalAmount = subtotal + taxAmount;

      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert({
          organization_id: organizationId,
          invoice_number: invoiceNumber,
          trainee_id: data.trainee_id,
          fee_record_id: data.fee_record_id,
          due_date: data.due_date,
          subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          notes: data.notes,
          created_by: user.id,
          status: 'issued',
        })
        .select()
        .single();

      if (error) throw error;

      // Create invoice items
      const items = data.items.map(item => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }));

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(items);

      if (itemsError) throw itemsError;

      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "Invoice created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useInvoiceItems = (invoiceId: string) => {
  return useQuery({
    queryKey: ["invoice-items", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId);

      if (error) throw error;
      return data as InvoiceItem[];
    },
    enabled: !!invoiceId,
  });
};

export const useUpdateInvoiceStatus = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("invoices")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast({ title: "Invoice status updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};
