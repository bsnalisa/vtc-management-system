import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Loader2, Lock, CheckCircle, AlertCircle } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const FirstLoginPasswordChange = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [changeComplete, setChangeComplete] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // No session, redirect to auth
        navigate("/auth", { replace: true });
        return;
      }

      // Check if this user needs password reset
      const isTrainee = session.user.user_metadata?.is_trainee;
      const passwordResetRequired = session.user.user_metadata?.password_reset_required;

      if (!isTrainee || !passwordResetRequired) {
        // Not a trainee or doesn't need reset, redirect to dashboard
        navigate("/trainee-dashboard", { replace: true });
        return;
      }

      setCheckingSession(false);
    };

    checkSession();
  }, [navigate]);

  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = [];
    
    if (pwd.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }
    if (!/[A-Z]/.test(pwd)) {
      errors.push("Password must contain at least one uppercase letter");
    }
    if (!/[a-z]/.test(pwd)) {
      errors.push("Password must contain at least one lowercase letter");
    }
    if (!/[0-9]/.test(pwd)) {
      errors.push("Password must contain at least one number");
    }
    if (pwd === "Password1") {
      errors.push("You cannot use the default password");
    }
    
    return errors;
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPasswordErrors(validatePassword(value));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const errors = validatePassword(password);
    if (errors.length > 0) {
      setPasswordErrors(errors);
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are identical.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Update password
      const { error: updateError } = await supabase.auth.updateUser({ 
        password,
        data: {
          password_reset_required: false
        }
      });

      if (updateError) {
        throw updateError;
      }

      // Also update the trainee record
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('trainees')
          .update({ password_reset_required: false })
          .eq('user_id', user.id);
      }

      setChangeComplete(true);
      toast({
        title: "Password changed successfully",
        description: "You can now access your portal with your new password.",
      });

      // Redirect after a short delay
      setTimeout(() => {
        navigate("/trainee-dashboard", { replace: true });
      }, 2000);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (changeComplete) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto h-12 w-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-500" />
            </div>
            <CardTitle>Password Changed Successfully</CardTitle>
            <CardDescription>
              Your password has been updated. Redirecting to your dashboard...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-lg bg-primary flex items-center justify-center mb-4">
            <Lock className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle>Change Your Password</CardTitle>
          <CardDescription>
            For security, you must change your default password before accessing the portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  This is your first login. Please create a secure password to continue.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                placeholder="Enter new password"
                required
                minLength={8}
                className={passwordErrors.length > 0 ? "border-destructive" : ""}
              />
              {passwordErrors.length > 0 && (
                <ul className="text-xs text-destructive space-y-1 mt-1">
                  {passwordErrors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={8}
              />
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Password requirements:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>At least 8 characters</li>
                <li>One uppercase letter</li>
                <li>One lowercase letter</li>
                <li>One number</li>
              </ul>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || passwordErrors.length > 0}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing Password...
                </>
              ) : (
                "Change Password & Continue"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default FirstLoginPasswordChange;