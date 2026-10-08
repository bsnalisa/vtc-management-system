import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PartnerDialog } from "@/components/liaison/PartnerDialog";
import { PartnerDetail } from "@/components/liaison/PartnerDetail";
import { FollowUpsList } from "@/components/liaison/FollowUpsList";
import { Partner, todayISO, usePartnerInteractions, usePartnerPlacementCounts, usePartners } from "@/hooks/useLiaison";

const LiaisonPartners = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: partners = [], isLoading, error } = usePartners();
  const { data: interactions = [], error: intError } = usePartnerInteractions();
  const { data: placements = {}, error: plError } = usePartnerPlacementCounts();
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState("register");
  const [dialog, setDialog] = useState<{ open: boolean; partner: Partner | null }>({ open: false, partner: null });

  const industries = useMemo(() => Array.from(new Set(partners.map((p) => p.industry).filter(Boolean))).sort() as string[], [partners]);
  const filtered = partners.filter((p) =>
    (industry === "all" || p.industry === industry) &&
    (activeFilter === "all" || (activeFilter === "active") === p.active) &&
    (!search.trim() || [p.name, p.contact_person, p.industry].some((v) => v?.toLowerCase().includes(search.trim().toLowerCase()))));
  const selected = partners.find((p) => p.id === selectedId) ?? null;
  const due = interactions.filter((i) => i.follow_up_date && !i.follow_up_done && i.follow_up_date <= todayISO())
    .sort((a, b) => a.follow_up_date!.localeCompare(b.follow_up_date!));
  const loadError = error ?? intError ?? plError;

  return (
    <DashboardLayout title="Partners" subtitle="Employers and industry partners, contact log and follow-ups" navItems={navItems} groupLabel={groupLabel}>
      {loadError && <p role="alert" className="mb-3 text-sm text-destructive">Could not load partner data: {(loadError as Error).message}</p>}
      {isLoading ? <LoadingSpinner text="Loading partners..." /> : (
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="register">Partner register</TabsTrigger>
            <TabsTrigger value="followups">Follow-ups due ({due.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="register">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <Card>
                <CardHeader className="space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div><CardTitle>Register ({filtered.length})</CardTitle><CardDescription>Select a partner to see its contact log</CardDescription></div>
                    <Button onClick={() => setDialog({ open: true, partner: null })}><Plus className="h-4 w-4 mr-1" />Add partner</Button>
                  </div>
                  <Input placeholder="Search name, contact or industry" aria-label="Search partners" value={search} onChange={(e) => setSearch(e.target.value)} />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select value={industry} onValueChange={setIndustry}>
                      <SelectTrigger aria-label="Industry"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="all">All industries</SelectItem>{industries.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={activeFilter} onValueChange={setActiveFilter}>
                      <SelectTrigger aria-label="Active status"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="all">Active and inactive</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {filtered.map((p) => (
                    <button key={p.id} type="button" aria-pressed={p.id === selectedId} onClick={() => setSelectedId(p.id)}
                      className={`w-full rounded-md border p-3 text-left text-sm transition-colors hover:bg-muted ${p.id === selectedId ? "border-primary bg-muted" : ""}`}>
                      <div className="flex items-center justify-between gap-2"><span className="font-medium">{p.name}</span>{!p.active && <Badge variant="outline">Inactive</Badge>}</div>
                      <div className="text-muted-foreground">{p.industry ?? "No industry"} · {p.contact_person ?? "No contact"}</div>
                    </button>
                  ))}
                  {!filtered.length && <p className="text-sm text-muted-foreground text-center py-6">{partners.length ? "No partners match the filters." : "No partners yet. Add the first one."}</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>{selected?.name ?? "Partner"}</CardTitle></CardHeader>
                <CardContent>
                  {selected ? (
                    <PartnerDetail partner={selected} interactions={interactions.filter((i) => i.employer_id === selected.id)} placements={placements[selected.id] ?? 0}
                      onEdit={() => setDialog({ open: true, partner: selected })} />
                  ) : <p className="text-sm text-muted-foreground text-center py-10">Select a partner.</p>}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="followups">
            <Card>
              <CardHeader><CardTitle>Follow-ups due</CardTitle><CardDescription>Contacts with a follow-up date of today or earlier</CardDescription></CardHeader>
              <CardContent><FollowUpsList items={due} onOpenPartner={(id) => { setSelectedId(id); setTab("register"); }} /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
      <PartnerDialog open={dialog.open} partner={dialog.partner} onClose={() => setDialog({ open: false, partner: null })} />
    </DashboardLayout>
  );
};

export default withRoleAccess(LiaisonPartners, {
  requiredRoles: ["liaison_officer", "placement_officer", "admin", "organization_admin"],
});
