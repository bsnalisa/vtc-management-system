import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { RequestLeaveDialog } from "@/components/hr/RequestLeaveDialog";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useUserRole } from "@/hooks/useUserRole";
import { fmtDate, labelOf, useAcknowledgeReview, useCancelLeave, useMyLeaveBalances, useMyLeaveRequests, useMyReviews, useMyStaffRecord } from "@/hooks/useHr";

const variant = (s: string): "default" | "secondary" | "destructive" | "outline" =>
  s === "approved" || s === "acknowledged" ? "default" : s === "rejected" ? "destructive" : s === "pending" || s === "submitted" ? "secondary" : "outline";
const errText = (e: unknown) => (e as Error).message;

const MyHr = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { role, loading } = useUserRole();
  const balances = useMyLeaveBalances();
  const requests = useMyLeaveRequests();
  const reviews = useMyReviews();
  const record = useMyStaffRecord();
  const cancel = useCancelLeave();
  const acknowledge = useAcknowledgeReview();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  if (loading) return <DashboardLayout title="My HR" navItems={navItems} groupLabel={groupLabel}><LoadingSpinner text="Loading" /></DashboardLayout>;
  if (role === "trainee") {
    return (
      <DashboardLayout title="My HR" navItems={navItems} groupLabel={groupLabel}>
        <Card><CardContent className="py-10 text-center text-muted-foreground">This page is for staff members only. Thank you for visiting; trainees can use their own dashboard for their records.</CardContent></Card>
      </DashboardLayout>
    );
  }

  const r = record.data;
  return (
    <DashboardLayout title="My HR" subtitle="Your leave, performance reviews and staff record" navItems={navItems} groupLabel={groupLabel}>
      <Tabs defaultValue="leave" className="space-y-4">
        <TabsList><TabsTrigger value="leave">My leave</TabsTrigger><TabsTrigger value="reviews">My reviews</TabsTrigger><TabsTrigger value="record">My staff record</TabsTrigger></TabsList>
        <TabsContent value="leave" className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardHeader className="flex-col sm:flex-row items-start justify-between space-y-0 gap-3">
              <div><CardTitle>Leave balances</CardTitle><CardDescription>This year. No limit means days are not capped.</CardDescription></div>
              <Button onClick={() => setOpen(true)}>Request leave</Button>
            </CardHeader>
            <CardContent>
              {balances.isLoading && <LoadingSpinner text="Loading balances" />}
              {balances.error && <p role="alert" className="text-sm text-destructive">Could not load balances: {errText(balances.error)}</p>}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(balances.data ?? []).map((b) => (
                  <div key={b.leave_type_id} className="rounded-md border p-4">
                    <div className="font-medium">{b.leave_type}</div>
                    <div className="text-2xl font-bold">{b.days_per_year === 0 ? "No limit" : `${b.remaining} left`}</div>
                    <div className="text-xs text-muted-foreground">{b.days_per_year > 0 ? `of ${b.days_per_year} - ` : ""}{b.taken} taken, {b.pending} pending</div>
                  </div>
                ))}
              </div>
              {balances.data && !balances.data.length && <p className="text-sm text-muted-foreground text-center py-4">HR has not set up any leave types yet.</p>}
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle>My requests</CardTitle></CardHeader>
            <CardContent>
              {requests.isLoading && <LoadingSpinner text="Loading requests" />}
              {requests.error && <p role="alert" className="text-sm text-destructive">Could not load requests: {errText(requests.error)}</p>}
              {!requests.isLoading && !requests.error && (
                <Table>
                  <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Days</TableHead><TableHead>Status</TableHead><TableHead>HR notes</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(requests.data ?? []).map((q) => (
                      <TableRow key={q.id}>
                        <TableCell>{q.leave_types?.name ?? "-"}</TableCell><TableCell>{fmtDate(q.start_date)}</TableCell><TableCell>{fmtDate(q.end_date)}</TableCell><TableCell>{q.days}</TableCell>
                        <TableCell><Badge variant={variant(q.status)}>{labelOf(q.status)}</Badge></TableCell>
                        <TableCell className="whitespace-normal min-w-[160px]">{q.decision_notes ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          {(q.status === "pending" || q.status === "approved") && q.start_date > today && <Button size="sm" variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate(q.id)}>Cancel</Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {requests.data && !requests.data.length && <p className="text-sm text-muted-foreground text-center py-6">You have not requested any leave yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="reviews">
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle>My performance reviews</CardTitle><CardDescription>Reviews appear here once HR submits them.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {reviews.isLoading && <LoadingSpinner text="Loading reviews" />}
              {reviews.error && <p role="alert" className="text-sm text-destructive">Could not load reviews: {errText(reviews.error)}</p>}
              {(reviews.data ?? []).map((v) => (
                <div key={v.id} className="rounded-md border p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">Period {v.period} - rating {v.rating ?? "-"} / 5</div>
                    <Badge variant={variant(v.status)}>{labelOf(v.status)}</Badge>
                  </div>
                  {v.goals && <p className="text-sm"><span className="font-medium">Goals:</span> {v.goals}</p>}
                  {v.comments && <p className="text-sm"><span className="font-medium">Comments:</span> {v.comments}</p>}
                  {v.status === "submitted" && <Button size="sm" disabled={acknowledge.isPending} onClick={() => acknowledge.mutate(v.id)}>Acknowledge</Button>}
                  {v.acknowledged_at && <p className="text-xs text-muted-foreground">Acknowledged on {fmtDate(v.acknowledged_at)}</p>}
                </div>
              ))}
              {reviews.data && !reviews.data.length && <p className="text-sm text-muted-foreground text-center py-6">No reviews have been shared with you yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="record">
          <Card className="border-0 shadow-md">
            <CardHeader><CardTitle>My staff record</CardTitle><CardDescription>Maintained by HR. Ask HR if something is wrong.</CardDescription></CardHeader>
            <CardContent>
              {record.isLoading && <LoadingSpinner text="Loading record" />}
              {record.error && <p role="alert" className="text-sm text-destructive">Could not load your record: {errText(record.error)}</p>}
              {!record.isLoading && !record.error && !r && <p className="text-sm text-muted-foreground text-center py-6">HR has not created a staff record for you yet.</p>}
              {r && (
                <dl className="grid gap-4 sm:grid-cols-2">
                  {([["Employee number", r.employee_number], ["Job title", r.job_title], ["Department", r.department], ["Employment type", labelOf(r.employment_type)], ["Status", labelOf(r.employment_status)],
                    ["Start date", fmtDate(r.start_date)], ["End date", fmtDate(r.end_date)], ["Phone", r.phone], ["Emergency contact", r.emergency_contact]] as [string, string | null][]).map(([k, v]) => (
                    <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-sm font-medium">{v || "-"}</dd></div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <RequestLeaveDialog open={open} onClose={() => setOpen(false)} balances={balances.data ?? []} />
    </DashboardLayout>
  );
};

export default MyHr;
