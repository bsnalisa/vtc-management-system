import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, ArrowLeft, AlertCircle } from "lucide-react";
import { getRoleDashboardPath } from "@/lib/roleUtils";
import { UserRole, setRoleCache } from "@/hooks/useUserRole";
import { setProfileUserId } from "@/hooks/useProfile";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { 
  validateEmail, 
  checkRateLimit, 
  resetRateLimit,
  sanitizeInput 
} from "@/lib/authValidation";

// Fetch user role directly from database
const fetchUserRole = async (userId: string): Promise<UserRole> => {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching user role:", error);
    return null;
  }
  
  const role = (data?.role as UserRole) || null;
  
  // Pre-cache the role for faster dashboard load
  if (role) {
    setRoleCache(userId, role);
    setProfileUserId(userId);
  }
  
  return role;
};

// Check if trainee needs password reset on first login
const checkTraineePasswordReset = async (userId: string): Promise<boolean> => {
  // Check user metadata first
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.user_metadata?.password_reset_required) {
    return true;
  }

  // Check trainee record
  const { data } = await supabase
    .from("trainees")
    .select("password_reset_required")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.password_reset_required === true;
};

// Log login attempt to database
const logLoginAttempt = async (email: string, success: boolean, failureReason?: string) => {
  try {
    await supabase.from("login_attempts").insert({
      email: sanitizeInput(email),
      success,
      failure_reason: failureReason || null,
    });
  } catch (e) {
    // Silently fail - don't block login for logging errors
  }
};

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  
  // Check if user is already logged in and redirect to their dashboard
  useEffect(() => {
    const checkSessionAndRedirect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const role = await fetchUserRole(session.user.id);
        const dashboardPath = getRoleDashboardPath(role);
        navigate(dashboardPath || "/dashboard", { replace: true });
      } else {
        setCheckingSession(false);
      }
    };
    
    checkSessionAndRedirect();
  }, [navigate]);

  const validateEmailInput = (email: string): boolean => {
    const result = validateEmail(email);
    if (!result.valid) {
      setEmailError(result.error || "Invalid email");
      return false;
    }
    setEmailError(null);
    return true;
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = sanitizeInput(formData.get("signin-email") as string);
    const password = formData.get("signin-password") as string;

    // Validate email
    if (!validateEmailInput(email)) {
      return;
    }

    // Check rate limiting
    const rateLimitKey = `login_${email}`;
    const rateLimit = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000); // 5 attempts per 15 min
    
    if (!rateLimit.allowed) {
      const minutesLeft = Math.ceil(rateLimit.resetIn / 60000);
      setRateLimitError(`Too many login attempts. Please try again in ${minutesLeft} minutes.`);
      await logLoginAttempt(email, false, "Rate limited");
      return;
    }
    setRateLimitError(null);

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      await logLoginAttempt(email, false, error.message);
      
      // Show user-friendly error messages
      let errorMessage = error.message;
      if (error.message.includes("Invalid login credentials")) {
        errorMessage = "Invalid email or password. Please try again.";
      } else if (error.message.includes("Email not confirmed")) {
        errorMessage = "Please verify your email address before signing in.";
      }
      
      toast({
        title: "Sign in failed",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }

    // Successful login
    if (data.user) {
      await logLoginAttempt(email, true);
      resetRateLimit(rateLimitKey);
      
      const role = await fetchUserRole(data.user.id);
      
      // Check if trainee needs password reset on first login
      if (role === 'trainee') {
        const needsPasswordReset = await checkTraineePasswordReset(data.user.id);
        if (needsPasswordReset) {
          setLoading(false);
          navigate("/first-login", { replace: true });
          return;
        }
      }
      
      const dashboardPath = getRoleDashboardPath(role);
      setLoading(false);
      navigate(dashboardPath || "/dashboard", { replace: true });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = sanitizeInput(formData.get("reset-email") as string);

    // Validate email
    if (!validateEmailInput(email)) {
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setResetSent(true);
      toast({
        title: "Reset email sent",
        description: "Check your email for a password reset link",
        variant: "default",
      });
    }
  };

  const handleBackToSignIn = () => {
    setForgotPassword(false);
    setResetSent(false);
    setEmailError(null);
    setRateLimitError(null);
  };

  // Show loading while checking existing session
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Checking session..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-lg bg-primary flex items-center justify-center mb-4">
            <GraduationCap className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle>VTC Management System</CardTitle>
          <CardDescription>
            {forgotPassword 
              ? "Reset your password" 
              : "Complete training centre management solution"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Rate Limit Error */}
          {rateLimitError && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {rateLimitError}
            </div>
          )}

          {forgotPassword ? (
            <>
              {resetSent ? (
                <div className="text-center space-y-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-green-600 dark:text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold">Check your email</h3>
                  <p className="text-sm text-muted-foreground">
                    We've sent a password reset link to your email address. 
                    Click the link in the email to reset your password.
                  </p>
                  <Button 
                    onClick={handleBackToSignIn} 
                    variant="outline" 
                    className="w-full mt-4"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input
                      id="reset-email"
                      name="reset-email"
                      type="email"
                      placeholder="your@email.com"
                      required
                      className={emailError ? "border-destructive" : ""}
                      onChange={() => setEmailError(null)}
                    />
                    {emailError && (
                      <p className="text-sm text-destructive">{emailError}</p>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enter your email address and we'll send you a link to reset your password.
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex-1"
                      onClick={handleBackToSignIn}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1" 
                      disabled={loading}
                    >
                      {loading ? "Sending..." : "Send Reset Link"}
                    </Button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <>
              <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    name="signin-email"
                    type="email"
                    placeholder="your@email.com"
                    required
                    className={emailError ? "border-destructive" : ""}
                    onChange={() => setEmailError(null)}
                  />
                  {emailError && (
                    <p className="text-sm text-destructive">{emailError}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="signin-password">Password</Label>
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 h-auto text-sm text-primary hover:text-primary/80"
                      onClick={() => setForgotPassword(true)}
                    >
                      Forgot password?
                    </Button>
                  </div>
                  <Input
                    id="signin-password"
                    name="signin-password"
                    type="password"
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || !!rateLimitError}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      Signing in...
                    </span>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
              <p className="text-sm text-muted-foreground text-center mt-4">
                Contact your administrator to create an account
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
