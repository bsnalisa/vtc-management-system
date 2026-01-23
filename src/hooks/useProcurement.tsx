import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";
import { toast } from "sonner";

// Suppliers
export interface Supplier {
  id: string;
  organization_id: string;
  name: string;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  tax_number: string | null;
  address: string | null;
  payment_terms: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const useSuppliers = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["suppliers", organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error("Organization ID required");

      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("active", true)
        .order("name");

      if (error) throw error;
      return data as Supplier[];
    },
    enabled: !!organizationId,
  });
};

export const useCreateSupplier = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (supplier: Omit<Supplier, "id" | "organization_id" | "created_at" | "updated_at">) => {
      if (!organizationId) throw new Error("Organization ID required");

      const { data, error } = await supabase
        .from("suppliers")
        .insert({ ...supplier, organization_id: organizationId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create supplier: ${error.message}`);
    },
  });
};

export const useUpdateSupplier = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Supplier> & { id: string }) => {
      const { data, error } = await supabase
        .from("suppliers")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update supplier: ${error.message}`);
    },
  });
};

// Purchase Requisitions
export interface PurchaseRequisition {
  id: string;
  organization_id: string;
  requisition_number: string;
  requested_by: string;
  requested_date: string;
  department: string | null;
  justification: string | null;
  status: string;
  approved_by: string | null;
  approved_date: string | null;
  rejected_reason: string | null;
  created_at: string;
  updated_at: string;
}

export const usePurchaseRequisitions = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["purchase-requisitions", organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error("Organization ID required");

      const { data, error } = await supabase
        .from("purchase_requisitions")
        .select("*")
        .eq("organization_id", organizationId)
        .order("requested_date", { ascending: false });

      if (error) throw error;
      return data as PurchaseRequisition[];
    },
    enabled: !!organizationId,
  });
};

export const useCreatePurchaseRequisition = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (requisition: Omit<PurchaseRequisition, "id" | "organization_id" | "created_at" | "updated_at">) => {
      if (!organizationId) throw new Error("Organization ID required");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("purchase_requisitions")
        .insert({ 
          ...requisition, 
          organization_id: organizationId,
          requested_by: user.id 
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-requisitions"] });
      toast.success("Purchase requisition created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create requisition: ${error.message}`);
    },
  });
};

export const useUpdatePurchaseRequisition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PurchaseRequisition> & { id: string }) => {
      const { data, error } = await supabase
        .from("purchase_requisitions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-requisitions"] });
      toast.success("Requisition updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update requisition: ${error.message}`);
    },
  });
};

// Purchase Orders
export interface PurchaseOrder {
  id: string;
  organization_id: string;
  po_number: string;
  requisition_id: string | null;
  supplier_id: string;
  order_date: string;
  expected_delivery_date: string | null;
  status: string;
  subtotal: number;
  tax_amount: number;
  grand_total: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  suppliers?: {
    name: string;
  };
}

export const usePurchaseOrders = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["purchase-orders", organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error("Organization ID required");

      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          suppliers (
            name
          )
        `)
        .eq("organization_id", organizationId)
        .order("order_date", { ascending: false });

      if (error) throw error;
      return data as PurchaseOrder[];
    },
    enabled: !!organizationId,
  });
};

export const useCreatePurchaseOrder = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (order: Omit<PurchaseOrder, "id" | "organization_id" | "created_at" | "updated_at" | "suppliers">) => {
      if (!organizationId) throw new Error("Organization ID required");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("purchase_orders")
        .insert({ 
          ...order, 
          organization_id: organizationId,
          created_by: user.id 
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Purchase order created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create purchase order: ${error.message}`);
    },
  });
};

export const useUpdatePurchaseOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PurchaseOrder> & { id: string }) => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      toast.success("Purchase order updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update purchase order: ${error.message}`);
    },
  });
};

// Department Budgets
export interface DepartmentBudget {
  id: string;
  organization_id: string;
  department: string;
  budget_year: string;
  total_budget: number;
  spent_amount: number;
  remaining_amount: number;
  created_at: string;
  updated_at: string;
}

export const useDepartmentBudgets = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["department-budgets", organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error("Organization ID required");

      const { data, error } = await supabase
        .from("department_budgets")
        .select("*")
        .eq("organization_id", organizationId)
        .order("department");

      if (error) throw error;
      return data as DepartmentBudget[];
    },
    enabled: !!organizationId,
  });
};

// Purchase Requisition Items
export interface PurchaseRequisitionItem {
  id: string;
  requisition_id: string;
  stock_item_id: string | null;
  item_description: string;
  quantity: number;
  estimated_unit_cost: number;
  total_estimated_cost: number | null;
  created_at: string;
}

export const useRequisitionItems = (requisitionId: string | null) => {
  return useQuery({
    queryKey: ["requisition-items", requisitionId],
    queryFn: async () => {
      if (!requisitionId) throw new Error("Requisition ID required");

      const { data, error } = await supabase
        .from("purchase_requisition_items")
        .select("*")
        .eq("requisition_id", requisitionId)
        .order("created_at");

      if (error) throw error;
      return data as PurchaseRequisitionItem[];
    },
    enabled: !!requisitionId,
  });
};

export const useCreateRequisitionItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: {
      requisition_id: string;
      stock_item_id: string | null;
      item_description: string;
      quantity: number;
      estimated_unit_cost: number;
      total_estimated_cost: number | null;
    }) => {
      const { data, error } = await supabase
        .from("purchase_requisition_items")
        .insert(item)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requisition-items"] });
      toast.success("Item added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add item: ${error.message}`);
    },
  });
};

export const useDeleteRequisitionItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("purchase_requisition_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requisition-items"] });
      toast.success("Item removed successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove item: ${error.message}`);
    },
  });
};

// Purchase Order Items
export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  stock_item_id: string | null;
  item_description: string;
  quantity_ordered: number;
  unit_cost: number;
  total_cost: number | null;
  quantity_received: number;
  notes: string | null;
  created_at: string;
}

export const usePurchaseOrderItems = (orderId: string | null) => {
  return useQuery({
    queryKey: ["purchase-order-items", orderId],
    queryFn: async () => {
      if (!orderId) throw new Error("Order ID required");

      const { data, error } = await supabase
        .from("purchase_order_items")
        .select("*")
        .eq("purchase_order_id", orderId)
        .order("created_at");

      if (error) throw error;
      return data as PurchaseOrderItem[];
    },
    enabled: !!orderId,
  });
};

export const useCreatePurchaseOrderItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: {
      purchase_order_id: string;
      stock_item_id: string | null;
      item_description: string;
      quantity_ordered: number;
      unit_cost: number;
      total_cost: number | null;
      notes: string | null;
    }) => {
      const { data, error } = await supabase
        .from("purchase_order_items")
        .insert(item)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-order-items"] });
      toast.success("Item added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add item: ${error.message}`);
    },
  });
};

export const useDeletePurchaseOrderItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("purchase_order_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-order-items"] });
      toast.success("Item removed successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove item: ${error.message}`);
    },
  });
};

// Receiving Reports
export interface ReceivingReport {
  id: string;
  organization_id: string;
  purchase_order_id: string;
  receipt_number: string;
  received_date: string;
  received_by: string;
  inspection_status: string;
  inspector_notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useReceivingReports = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["receiving-reports", organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error("Organization ID required");

      const { data, error } = await supabase
        .from("receiving_reports")
        .select(`
          *,
          purchase_orders (
            po_number,
            suppliers (
              name
            )
          )
        `)
        .eq("organization_id", organizationId)
        .order("received_date", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
};

export const useCreateReceivingReport = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (report: Omit<ReceivingReport, "id" | "organization_id" | "created_at" | "updated_at">) => {
      if (!organizationId) throw new Error("Organization ID required");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("receiving_reports")
        .insert({ 
          ...report, 
          organization_id: organizationId,
          received_by: user.id 
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receiving-reports"] });
      toast.success("Receiving report created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create receiving report: ${error.message}`);
    },
  });
};

export const useUpdateReceivingReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ReceivingReport> & { id: string }) => {
      const { data, error } = await supabase
        .from("receiving_reports")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receiving-reports"] });
      toast.success("Receiving report updated successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update receiving report: ${error.message}`);
    },
  });
};

// Receiving Report Items
export interface ReceivingReportItem {
  id: string;
  receiving_report_id: string;
  po_item_id: string;
  quantity_received: number;
  quantity_accepted: number;
  quantity_rejected: number;
  condition_notes: string | null;
  created_at: string;
}

export const useReceivingReportItems = (reportId: string | null) => {
  return useQuery({
    queryKey: ["receiving-report-items", reportId],
    queryFn: async () => {
      if (!reportId) throw new Error("Report ID required");

      const { data, error } = await supabase
        .from("receiving_report_items")
        .select(`
          *,
          purchase_order_items (
            item_description,
            quantity_ordered,
            unit_cost
          )
        `)
        .eq("receiving_report_id", reportId)
        .order("created_at");

      if (error) throw error;
      return data;
    },
    enabled: !!reportId,
  });
};

export const useCreateReceivingReportItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: {
      receiving_report_id: string;
      po_item_id: string;
      quantity_received: number;
      quantity_accepted: number;
      quantity_rejected: number;
      condition_notes: string | null;
    }) => {
      const { data, error } = await supabase
        .from("receiving_report_items")
        .insert(item)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receiving-report-items"] });
      toast.success("Item added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add item: ${error.message}`);
    },
  });
};
