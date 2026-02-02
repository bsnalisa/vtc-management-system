import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useEffect } from "react";

export interface FinancialAccount {
  id: string;
  organization_id: string;
  trainee_id: string | null;
  application_id: string | null;
  account_number: string;
  total_fees: number;
  total_paid: number;
  balance: number;
  status: 'active' | 'suspended' | 'closed';
  created_at: string;
  updated_at: string;
  trainees?: {
    id: string;
    trainee_id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
    trade_id: string | null;
    trades?: { name: string } | null;
  } | null;
  trainee_applications?: {
    id: string;
    trainee_number: string | null;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
    trade_id: string | null;
    trades?: { name: string } | null;
  } | null;
}

export interface FinancialTransaction {
  id: string;
  organization_id: string;
  account_id: string;
  fee_type_id: string | null;
  transaction_type: 'charge' | 'payment' | 'credit' | 'adjustment' | 'refund' | 'waiver';
  amount: number;
  balance_after: number;
  payment_method: string | null;
  reference_number: string | null;
  description: string | null;
  notes: string | null;
  academic_year: string | null;
  processed_by: string | null;
  processed_at: string;
  created_at: string;
  fee_types?: { name: string; code: string } | null;
}

export interface CreateTransactionData {
  account_id: string;
  fee_type_id?: string;
  transaction_type: 'charge' | 'payment' | 'credit' | 'adjustment' | 'refund' | 'waiver';
  amount: number;
  payment_method?: string;
  reference_number?: string;
  description?: string;
  notes?: string;
  academic_year?: string;
}

export const useFinancialAccounts = (filters?: {
  status?: string;
  search?: string;
  sortBy?: 'name' | 'balance' | 'date';
  sortOrder?: 'asc' | 'desc';
}) => {
  const { organizationId } = useOrganizationContext();
  const queryClient = useQueryClient();

  // Set up realtime subscription
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel('financial-accounts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trainee_financial_accounts',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['financial-accounts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);

  return useQuery({
    queryKey: ["financial-accounts", organizationId, filters],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("trainee_financial_accounts")
        .select(`
          *,
          trainees (
            id,
            trainee_id,
            first_name,
            last_name,
            phone,
            email,
            trade_id,
            trades (name)
          ),
          trainee_applications (
            id,
            trainee_number,
            first_name,
            last_name,
            phone,
            email,
            trade_id
          )
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Map the data to include trade info
      let accounts: FinancialAccount[] = (data || []).map((item: any) => ({
        ...item,
        trainee_applications: item.trainee_applications ? {
          ...item.trainee_applications,
          trades: null, // Trade info fetched separately if needed
        } : null,
      }));

      // Apply search filter
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        accounts = accounts.filter((acc) => {
          const name = acc.trainees
            ? `${acc.trainees.first_name} ${acc.trainees.last_name}`
            : acc.trainee_applications
            ? `${acc.trainee_applications.first_name} ${acc.trainee_applications.last_name}`
            : "";
          const number = acc.trainees?.trainee_id || acc.trainee_applications?.trainee_number || "";
          return (
            name.toLowerCase().includes(searchLower) ||
            number.toLowerCase().includes(searchLower) ||
            acc.account_number.toLowerCase().includes(searchLower)
          );
        });
      }

      // Apply status filter
      if (filters?.status && filters.status !== 'all') {
        if (filters.status === 'pending') {
          accounts = accounts.filter((acc) => acc.balance > 0);
        } else if (filters.status === 'paid') {
          accounts = accounts.filter((acc) => acc.balance <= 0);
        }
      }

      // Apply sorting
      if (filters?.sortBy) {
        accounts.sort((a, b) => {
          let comparison = 0;
          if (filters.sortBy === 'name') {
            const nameA = a.trainees
              ? `${a.trainees.first_name} ${a.trainees.last_name}`
              : a.trainee_applications
              ? `${a.trainee_applications.first_name} ${a.trainee_applications.last_name}`
              : "";
            const nameB = b.trainees
              ? `${b.trainees.first_name} ${b.trainees.last_name}`
              : b.trainee_applications
              ? `${b.trainee_applications.first_name} ${b.trainee_applications.last_name}`
              : "";
            comparison = nameA.localeCompare(nameB);
          } else if (filters.sortBy === 'balance') {
            comparison = a.balance - b.balance;
          } else if (filters.sortBy === 'date') {
            comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          }
          return filters.sortOrder === 'desc' ? -comparison : comparison;
        });
      }

      return accounts;
    },
    enabled: !!organizationId,
  });
};

export const useFinancialTransactions = (accountId?: string) => {
  const { organizationId } = useOrganizationContext();
  const queryClient = useQueryClient();

  // Set up realtime subscription
  useEffect(() => {
    if (!accountId) return;

    const channel = supabase
      .channel(`transactions-${accountId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'financial_transactions',
          filter: `account_id=eq.${accountId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['financial-transactions', accountId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId, queryClient]);

  return useQuery({
    queryKey: ["financial-transactions", accountId],
    queryFn: async () => {
      if (!accountId) return [];

      const { data, error } = await supabase
        .from("financial_transactions")
        .select(`
          *,
          fee_types (name, code)
        `)
        .eq("account_id", accountId)
        .order("processed_at", { ascending: false });

      if (error) throw error;
      return data as FinancialTransaction[];
    },
    enabled: !!accountId,
  });
};

export const useCreateTransaction = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useOrganizationContext();

  return useMutation({
    mutationFn: async (data: CreateTransactionData) => {
      if (!organizationId) throw new Error("No organization");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get current account balance
      const { data: account, error: accountError } = await supabase
        .from("trainee_financial_accounts")
        .select("balance")
        .eq("id", data.account_id)
        .single();

      if (accountError) throw accountError;

      // Calculate balance after transaction
      let balanceAfter = Number(account.balance);
      if (data.transaction_type === 'charge') {
        balanceAfter += data.amount;
      } else if (['payment', 'credit', 'waiver'].includes(data.transaction_type)) {
        balanceAfter -= data.amount;
      } else if (data.transaction_type === 'refund') {
        balanceAfter += data.amount;
      } else if (data.transaction_type === 'adjustment') {
        balanceAfter += data.amount; // Can be positive or negative
      }

      const { data: transaction, error } = await supabase
        .from("financial_transactions")
        .insert({
          organization_id: organizationId,
          account_id: data.account_id,
          fee_type_id: data.fee_type_id || null,
          transaction_type: data.transaction_type,
          amount: data.amount,
          balance_after: balanceAfter,
          payment_method: data.payment_method || null,
          reference_number: data.reference_number || null,
          description: data.description || null,
          notes: data.notes || null,
          academic_year: data.academic_year || null,
          processed_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return transaction;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["financial-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["financial-transactions", variables.account_id] });
      toast({ title: "Transaction recorded successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useAccountStats = () => {
  const { organizationId } = useOrganizationContext();

  return useQuery({
    queryKey: ["financial-account-stats", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      const { data, error } = await supabase
        .from("trainee_financial_accounts")
        .select("total_fees, total_paid, balance, status")
        .eq("organization_id", organizationId);

      if (error) throw error;

      const stats = {
        totalAccounts: data.length,
        totalFees: 0,
        totalCollected: 0,
        totalOutstanding: 0,
        fullyPaid: 0,
        withBalance: 0,
      };

      data.forEach((account) => {
        stats.totalFees += Number(account.total_fees) || 0;
        stats.totalCollected += Number(account.total_paid) || 0;
        stats.totalOutstanding += Number(account.balance) || 0;
        if (Number(account.balance) <= 0) {
          stats.fullyPaid++;
        } else {
          stats.withBalance++;
        }
      });

      return stats;
    },
    enabled: !!organizationId,
  });
};
