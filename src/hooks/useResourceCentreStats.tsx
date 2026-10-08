import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "./useOrganizationContext";

// Resource-centre tables are newer than the generated Supabase types, so access them untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface OverdueLoan { id: string; due_date: string; title: string; member: string }
export interface WaitingReservation { id: string; reserved_at: string; title: string; member: string; status: string }

export interface ResourceCentreStats {
  titles: number;
  totalCopies: number;
  availableCopies: number;
  activeLoans: number;
  overdueLoans: number;
  finesOutstanding: number;
  pendingReservations: number;
  activeMembers: number;
  loansPerMonth: { month: string; loans: number }[];
  itemsByType: { name: string; value: number }[];
  overdueList: OverdueLoan[];
  reservationList: WaitingReservation[];
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const throwIf = (e: unknown) => { if (e) throw e; };

export const useResourceCentreStats = () => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["resource-centre-stats", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<ResourceCentreStats> => {
      const today = new Date();
      const todayIso = today.toISOString().slice(0, 10);
      const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      const startIso = `${monthKey(start)}-01`;

      const [items, borrowing, fines, reservations, members, history] = await Promise.all([
        db.from("library_items").select("item_type,total_copies,available_copies").eq("organization_id", organizationId).eq("active", true),
        db.from("library_borrowing").select("id,due_date,status,library_items(title),borrower_id").eq("organization_id", organizationId).neq("status", "returned").order("due_date"),
        db.from("library_fines").select("fine_amount,amount_paid,status").eq("organization_id", organizationId).eq("status", "pending"),
        db.from("library_reservations").select("id,status,reserved_at,library_items(title),library_members(full_name)").eq("organization_id", organizationId).in("status", ["waiting", "ready"]).order("reserved_at"),
        db.from("library_members").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "active"),
        db.from("library_borrowing").select("borrow_date").eq("organization_id", organizationId).gte("borrow_date", startIso),
      ]);
      [items, borrowing, fines, reservations, members, history].forEach((r) => throwIf(r.error));

      const itemRows = items.data as { item_type: string; total_copies: number; available_copies: number }[];
      const byType = new Map<string, number>();
      itemRows.forEach((i) => byType.set(i.item_type, (byType.get(i.item_type) ?? 0) + 1));

      const loans = borrowing.data as { id: string; due_date: string; status: string; borrower_id: string; library_items?: { title: string } | null }[];
      const overdue = loans.filter((l) => l.status === "overdue" || l.due_date < todayIso);
      const borrowerIds = [...new Set(overdue.slice(0, 8).map((l) => l.borrower_id))];
      const names = new Map<string, string>();
      if (borrowerIds.length) {
        const { data, error } = await db.from("library_members").select("id,full_name").in("id", borrowerIds);
        throwIf(error);
        (data as { id: string; full_name: string }[]).forEach((m) => names.set(m.id, m.full_name));
      }

      const months: { key: string; month: string; loans: number }[] = [];
      for (let i = 0; i < 6; i++) {
        const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
        months.push({ key: monthKey(d), month: d.toLocaleString("en", { month: "short" }), loans: 0 });
      }
      (history.data as { borrow_date: string }[]).forEach((h) => {
        const m = months.find((x) => x.key === h.borrow_date.slice(0, 7));
        if (m) m.loans += 1;
      });

      const resRows = reservations.data as { id: string; status: string; reserved_at: string; library_items?: { title: string } | null; library_members?: { full_name: string } | null }[];

      return {
        titles: itemRows.length,
        totalCopies: itemRows.reduce((s, i) => s + (i.total_copies ?? 0), 0),
        availableCopies: itemRows.reduce((s, i) => s + (i.available_copies ?? 0), 0),
        activeLoans: loans.length,
        overdueLoans: overdue.length,
        finesOutstanding: (fines.data as { fine_amount: number; amount_paid: number }[])
          .reduce((s, f) => s + Math.max(0, Number(f.fine_amount) - Number(f.amount_paid)), 0),
        pendingReservations: resRows.length,
        activeMembers: members.count ?? 0,
        loansPerMonth: months.map(({ month, loans: n }) => ({ month, loans: n })),
        itemsByType: [...byType.entries()].map(([name, value]) => ({ name, value })),
        overdueList: overdue.slice(0, 8).map((l) => ({ id: l.id, due_date: l.due_date, title: l.library_items?.title ?? "Unknown item", member: names.get(l.borrower_id) ?? "Unknown member" })),
        reservationList: resRows.slice(0, 8).map((r) => ({ id: r.id, reserved_at: r.reserved_at, status: r.status, title: r.library_items?.title ?? "Unknown item", member: r.library_members?.full_name ?? "Unknown member" })),
      };
    },
  });
};
