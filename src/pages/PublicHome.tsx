import { LoadingIndicator } from "@/components/ui/loading-spinner";
import { AppLogo } from "@/components/AppLogo";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GraduationCap, Building2, FileText, Search, ArrowRight, CheckCircle2, ClipboardList, Wallet, BookOpen, LogIn } from "lucide-react";
import { TrainingHeroCarousel } from "@/components/home/TrainingHeroCarousel";
import { ComprehensiveApplicationForm } from "@/components/application/ComprehensiveApplicationForm";
import {
  useActiveOrganizations,
  useOrganizationBySlug,
  useSubmitOnlineApplication,
  useMyApplications,
} from "@/hooks/usePublicApplication";
import { ComprehensiveApplicationData } from "@/types/application";

const FEATURES = [
  { icon: ClipboardList, title: "Online Applications", desc: "Apply to any registered training centre and track your progress in real time." },
  { icon: BookOpen, title: "Gradebooks & Results", desc: "Continuous assessment, summative marks and progress reports in one place." },
  { icon: Wallet, title: "Finance & Clearance", desc: "Fee statements, payment plans and clearance built into registration." },
  { icon: Building2, title: "Campus Operations", desc: "Hostels, assets, stock and procurement managed per centre." },
];

const statusLabel = (s?: string | null) =>
  (s || "pending").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const statusTone = (s?: string | null) => {
  if (s === "provisionally_qualified" || s === "fully_registered") return "default" as const;
  if (s === "does_not_qualify") return "destructive" as const;
  return "secondary" as const;
};

/** Consistent gradient icon badge used across section headers */
const IconBadge = ({ icon: Icon, className = "" }: { icon: any; className?: string }) => (
  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ${className}`}>
    <Icon className="h-5 w-5" />
  </div>
);

const PublicHome = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const location = useLocation();
  const initialTab =
    location.pathname.startsWith("/apply") || searchParams.get("tab") === "apply"
      ? "apply"
      : searchParams.get("tab") === "track"
      ? "track"
      : "home";
  const [tab, setTabState] = useState(initialTab);

  const setTab = (value: string) => {
    setTabState(value);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [formOpen, setFormOpen] = useState(false);

  const { data: organizations } = useActiveOrganizations();
  const { data: linkedOrg } = useOrganizationBySlug(slug);
  const { data: myApplications, isLoading: appsLoading } = useMyApplications();

  const lockedToCentre = !!linkedOrg;
  const activeOrgId = linkedOrg?.id || selectedOrg;
  const activeOrgName =
    linkedOrg?.name || organizations?.find((o) => o.id === selectedOrg)?.name || "";

  const submitApplication = useSubmitOnlineApplication(activeOrgId);

  // Application window: null = the centre has set none (not restricted)
  const activeSlug = linkedOrg?.subdomain || organizations?.find((o) => o.id === selectedOrg)?.subdomain || null;
  const { data: windowStatus, error: windowError } = useQuery({
    queryKey: ["application-window-status", activeSlug],
    enabled: !!activeSlug,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("application_window_status", { _org_slug: activeSlug });
      if (error) throw error;
      return data as { open: boolean; next_opens: string | null; closes_on: string | null } | null;
    },
  });
  const applicationsClosed = windowStatus?.open === false;
  const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (data: ComprehensiveApplicationData) => {
    if (applicationsClosed) throw new Error("Applications are closed");
    await submitApplication.mutateAsync(data);
    setFormOpen(false);
    setTab("track");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <AppLogo />
            <span className="public-home-brand text-lg font-bold"><span className="sm:hidden">VTC System</span><span className="hidden sm:inline">VTC Management System</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setTab("apply")}>Apply</Button>
            {session ? (
              <Button size="sm" onClick={() => navigate("/dashboard")}>My Portal</Button>
            ) : (
              <Button size="sm" onClick={() => navigate("/auth")}>
                <LogIn className="mr-2 h-4 w-4" /> Staff Sign in
              </Button>
            )}
          </div>
        </div>
      </header>

      <main>
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          {tab === "home" ? (
            <TrainingHeroCarousel centreName={linkedOrg?.name} onApply={() => setTab("apply")} onTrack={() => setTab("track")} />
          ) : (
            <section className="border-b bg-card">
              <div className="container mx-auto px-4 py-8 md:py-10">
                <p className="mb-2 text-sm font-medium text-primary">VTC Management System</p>
                <h1 className="text-3xl font-bold">{tab === "apply" ? (linkedOrg ? `Apply to ${linkedOrg.name}` : "Online application") : "My applications"}</h1>
              </div>
            </section>
          )}

          <div className="container mx-auto px-4 py-10">
            <TabsList className="mb-10 grid h-auto w-full max-w-xl grid-cols-3 items-stretch rounded-lg p-1 [&>button]:min-w-0 [&>button]:px-1 sm:[&>button]:px-3">
              <TabsTrigger value="home" className="rounded-lg py-2 whitespace-normal">Overview</TabsTrigger>
              <TabsTrigger value="apply" className="rounded-lg py-2 whitespace-normal">Online Application</TabsTrigger>
              <TabsTrigger value="track" className="rounded-lg py-2 whitespace-normal">My Applications</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="home" className="space-y-14">
              <section className="space-y-6">
                <div className="flex items-center gap-4">
                  <IconBadge icon={ClipboardList} />
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">How applying works</h2>
                    <p className="text-muted-foreground">
                      Three steps from application to registration — pick your centre inside the form.
                    </p>
                  </div>
                </div>
                <div className="grid gap-5 md:grid-cols-3">
                  {[
                    { step: "01", title: "Create your account", desc: "Sign in or register as an applicant so you can save and track your submission.", icon: LogIn, image: "/illustrations/step1.svg" },
                    { step: "02", title: "Complete the form", desc: "Select the training centre and trade from the dropdowns, then attach your documents.", icon: FileText, image: "/illustrations/step2.svg" },
                    { step: "03", title: "Track your outcome", desc: "Follow screening, qualification and registration status from My Applications.", icon: Search, image: "/illustrations/step3.svg" },
                  ].map((s) => (
                    <Card
                      key={s.step}
                      className="group relative overflow-hidden border-border/70 transition-colors hover:border-primary/30"
                    >
                      <div className="relative h-44 w-full overflow-hidden bg-muted/40 p-6">
                        <img
                          src={s.image}
                          alt={s.title}
                          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                        <span className="absolute right-4 top-2 text-5xl font-bold text-primary/10">
                          {s.step}
                        </span>
                      </div>
                      <CardHeader className="relative">
                        <IconBadge icon={s.icon} className="mb-3" />
                        <CardTitle className="text-base">{s.title}</CardTitle>
                        <CardDescription className="leading-relaxed">{s.desc}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button size="lg" onClick={() => setTab("apply")}>
                    Apply now <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => setTab("track")}>
                    <Search className="mr-2 h-4 w-4" /> Track my application
                  </Button>
                </div>
              </section>
              <section className="border-t pt-10">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold">Your training journey, connected</h2>
                  <p className="mt-2 text-muted-foreground">Applications, learning and centre services in one place.</p>
                </div>
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                  {FEATURES.map((f) => (
                    <div key={f.title}>
                      <IconBadge icon={f.icon} className="mb-4" />
                      <h3 className="mb-2 text-base font-semibold">{f.title}</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </section>
            </TabsContent>

            {/* Apply */}
            <TabsContent value="apply" className="space-y-6">
              <div className="mx-auto max-w-2xl space-y-6">
                <Card className="overflow-hidden border-border/60 shadow-lg shadow-primary/5">
                  <CardHeader className="border-b bg-muted/30">
                    <div className="flex items-center gap-4">
                      <IconBadge icon={FileText} />
                      <div>
                        <CardTitle>Online application</CardTitle>
                        <CardDescription>
                          Complete the official application form. Your submission is sent directly to
                          the training centre you select.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5 pt-6">
                    <div className="space-y-2">
                      <Label>Training centre</Label>
                      {lockedToCentre ? (
                        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          <span className="font-medium">{linkedOrg?.name}</span>
                        </div>
                      ) : (
                        <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select the centre you are applying to" />
                          </SelectTrigger>
                          <SelectContent>
                            {organizations?.map((o) => (
                              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {!authLoading && !session && (
                      <Alert>
                        <AlertDescription>
                          You need an applicant account to apply and track your application.{" "}
                          <Button variant="link" className="h-auto p-0 font-medium underline whitespace-normal" onClick={() => navigate("/auth")}>
                            Sign in or create an account
                          </Button>
                          .
                        </AlertDescription>
                      </Alert>
                    )}

                    {applicationsClosed && (
                      <Alert variant="destructive">
                        <AlertDescription>
                          <strong>Applications are closed.</strong>{" "}
                          {windowStatus?.next_opens ? `Applications open again on ${fmtDate(windowStatus.next_opens)}.` : "Please check back later."}
                        </AlertDescription>
                      </Alert>
                    )}
                    {windowStatus?.open && windowStatus.closes_on && (
                      <Alert>
                        <AlertDescription>Applications close on {fmtDate(windowStatus.closes_on)}.</AlertDescription>
                      </Alert>
                    )}
                    {windowError && (
                      <Alert variant="destructive">
                        <AlertDescription>Could not check whether applications are open: {(windowError as Error).message}</AlertDescription>
                      </Alert>
                    )}

                    <Button
                      className="min-h-12 h-auto py-3 w-full whitespace-normal"
                      size="lg"
                      disabled={!activeOrgId || !session || applicationsClosed}
                      onClick={() => setFormOpen(true)}
                    >
                      {activeOrgId ? `Start application${activeOrgName ? ` — ${activeOrgName}` : ""}` : "Select a centre to continue"}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Before you start</CardTitle>
                    <CardDescription>Have these ready to complete the form in one sitting.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2.5 text-sm text-muted-foreground sm:grid-cols-2">
                    {[
                      "National ID / passport number and a passport photo",
                      "School results with subjects and symbols",
                      "Certified copies of qualifications",
                      "Emergency contact details",
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Track */}
            <TabsContent value="track">
              <div className="mx-auto max-w-3xl space-y-5">
                <div className="flex items-center gap-4">
                  <IconBadge icon={Search} />
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">My applications</h2>
                    <p className="text-muted-foreground">Track screening and registration progress for every submission.</p>
                  </div>
                </div>
                {!session ? (
                  <Alert>
                    <AlertDescription>
                      Sign in to see the applications you have submitted.{" "}
                      <Button variant="link" className="h-auto p-0 font-medium underline whitespace-normal" onClick={() => navigate("/auth")}>
                        Sign in
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : appsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <LoadingIndicator className="h-4 w-4" /> Loading...
                  </div>
                ) : !myApplications?.length ? (
                  <Card className="border-dashed">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                        <FileText className="h-5 w-5" />
                      </div>
                      No applications yet.
                      <div className="mt-4">
                        <Button onClick={() => setTab("apply")}>Start an application</Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  myApplications.map((app: any) => (
                    <Card key={app.id} className="border-border/60 transition-shadow hover:shadow-md">
                      <CardHeader className="flex flex-row items-start justify-between space-y-0">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{app.application_number}</CardTitle>
                            <CardDescription>
                              {app.trades?.name || "Trade"} · {app.intake} {app.academic_year}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant={statusTone(app.qualification_status)}>
                            {statusLabel(app.qualification_status)}
                          </Badge>
                          <Badge variant="outline">{statusLabel(app.registration_status)}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground">
                        Submitted {new Date(app.created_at).toLocaleDateString()}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </main>

      <footer className="border-t bg-muted/30 py-12">
        <div className="container mx-auto grid gap-8 px-4 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5 font-semibold">
              <AppLogo />
              VTC Management System
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Applications, training, assessment and finance for vocational training centres.
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="font-medium">Applicants</div>
            <Button variant="link" className="flex h-auto p-0 text-muted-foreground hover:text-foreground" onClick={() => setTab("apply")}>
              Apply online
            </Button>
            <Button variant="link" className="flex h-auto p-0 text-muted-foreground hover:text-foreground" onClick={() => setTab("track")}>
              Track my application
            </Button>
            <Button variant="link" className="flex h-auto p-0 text-muted-foreground hover:text-foreground" onClick={() => setTab("home")}>
              How applying works
            </Button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="font-medium">Centre staff</div>
            <Button variant="link" className="flex h-auto p-0 text-muted-foreground hover:text-foreground" onClick={() => navigate("/auth")}>
              Staff sign in
            </Button>
            <Button variant="link" className="flex h-auto p-0 text-muted-foreground hover:text-foreground" onClick={() => navigate("/online-applications")}>
              Online applications inbox
            </Button>
            <Button variant="link" className="flex h-auto p-0 text-muted-foreground hover:text-foreground" onClick={() => navigate("/applications-inbox?new=1")}>
              Capture an application
            </Button>
          </div>

        </div>
        <div className="container mx-auto mt-10 border-t px-4 pt-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} VTC Management System
        </div>
      </footer>

      <ComprehensiveApplicationForm
        open={formOpen && !applicationsClosed}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmit}
        isSubmitting={submitApplication.isPending}
        organizationIdOverride={activeOrgId}
        enableAutoSave={false}
      />
    </div>
  );
};

export default PublicHome;
