import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePackages, useAssignPackage } from "@/hooks/usePackages";
import { useUpdateOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { useCreateUser } from "@/hooks/useUsers";
import { Upload, CheckCircle2 } from "lucide-react";
import { z } from "zod";

const setupSchema = z.object({
  organizationName: z.string().min(3, "Organization name must be at least 3 characters"),
  adminEmail: z.string().email("Invalid email address"),
  adminPassword: z.string().min(8, "Password must be at least 8 characters"),
  adminName: z.string().min(2, "Name must be at least 2 characters"),
});

const SetupWizard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Step 1: Organization Details
  const [orgName, setOrgName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  
  // Step 2: Package Selection
  const [selectedPackage, setSelectedPackage] = useState("");
  const { data: packages } = usePackages();
  
  // Step 3: Branding
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#222222");
  
  // Step 4: Admin User
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminName, setAdminName] = useState("");
  
  const assignPackage = useAssignPackage();
  const updateSettings = useUpdateOrganizationSettings();
  const createUser = useCreateUser();

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      // Validate admin details
      const validation = setupSchema.safeParse({
        organizationName: orgName,
        adminEmail,
        adminPassword,
        adminName,
      });

      if (!validation.success) {
        toast({
          title: "Validation Error",
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        return;
      }

      // 1. Create organization
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert([{ name: orgName, package: "basic" }])
        .select()
        .single();

      if (orgError) throw orgError;

      // 2. Upload logo if provided
      let logoUrl = null;
      if (logoFile && org) {
        const fileExt = logoFile.name.split(".").pop();
        const fileName = `${org.id}/logo.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, logoFile);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("avatars")
            .getPublicUrl(fileName);
          logoUrl = urlData.publicUrl;
        }
      }

      // 3. Create organization settings
      if (org) {
        await updateSettings.mutateAsync({
          logo_url: logoUrl,
          color_theme: {
            primary: primaryColor,
            secondary: "hsl(210 40% 96.1%)",
            accent: "hsl(210 40% 96.1%)",
          },
        });
      }

      // 4. Assign package
      if (selectedPackage && org) {
        await assignPackage.mutateAsync({
          organizationId: org.id,
          packageId: selectedPackage,
          isTrial: false,
        });
      }

      // 5. Create admin user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: adminEmail,
        password: adminPassword,
        options: {
          data: {
            full_name: adminName,
          },
        },
      });

      if (authError) throw authError;

      // 6. Assign admin role
      if (authData.user && org) {
        await supabase
          .from("user_roles")
          .insert([
            {
              user_id: authData.user.id,
              role: "organization_admin",
              organization_id: org.id,
            },
          ]);
      }

      toast({
        title: "Setup Complete!",
        description: "Your organization has been set up successfully.",
      });

      // Redirect to login
      setTimeout(() => {
        navigate("/auth");
      }, 2000);

    } catch (error) {
      console.error("Setup error:", error);
      const errorMessage = error instanceof Error ? error.message : "Setup failed";
      toast({
        title: "Setup Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name *</Label>
              <Input
                id="orgName"
                value={orgName}
                onChange={(e) => {
                  setOrgName(e.target.value);
                  setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""));
                }}
                placeholder="e.g., Nairobi Vocational Training Centre"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subdomain">Subdomain Preview</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="subdomain"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  placeholder="nairobi-vtc"
                />
                <span className="text-sm text-muted-foreground">.nvtc.app</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Your organization will be accessible at {subdomain || "your-vtc"}.nvtc.app
              </p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <Label>Select Your Package</Label>
            {packages?.map((pkg) => (
              <Card
                key={pkg.id}
                className={`cursor-pointer transition-all ${
                  selectedPackage === pkg.id ? "border-primary ring-2 ring-primary" : ""
                }`}
                onClick={() => setSelectedPackage(pkg.id)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {pkg.name}
                    {selectedPackage === pkg.id && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </CardTitle>
                  <CardDescription>{pkg.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${pkg.price}/{pkg.billing_cycle}
                  </div>
                  <ul className="mt-4 space-y-2">
                    {pkg.features.map((feature, idx) => (
                      <li key={idx} className="text-sm">✓ {feature}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Organization Logo (Optional)</Label>
              <div className="flex items-center gap-4">
                {logoPreview && (
                  <img src={logoPreview} alt="Logo preview" className="h-20 w-20 object-contain" />
                )}
                <label className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover:bg-accent">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">Upload Logo</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Brand Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="primaryColor"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-20 cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#222222"
                />
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adminName">Admin Name *</Label>
              <Input
                id="adminName"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminEmail">Admin Email *</Label>
              <Input
                id="adminEmail"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminPassword">Admin Password *</Label>
              <Input
                id="adminPassword"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••"
              />
              <p className="text-xs text-muted-foreground">
                Minimum 8 characters
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Setup Your VTC Organization</CardTitle>
          <CardDescription>
            Step {step} of {totalSteps}
          </CardDescription>
          <Progress value={progress} className="mt-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          {renderStep()}

          <div className="flex justify-between pt-4">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={loading}>
                Previous
              </Button>
            )}
            <div className="ml-auto">
              {step < totalSteps ? (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={
                    (step === 1 && !orgName) ||
                    (step === 2 && !selectedPackage) ||
                    loading
                  }
                >
                  Next
                </Button>
              ) : (
                <Button onClick={handleComplete} disabled={loading || !adminEmail || !adminPassword || !adminName}>
                  {loading ? "Setting up..." : "Complete Setup"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupWizard;
