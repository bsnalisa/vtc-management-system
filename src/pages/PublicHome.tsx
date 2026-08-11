import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  GraduationCap, Building2, FileText, Search, ArrowRight, CheckCircle2,
  ClipboardList, Wallet, BookOpen, Loader2, LogIn, MapPin,
} from "lucide-react";
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

const PublicHome = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tab, setTab] = useState(slug || searchParams.get("tab") === "apply" ? "apply" : "home");
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [formOpen, setFormOpen] = useState(false);

  const { data: organizations, isLoading: orgsLoading } = useActiveOrganizations();
  const { data: linkedOrg } = useOrganizationBySlug(slug);
  const { data: myApplications, isLoading: appsLoading } = useMyApplications();

  const lockedToCentre = !!linkedOrg;
  const activeOrgId = linkedOrg?.id || selectedOrg;
  const activeOrgName =
    linkedOrg?.name || organizations?.find((o) => o.id === selectedOrg)?.name || "";

  const submitApplication = useSubmitOnlineApplication(activeOrgId);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (data: ComprehensiveApplicationData) => {
    await submitApplication.mutateAsync(data);
    setFormOpen(false);
    setTab("track");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">VTC Management System</span>
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
          {/* Hero */}
          <section className="relative overflow-hidden border-b bg-gradient-to-br from-primary via-primary/90 to-accent">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary-foreground/10" />
            <div className="absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-primary-foreground/5" />
            <div className="container relative mx-auto px-4 py-14 md:py-20">
              <div className="max-w-3xl space-y-5 text-primary-foreground">
                <Badge variant="secondary" className="w-fit">TVET Management Platform</Badge>
                <h1 className="text-3xl font-bold leading-tight md:text-5xl">
                  {linkedOrg ? `Apply to ${linkedOrg.name}` : "One platform for every Vocational Training Centre"}
                </h1>
                <p className="text-base opacity-90 md:text-lg">
                  Apply online, track your admission status, and manage training, assessment
                  and finance from application through to certification.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button size="lg" variant="secondary" onClick={() => setTab("apply")}>
                    Start an application <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                    onClick={() => setTab("track")}
                  >
                    <Search className="mr-2 h-4 w-4" /> Track my application
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <div className="container mx-auto px-4 py-8">
            <TabsList className="mb-8 grid w-full max-w-xl grid-cols-3">
              <TabsTrigger value="home">Overview</TabsTrigger>
              <TabsTrigger value="apply">Online Application</TabsTrigger>
              <TabsTrigger value="track">My Applications</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="home" className="space-y-12">
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {FEATURES.map((f) => (
                  <Card key={f.title} className="relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/5" />
                    <CardHeader>
                      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <f.icon className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-base">{f.title}</CardTitle>
                      <CardDescription>{f.desc}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </section>

              <section className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold">Participating training centres</h2>
                  <p className="text-muted-foreground">Choose a centre to apply to — your details go straight to that centre.</p>
                </div>
                {orgsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading centres...
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {organizations?.map((org) => (
                      <Card key={org.id} className="transition-shadow hover:shadow-md">
                        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                          {org.logo_url ? (
                            <img src={org.logo_url} alt={`${org.name} logo`} className="h-10 w-10 rounded-md object-contain" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                              <Building2 className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <CardTitle className="truncate text-base">{org.name}</CardTitle>
                            {org.subdomain && (
                              <CardDescription className="flex items-center gap-1 truncate">
                                <MapPin className="h-3 w-3" /> {org.subdomain}
                              </CardDescription>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setSelectedOrg(org.id);
                              setTab("apply");
                            }}
                          >
                            Apply to this centre
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            </TabsContent>

            {/* Apply */}
            <TabsContent value="apply" className="space-y-6">
              <div className="mx-auto max-w-2xl space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" /> Online application
                    </CardTitle>
                    <CardDescription>
                      Complete the official application form. Your submission is sent directly to
                      the training centre you select.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label>Training centre</Label>
                      {lockedToCentre ? (
                        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          <span className="font-medium">{linkedOrg?.name}</span>
                        </div>
                      ) : (
                        <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                          <SelectTrigger>
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
                          <button className="font-medium underline" onClick={() => navigate("/auth")}>
                            Sign in or create an account
                          </button>
                          .
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button
                      className="w-full"
                      size="lg"
                      disabled={!activeOrgId || !session}
                      onClick={() => setFormOpen(true)}
                    >
                      {activeOrgId ? `Start application${activeOrgName ? ` — ${activeOrgName}` : ""}` : "Select a centre to continue"}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Before you start</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    {[
                      "National ID / passport number and a passport photo",
                      "School results with subjects and symbols",
                      "Certified copies of qualifications",
                      "Emergency contact details",
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-2">
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
              <div className="mx-auto max-w-3xl space-y-4">
                <h2 className="text-2xl font-bold">My applications</h2>
                {!session ? (
                  <Alert>
                    <AlertDescription>
                      Sign in to see the applications you have submitted.{" "}
                      <button className="font-medium underline" onClick={() => navigate("/auth")}>
                        Sign in
                      </button>
                    </AlertDescription>
                  </Alert>
                ) : appsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                  </div>
                ) : !myApplications?.length ? (
                  <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">
                      No applications yet.
                      <div className="mt-4">
                        <Button onClick={() => setTab("apply")}>Start an application</Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  myApplications.map((app: any) => (
                    <Card key={app.id}>
                      <CardHeader className="flex flex-row items-start justify-between space-y-0">
                        <div>
                          <CardTitle className="text-base">{app.application_number}</CardTitle>
                          <CardDescription>
                            {app.trades?.name || "Trade"} · {app.intake} {app.academic_year}
                          </CardDescription>
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

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} VTC Management System
        </div>
      </footer>

      <ComprehensiveApplicationForm
        open={formOpen}
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
