import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Globe, FileText, Eye, ClipboardCheck, Inbox, Clock } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { useTrades } from "@/hooks/useTrades";
import { useOnlineApplications, useUpdateApplicationStatus } from "@/hooks/useOnlineApplications";
import { ScreeningDialog } from "@/components/registration/ScreeningDialog";
import { ApplicationViewDialog } from "@/components/registration/ApplicationViewDialog";

const REGISTRATION_STATUSES = [
  "pending",
  "provisionally_admitted",
  "registration_fee_pending",
  "fully_registered",
  "rejected",
];

const label = (s?: string | null) =>
  (s || "pending").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const qualBadge = (status: string) => {
  if (status === "provisionally_qualified") return <Badge className="bg-green-500">Qualified</Badge>;
  if (status === "does_not_qualify") return <Badge variant="destructive">Not Qualified</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
};

const OnlineApplicationsInbox = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<"all" | "online" | "staff">("online");
  const [qualification, setQualification] = useState("all");
  const [registration, setRegistration] = useState("all");
  const [trade, setTrade] = useState("all");
  const [intake, setIntake] = useState("all");

  const [viewOpen, setViewOpen] = useState(false);
  const [screenOpen, setScreenOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const { data: trades } = useTrades();
  const { data: applications, isLoading } = useOnlineApplications({
    source,
    qualification_status: qualification,
    registration_status: registration,
    trade_id: trade,
    intake,
  });
  const updateStatus = useUpdateApplicationStatus();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return applications || [];
    return (applications || []).filter((a) =>
      [a.first_name, a.last_name, a.application_number, a.national_id, a.email]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(q))
    );
  }, [applications, search]);

  const stats = useMemo(() => {
    const list = applications || [];
    return {
      total: list.length,
      online: list.filter((a) => a.application_source === "online").length,
      pending: list.filter((a) => (a.qualification_status || "pending") === "pending").length,
    };
  }, [applications]);

  return (
    <DashboardLayout
      title="Applications Inbox"
      subtitle="Review, filter and update applications submitted to your centre"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Applications", value: stats.total, icon: Inbox, tone: "text-primary" },
            { label: "Submitted online", value: stats.online, icon: Globe, tone: "text-blue-500" },
            { label: "Awaiting screening", value: stats.pending, icon: Clock, tone: "text-warning" },
          ].map((s) => (
            <Card key={s.label} className="relative overflow-hidden">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/5" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-1">
                <CardTitle className="text-xs font-medium">{s.label}</CardTitle>
                <s.icon className={`h-4 w-4 ${s.tone}`} />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Centre applications</CardTitle>
            <CardDescription className="text-xs">
              Online submissions arrive here automatically from the public application form.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="mb-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
              <div className="relative md:col-span-3 lg:col-span-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name, reference, ID or email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={source} onValueChange={(v) => setSource(v as any)}>
                <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="staff">Captured by staff</SelectItem>
                </SelectContent>
              </Select>
              <Select value={qualification} onValueChange={setQualification}>
                <SelectTrigger><SelectValue placeholder="Screening" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All screening</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="provisionally_qualified">Qualified</SelectItem>
                  <SelectItem value="does_not_qualify">Not qualified</SelectItem>
                </SelectContent>
              </Select>
              <Select value={registration} onValueChange={setRegistration}>
                <SelectTrigger><SelectValue placeholder="Registration" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {REGISTRATION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{label(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={trade} onValueChange={setTrade}>
                <SelectTrigger><SelectValue placeholder="Trade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All trades</SelectItem>
                  {trades?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={intake} onValueChange={setIntake}>
                <SelectTrigger><SelectValue placeholder="Intake" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All intakes</SelectItem>
                  <SelectItem value="january">January</SelectItem>
                  <SelectItem value="july">July</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <TableSkeleton columns={8} rows={5} />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No applications found"
                description="Adjust the filters, or wait for new online applications to arrive."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Trade</TableHead>
                      <TableHead>Intake</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Screening</TableHead>
                      <TableHead>Registration status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((app) => (
                      <TableRow key={app.id}>
                        <TableCell className="font-medium">{app.application_number}</TableCell>
                        <TableCell>
                          <div className="font-medium">{app.first_name} {app.last_name}</div>
                          <div className="text-xs text-muted-foreground">{app.national_id}</div>
                        </TableCell>
                        <TableCell>{app.trades?.name || "—"}</TableCell>
                        <TableCell className="capitalize">{app.intake} {app.academic_year}</TableCell>
                        <TableCell>
                          {app.application_source === "online" ? (
                            <Badge variant="outline" className="gap-1">
                              <Globe className="h-3 w-3" /> Online
                            </Badge>
                          ) : (
                            <Badge variant="outline">Staff</Badge>
                          )}
                        </TableCell>
                        <TableCell>{qualBadge(app.qualification_status)}</TableCell>
                        <TableCell>
                          <Select
                            value={app.registration_status || "pending"}
                            onValueChange={(v) =>
                              updateStatus.mutate({ applicationId: app.id, registration_status: v })
                            }
                          >
                            <SelectTrigger className="h-8 w-[210px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {REGISTRATION_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>{label(s)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setSelected(app); setViewOpen(true); }}
                            >
                              <Eye className="mr-1 h-3.5 w-3.5" /> View
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => { setSelected(app); setScreenOpen(true); }}
                            >
                              <ClipboardCheck className="mr-1 h-3.5 w-3.5" /> Screen
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {selected && (
          <>
            <ApplicationViewDialog open={viewOpen} onOpenChange={setViewOpen} application={selected} />
            <ScreeningDialog open={screenOpen} onOpenChange={setScreenOpen} application={selected} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default OnlineApplicationsInbox;
