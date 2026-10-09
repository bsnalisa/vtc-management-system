import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLogo } from "@/components/AppLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ButtonSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { getRoleDashboardPath } from "@/lib/roleUtils";

/** Where a signed-in user belongs: staff/trainees go to their role dashboard, everyone else is an applicant. */
export const resolveApplicantDestination = async (userId: string) => {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).limit(1).maybeSingle();
  if (data?.role) return getRoleDashboardPath(data.role as any) || "/dashboard";
  return "/applicant/dashboard";
};

const ApplicantAuth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const [tab, setTab] = useState("signup");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) navigate(await resolveApplicantDestination(data.session.user.id), { replace: true });
    });
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const firstname = String(f.get("firstname") || "").trim();
    const surname = String(f.get("surname") || "").trim();
    const email = String(f.get("email") || "").trim().toLowerCase();
    const phone = String(f.get("phone") || "").trim();
    const password = String(f.get("password") || "");
    const confirm = String(f.get("confirm") || "");
    if (!firstname || !surname) return toast({ title: "Enter your first name and surname", variant: "destructive" });
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
      return toast({ title: "Password too weak", description: "Use at least 8 characters with letters and numbers.", variant: "destructive" });
    if (password !== confirm) return toast({ title: "Passwords do not match", variant: "destructive" });

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/applicant/dashboard`,
        data: { firstname, surname, full_name: `${firstname} ${surname}`, phone, account_type: "applicant" },
      },
    });
    setLoading(false);
    if (error) {
      const msg = /registered|exists/i.test(error.message)
        ? "An account with this email already exists. Please sign in instead."
        : error.message;
      return toast({ title: "Could not create account", description: msg, variant: "destructive" });
    }
    if (!data.session) return setCheckEmail(true);
    toast({ title: "Account created", description: "Welcome! You can now start your application." });
    navigate("/applicant/dashboard", { replace: true });
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(f.get("email") || "").trim().toLowerCase(),
      password: String(f.get("password") || ""),
    });
    if (error || !data.user) {
      setLoading(false);
      return toast({ title: "Sign in failed", description: "Invalid email or password.", variant: "destructive" });
    }
    const dest = await resolveApplicantDestination(data.user.id);
    setLoading(false);
    navigate(dest, { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link to="/" className="mx-auto"><AppLogo /></Link>
          <CardTitle className="pt-2 text-2xl">Applicant account</CardTitle>
          <CardDescription>
            Create an account to apply to a training centre, save your progress and track your application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checkEmail ? (
            <Alert>
              <AlertDescription>
                Check your email and click the confirmation link to activate your account, then sign in here.
              </AlertDescription>
            </Alert>
          ) : (
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signup">Create account</TabsTrigger>
                <TabsTrigger value="signin">Sign in</TabsTrigger>
              </TabsList>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-3 pt-2">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label htmlFor="firstname">First name</Label><Input id="firstname" name="firstname" required autoComplete="given-name" /></div>
                    <div className="space-y-1.5"><Label htmlFor="surname">Surname</Label><Input id="surname" name="surname" required autoComplete="family-name" /></div>
                  </div>
                  <div className="space-y-1.5"><Label htmlFor="su-email">Email</Label><Input id="su-email" name="email" type="email" required autoComplete="email" /></div>
                  <div className="space-y-1.5"><Label htmlFor="phone">Phone (optional)</Label><Input id="phone" name="phone" type="tel" autoComplete="tel" /></div>
                  <div className="space-y-1.5"><Label htmlFor="su-password">Password</Label><Input id="su-password" name="password" type="password" required minLength={8} autoComplete="new-password" /></div>
                  <div className="space-y-1.5"><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" name="confirm" type="password" required autoComplete="new-password" /></div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <ButtonSpinner />} Create applicant account
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-3 pt-2">
                  <div className="space-y-1.5"><Label htmlFor="si-email">Email</Label><Input id="si-email" name="email" type="email" required autoComplete="email" /></div>
                  <div className="space-y-1.5"><Label htmlFor="si-password">Password</Label><Input id="si-password" name="password" type="password" required autoComplete="current-password" /></div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <ButtonSpinner />} Sign in
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Forgot your password? <Link to="/auth" className="text-primary underline">Reset it here</Link>
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          )}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Staff and registered trainees: accounts are created by your centre.{" "}
            <Link to="/auth" className="text-primary underline">Sign in here</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApplicantAuth;
