import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Banknote, CheckCircle2, Circle, ClipboardCheck, GraduationCap, UserCheck } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSpinner, ButtonSpinner } from "@/components/ui/loading-spinner";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useQualifications } from "@/hooks/useQualifications";
import { useRegisterTrainee } from "@/hooks/useFinancialQueue";
import { useRegistrationDetails } from "@/hooks/useRegistrationDetails";

const money = (n: number) => `N$ ${Number(n ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type StepState = "done" | "current" | "waiting";

const Step = ({ n, title, state, children }: { n: number; title: string; state: StepState; children: React.ReactNode }) => (
  <Card className={state === "current" ? "border-primary" : undefined}>
    <CardHeader className="pb-2">
      <div className="flex items-center gap-3">
        {state === "done" ? <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-label="Done" /> : <Circle className={`h-5 w-5 shrink-0 ${state === "current" ? "text-primary" : "text-muted-foreground"}`} aria-label={state === "current" ? "Current step" : "Not yet"} />}
        <CardTitle className="text-base">Step {n}. {title}</CardTitle>
        <Badge variant={state === "done" ? "secondary" : state === "current" ? "default" : "outline"} className="ml-auto">{state === "done" ? "Done" : state === "current" ? "Now" : "Waiting"}</Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-3 text-sm">{children}</CardContent>
  </Card>
);

// Registration of an admitted applicant: choose the qualification, the registration fee is cleared by the debtor
// officer, and once it is cleared the applicant is a registered trainee.
const RegistrationPage = () => {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const { navItems, groupLabel } = useRoleNavigation();
  const { data, isLoading, error } = useRegistrationDetails(applicationId);
  const { data: qualifications } = useQualifications();
  const register = useRegisterTrainee();
  const [qualification, setQualification] = useState("");

  const app = data?.application;
  const reg = data?.registration;
  const feeTotal = data?.fees.reduce((n, f) => n + Number(f.amount), 0) ?? 0;
  const feePaid = data?.fees.reduce((n, f) => n + Number(f.amount_paid), 0) ?? 0;
  const regFee = data?.fees.find((f) => f.entity_type === "REGISTRATION");
  const registered = app?.registration_status === "registered" || app?.registration_status === "fully_registered";
  const admitted = app?.registration_status === "provisionally_admitted";
  const feePending = app?.registration_status === "registration_fee_pending";

  const choices = useMemo(
    () => (qualifications ?? []).filter((q) => q.status === "approved" && q.active && q.trade_id != null && app?.trade_id != null && q.trade_id === app.trade_id),
    [qualifications, app?.trade_id],
  );
  const chosen = qualifications?.find((q) => q.id === reg?.qualification_id);

  const s1: StepState = admitted || feePending || registered ? "done" : "waiting";
  const s2: StepState = reg || registered ? "done" : admitted ? "current" : "waiting";
  const s3: StepState = registered || (regFee && regFee.status === "cleared") ? "done" : feePending ? "current" : "waiting";
  const s4: StepState = registered ? "done" : "waiting";

  return (
    <DashboardLayout title="Registration" subtitle="Admit, register and enrol an applicant" navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/applications-inbox")}><ArrowLeft className="h-4 w-4" />Back to applications</Button>

        {isLoading && <div className="flex justify-center py-8"><LoadingSpinner text="Loading registration" /></div>}
        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>This application could not be opened: {(error as Error).message}</AlertDescription></Alert>}

        {app && (
          <>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>{app.first_name} {app.last_name}</CardTitle>
                  <Badge variant={registered ? "secondary" : "default"}>{registered ? "Registered trainee" : admitted ? "Provisionally admitted" : feePending ? "Registration fee pending" : app.registration_status.replace(/_/g, " ")}</Badge>
                </div>
                <CardDescription>Application {app.application_number ?? "–"} · Trainee number <span className="font-mono">{app.trainee_number ?? "not yet issued"}</span></CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div><p className="text-muted-foreground">Trade</p><p className="font-medium">{app.trades?.name ?? "–"}</p></div>
                <div><p className="text-muted-foreground">Level</p><p className="font-medium">{app.preferred_level ? `Level ${app.preferred_level}` : "–"}</p></div>
                <div><p className="text-muted-foreground">Intake</p><p className="font-medium capitalize">{[app.intake, app.academic_year].filter(Boolean).join(" ") || "–"}</p></div>
                <div><p className="text-muted-foreground">Hostel</p><p className="font-medium">{app.needs_hostel_accommodation ? "Requested" : "Not requested"}</p></div>
              </CardContent>
            </Card>

            <Step n={1} title="Admission" state={s1}>
              {s1 === "done" ? <p>The application fee is cleared and the applicant is provisionally admitted.</p> : (
                <p>The applicant must be screened and the application fee cleared before registration can start. Current status: <span className="font-medium">{app.registration_status.replace(/_/g, " ")}</span>.</p>
              )}
            </Step>

            <Step n={2} title="Choose the qualification and start registration" state={s2}>
              {reg ? (
                <p>Registered for <span className="font-medium">{chosen ? `${chosen.qualification_code} – ${chosen.qualification_title}` : "the chosen qualification"}</span>{reg.academic_year ? `, ${reg.academic_year}` : ""}.</p>
              ) : admitted ? (
                <>
                  <Select value={qualification} onValueChange={setQualification}>
                    <SelectTrigger aria-label="Qualification"><SelectValue placeholder="Select a qualification" /></SelectTrigger>
                    <SelectContent>
                      {choices.map((q) => <SelectItem key={q.id} value={q.id}>{q.qualification_code} – {q.qualification_title} (NQF {q.nqf_level})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {choices.length === 0 && <p className="text-destructive">No approved qualification is linked to “{app.trades?.name ?? "this trade"}”. Ask the Head of Training to approve one for this trade.</p>}
                  <Button disabled={!qualification || register.isPending} onClick={() => register.mutate({ application_id: app.id, qualification_id: qualification, academic_year: app.academic_year ?? undefined })}>
                    {register.isPending ? <><ButtonSpinner />Registering…</> : <><ClipboardCheck className="mr-2 h-4 w-4" />Register applicant</>}
                  </Button>
                  <p className="text-xs text-muted-foreground">This creates the registration and sends the registration fee to the debtor officer.</p>
                </>
              ) : <p className="text-muted-foreground">Available once the applicant is provisionally admitted.</p>}
            </Step>

            <Step n={3} title="Registration fee" state={s3}>
              {data!.fees.length === 0 ? <p className="text-muted-foreground">The fee appears here once registration has started.</p> : (
                <div className="space-y-2">
                  {data!.fees.map((f) => (
                    <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0">
                      <span className="min-w-0 break-words">{f.description ?? (f.entity_type === "HOSTEL" ? "Hostel accommodation fee" : "Registration fee")}</span>
                      <span className="flex items-center gap-2"><span>{money(f.amount_paid)} of {money(f.amount)}</span><Badge variant={f.status === "cleared" ? "secondary" : "outline"}>{f.status}</Badge></span>
                    </div>
                  ))}
                  <p className="font-medium">Paid {money(feePaid)} of {money(feeTotal)}</p>
                </div>
              )}
              {feePending && (
                <Alert><Banknote className="h-4 w-4" /><AlertDescription>Fees are collected and cleared by the debtor officer. Registration finishes automatically when the registration fee is cleared; hostel fees are a separate account and do not hold it up.</AlertDescription></Alert>
              )}
            </Step>

            <Step n={4} title="Enrolment confirmed" state={s4}>
              {registered ? (
                <>
                  <p className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-primary" />{app.first_name} {app.last_name} is a registered trainee ({app.trainee_number}).</p>
                  {data!.traineeId && <Button variant="outline" onClick={() => navigate(`/trainees/${data!.traineeId}`)}><GraduationCap className="mr-2 h-4 w-4" />Open the trainee record</Button>}
                </>
              ) : <p className="text-muted-foreground">Once the registration fee is cleared the applicant becomes a registered trainee and can sign in to the trainee portal.</p>}
            </Step>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default RegistrationPage;
