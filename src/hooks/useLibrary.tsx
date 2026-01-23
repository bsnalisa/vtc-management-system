import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganizationContext } from "./useOrganizationContext";
import { Database } from "@/integrations/supabase/types";

type LibraryCategory = Database['public']['Tables']['library_categories']['Row'];
type LibraryItem = Database['public']['Tables']['library_items']['Row'];
type LibraryBorrowing = Database['public']['Tables']['library_borrowing']['Row'];
type LibraryFine = Database['public']['Tables']['library_fines']['Row'];

type NewLibraryCategory = Database['public']['Tables']['library_categories']['Insert'];
type NewLibraryItem = Database['public']['Tables']['library_items']['Insert'];
type NewLibraryBorrowing = Database['public']['Tables']['library_borrowing']['Insert'];
type NewLibraryFine = Database['public']['Tables']['library_fines']['Insert'];

type UpdateLibraryCategory = Database['public']['Tables']['library_categories']['Update'];
type UpdateLibraryItem = Database['public']['Tables']['library_items']['Update'];
type UpdateLibraryBorrowing = Database['public']['Tables']['library_borrowing']['Update'];
type UpdateLibraryFine = Database['public']['Tables']['library_fines']['Update'];

// Library Categories Hooks
export const useLibraryCategories = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["library-categories", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("library_categories")
        .select("*")
        .eq("organization_id", organizationId!)
        .order("name");

      if (error) throw error;
      return data as LibraryCategory[];
    },
    enabled: !!organizationId,
  });
};

export const useCreateLibraryCategory = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (category: Omit<NewLibraryCategory, 'organization_id'>) => {
      const { data, error } = await supabase
        .from("library_categories")
        .insert({ ...category, organization_id: organizationId! })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-categories"] });
      toast.success("Category created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create category: ${error.message}`);
    },
  });
};

export const useUpdateLibraryCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateLibraryCategory & { id: string }) => {
      const { data, error } = await supabase
        .from("library_categories")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-categories"] });
      toast.success("Category updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update category: ${error.message}`);
    },
  });
};

// Library Items Hooks
export const useLibraryItems = (filters?: { category_id?: string; item_type?: Database['public']['Enums']['library_item_type']; search?: string }) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["library-items", organizationId, filters],
    queryFn: async () => {
      let query = supabase
        .from("library_items")
        .select("*, library_categories(name)")
        .eq("organization_id", organizationId!);

      if (filters?.category_id) {
        query = query.eq("category_id", filters.category_id);
      }

      if (filters?.item_type) {
        query = query.eq("item_type", filters.item_type);
      }

      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,author.ilike.%${filters.search}%,subject.ilike.%${filters.search}%`);
      }

      const { data, error } = await query.order("title");

      if (error) throw error;
      return data as (LibraryItem & { library_categories: { name: string } | null })[];
    },
    enabled: !!organizationId,
  });
};

export const useCreateLibraryItem = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (item: Omit<NewLibraryItem, 'organization_id'>) => {
      const { data, error } = await supabase
        .from("library_items")
        .insert({ ...item, organization_id: organizationId! })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-items"] });
      toast.success("Library item created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create item: ${error.message}`);
    },
  });
};

export const useUpdateLibraryItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateLibraryItem & { id: string }) => {
      const { data, error } = await supabase
        .from("library_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-items"] });
      toast.success("Library item updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update item: ${error.message}`);
    },
  });
};

// Library Borrowing Hooks
export const useLibraryBorrowing = (filters?: { status?: Database['public']['Enums']['borrowing_status']; borrower_id?: string }) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["library-borrowing", organizationId, filters],
    queryFn: async () => {
      let query = supabase
        .from("library_borrowing")
        .select("*, library_items(title, item_type)")
        .eq("organization_id", organizationId!);

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      if (filters?.borrower_id) {
        query = query.eq("borrower_id", filters.borrower_id);
      }

      const { data, error } = await query.order("borrow_date", { ascending: false });

      if (error) throw error;
      return data as (LibraryBorrowing & { library_items: { title: string; item_type: string } })[];
    },
    enabled: !!organizationId,
  });
};

export const useCreateLibraryBorrowing = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (borrowing: Omit<NewLibraryBorrowing, 'organization_id'>) => {
      const { data, error } = await supabase
        .from("library_borrowing")
        .insert({ ...borrowing, organization_id: organizationId! })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-borrowing"] });
      queryClient.invalidateQueries({ queryKey: ["library-items"] });
      toast.success("Item borrowed successfully");
    },
    onError: (error) => {
      toast.error(`Failed to borrow item: ${error.message}`);
    },
  });
};

export const useReturnLibraryItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, returned_to }: { id: string; returned_to: string }) => {
      const { data, error } = await supabase
        .from("library_borrowing")
        .update({ 
          status: 'returned', 
          return_date: new Date().toISOString().split('T')[0],
          returned_to 
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-borrowing"] });
      queryClient.invalidateQueries({ queryKey: ["library-items"] });
      toast.success("Item returned successfully");
    },
    onError: (error) => {
      toast.error(`Failed to return item: ${error.message}`);
    },
  });
};

// Library Fines Hooks
export const useLibraryFines = (filters?: { status?: Database['public']['Enums']['fine_status']; borrower_id?: string }) => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["library-fines", organizationId, filters],
    queryFn: async () => {
      let query = supabase
        .from("library_fines")
        .select("*, library_borrowing(library_item_id, library_items(title))")
        .eq("organization_id", organizationId!);

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      if (filters?.borrower_id) {
        query = query.eq("borrower_id", filters.borrower_id);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return data as LibraryFine[];
    },
    enabled: !!organizationId,
  });
};

export const useCreateLibraryFine = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (fine: Omit<NewLibraryFine, 'organization_id'>) => {
      const { data, error } = await supabase
        .from("library_fines")
        .insert({ ...fine, organization_id: organizationId! })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-fines"] });
      toast.success("Fine created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create fine: ${error.message}`);
    },
  });
};

export const usePayLibraryFine = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const { data: fine } = await supabase
        .from("library_fines")
        .select("amount_paid")
        .eq("id", id)
        .single();

      const newAmountPaid = (fine?.amount_paid || 0) + amount;

      const { data, error } = await supabase
        .from("library_fines")
        .update({ amount_paid: newAmountPaid })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-fines"] });
      toast.success("Payment recorded successfully");
    },
    onError: (error) => {
      toast.error(`Failed to record payment: ${error.message}`);
    },
  });
};

export const useWaiveLibraryFine = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, waived_by, waive_reason }: { id: string; waived_by: string; waive_reason: string }) => {
      const { data, error } = await supabase
        .from("library_fines")
        .update({ 
          status: 'waived',
          waived_by,
          waive_reason
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-fines"] });
      toast.success("Fine waived successfully");
    },
    onError: (error) => {
      toast.error(`Failed to waive fine: ${error.message}`);
    },
  });
};
