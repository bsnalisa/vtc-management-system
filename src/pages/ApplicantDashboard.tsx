import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLogo } from "@/components/AppLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { FileText, LogOut, Plus, CheckCircle2, Clock, XCircle } from "lucide-react";
import { resolveApplicantDestination } from "./ApplicantAuth";
import { signOutAndClearCaches } from "@/lib/authUtils";
import { useActiveOrganizations } from "@/hooks/usePublicApplication";

const label = (s?: string | null) => (s || "pending").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const outcome = (a: any) => {
  if (a.registration_status === "rejected" || a.qualification_status === "does_not_qualify")
    return { text: "Unsuccessful", icon: XCircle, variant: "destructive" as const };
  if (["provisionally_admitted", "registration_fee_pending", "fully_registered", "registered"].includes(a.registration_status))
    return { text: label(a.registration_status), icon: CheckCircle2, variant: "default" as const };
  return { text: "Under review", icon: Clock, variant: "secondary" as const };
};

const ApplicantDashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return navigate("/applicant", { replace: true });
      const dest = await resolveApplicantDestination(data.user.id);
      if (dest !== "/applicant/dashboard") return navigate(dest, { replace: true });
      setUser(data.user);
      setChecking(false);
    });
  }, [navigate]);

  const { data: apps, isLoading } = useQuery({
    queryKey: ["my_applications_dashboard", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainee_applications")
        .select("id, application_number, intake, academic_year, qualification_status, registration_status, info_request_note, created_at, organization_id, trades:trades!trainee_applications_trade_id_fkey(name)")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: orgs } = useActiveOrganizations();
  const orgName = (id: string) => orgs?.find((o: any) => o.id === id)?.name || "Training centre";

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center"><LoadingSpinner size="lg" text="Loading..." /></div>;
  }

  const name = user?.user_metadata?.firstname || user?.email;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/"><AppLogo /></Link>
          <Button variant="ghost" size="sm" onClick={async () => { await signOutAndClearCaches(queryClient); navigate("/"); }}>
            <LogOut className="mr-1 h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Applicant dashboard</p>
            <h1 className="text-2xl font-bold">Welcome, {name}</h1>
            <p className="text-sm text-muted-foreground">Start a new application or follow the status of the ones you've sent.</p>
          </div>
          <Button onClick={() => navigate("/apply")}><Plus className="mr-1 h-4 w-4" /> Start or continue application</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">My applications</CardTitle>
            <CardDescription>Status updates from the training centre appear here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <LoadingSpinner text="Loading applications..." />
            ) : !apps?.length ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 font-medium">No applications yet</p>
                <p className="text-sm text-muted-foreground">Choose a training centre and complete the form to apply.</p>
                <Button className="mt-4" onClick={() => navigate("/apply")}>Apply now</Button>
              </div>
            ) : (
              apps.map((a) => {
                const o = outcome(a);
                return (
                  <div key={a.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold">{a.trades?.name || "Application"}</div>
                        <div className="text-sm text-muted-foreground">
                          {orgName(a.organization_id)} · <span className="capitalize">{a.intake}</span> {a.academic_year}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Reference <span className="font-mono font-medium text-foreground">{a.application_number}</span> · Submitted {new Date(a.created_at).toLocaleDateString("en-ZA")}
                        </div>
                      </div>
                      <Badge variant={o.variant} className="gap-1"><o.icon className="h-3 w-3" />{o.text}</Badge>
                    </div>
                    {a.registration_status === "rejected" && a.info_request_note && (
                      <p className="mt-3 rounded-md bg-muted p-2 text-sm"><strong>Reason:</strong> {a.info_request_note}</p>
                    )}
                    {o.variant === "default" && (
                      <p className="mt-3 text-sm text-muted-foreground">Congratulations — the centre will contact you about registration fees and enrolment.</p>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ApplicantDashboard;
