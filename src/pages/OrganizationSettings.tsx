import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useOrganizationSettings, useUpdateOrganizationSettings } from "@/hooks/useOrganizationSettings";
import { Loader2, Palette, Upload, Image as ImageIcon, CheckCircle, AlertCircle, Globe, X, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { hexToHSL, hslToHex } from "@/lib/colorUtils";

export default function OrganizationSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { navItems, groupLabel } = useRoleNavigation();
  const { data: settings, isLoading } = useOrganizationSettings();
  const updateSettings = useUpdateOrganizationSettings();
  const { organizationId } = useOrganizationContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [primaryColor, setPrimaryColor] = useState("#0F172A");
  const [secondaryColor, setSecondaryColor] = useState("#3B82F6");
  const [accentColor, setAccentColor] = useState("#10B981");
  const [logoUrl, setLogoUrl] = useState("");
  const [domain, setDomain] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [traineeIdPrefix, setTraineeIdPrefix] = useState("VTC");
  const [uploading, setUploading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [domainStatus, setDomainStatus] = useState<"pending" | "verified" | "failed">("pending");
  const [enableCustomDomain, setEnableCustomDomain] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Sync state with settings when loaded
  useEffect(() => {
    if (settings) {
      if (settings.color_theme?.primary) {
        setPrimaryColor(hslToHex(settings.color_theme.primary));
      }
      if (settings.color_theme?.secondary) {
        setSecondaryColor(hslToHex(settings.color_theme.secondary));
      }
      if (settings.color_theme?.accent) {
        setAccentColor(hslToHex(settings.color_theme.accent));
      }
      if (settings.logo_url) {
        setLogoUrl(settings.logo_url);
      }
      if (settings.domain) {
        setDomain(settings.domain);
        setEnableCustomDomain(true);
      }
      if (settings.organization_name) {
        setOrganizationName(settings.organization_name);
      }
      if (settings.trainee_id_prefix) {
        setTraineeIdPrefix(settings.trainee_id_prefix);
      }

      checkDomainVerification(settings.domain);
    }
  }, [settings]);

  // Check if form is dirty
  useEffect(() => {
    if (settings) {
      const currentPrimary = settings.color_theme?.primary ? hslToHex(settings.color_theme.primary) : "#0F172A";
      const currentSecondary = settings.color_theme?.secondary ? hslToHex(settings.color_theme.secondary) : "#3B82F6";
      const currentAccent = settings.color_theme?.accent ? hslToHex(settings.color_theme.accent) : "#10B981";

      const hasChanges =
        primaryColor !== currentPrimary ||
        secondaryColor !== currentSecondary ||
        accentColor !== currentAccent ||
        logoUrl !== (settings.logo_url || "") ||
        domain !== (settings.domain || "") ||
        organizationName !== (settings.organization_name || "") ||
        traineeIdPrefix !== (settings.trainee_id_prefix || "VTC") ||
        selectedFile !== null; // Consider selected file as a change

      setIsDirty(hasChanges);
    }
  }, [primaryColor, secondaryColor, accentColor, logoUrl, domain, organizationName, traineeIdPrefix, selectedFile, settings]);

  const checkDomainVerification = async (domain: string) => {
    if (!domain) {
      setDomainStatus("pending");
      return;
    }

    setTimeout(() => {
      const statuses: Array<"pending" | "verified" | "failed"> = ["pending", "verified", "failed"];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      setDomainStatus(randomStatus);
    }, 1000);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log("File selected:", file.name, file.type, file.size);
    setSelectedFile(file);

    // Immediately validate and upload the file
    handleFileUpload(file);
  };

  const handleFileUpload = async (file: File) => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    if (!organizationId) {
      toast({
        title: "No organization ID",
        description: "Please log in again to continue.",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: `Please upload a JPEG, PNG, WebP, or SVG image. Selected: ${file.type}`,
        variant: "destructive",
      });
      setSelectedFile(null);
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: `Please upload an image smaller than 5MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
        variant: "destructive",
      });
      setSelectedFile(null);
      return;
    }

    setUploading(true);

    try {
      // Create a unique file name with timestamp to avoid cache issues
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "png";
      const timestamp = Date.now();
      const fileName = `${organizationId}/logo-${timestamp}.${fileExt}`;

      console.log("Uploading file:", fileName);

      // Upload to storage
      const { error: uploadError } = await supabase.storage.from("organization-logos").upload(fileName, file, {
        upsert: true,
        cacheControl: "3600",
      });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }

      // Get public URL with cache busting
      const {
        data: { publicUrl },
      } = supabase.storage.from("organization-logos").getPublicUrl(fileName);

      // Add timestamp to URL to prevent caching
      const finalLogoUrl = `${publicUrl}?t=${timestamp}`;
      console.log("Logo URL:", finalLogoUrl);

      setLogoUrl(finalLogoUrl);
      setSelectedFile(null); // Clear selected file after successful upload
      setIsDirty(true);

      toast({
        title: "Logo uploaded successfully",
        description: "Your logo has been uploaded. Click 'Save Settings' to apply changes.",
        variant: "default",
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
      setSelectedFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!logoUrl || !organizationId) return;

    try {
      // Extract filename from URL to delete from storage
      const urlParts = logoUrl.split("/");
      const fileName = urlParts[urlParts.length - 1].split("?")[0];
      const fullPath = `${organizationId}/${fileName}`;

      console.log("Attempting to delete:", fullPath);

      const { error: deleteError } = await supabase.storage.from("organization-logos").remove([fullPath]);

      if (deleteError) {
        console.error("Delete error:", deleteError);
      }

      setLogoUrl("");
      setSelectedFile(null);
      setIsDirty(true);

      toast({
        title: "Logo removed",
        description: "Logo has been removed. Click 'Save Settings' to apply changes.",
      });
    } catch (error) {
      console.error("Remove logo error:", error);
      setLogoUrl("");
      setSelectedFile(null);
      setIsDirty(true);
    }
  };

  const handleSaveSettings = async () => {
    if (!organizationId) {
      toast({
        title: "Error",
        description: "No organization ID found. Please try logging in again.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Convert HEX to HSL before saving
      const primaryHSL = hexToHSL(primaryColor);
      const secondaryHSL = hexToHSL(secondaryColor);
      const accentHSL = hexToHSL(accentColor);

      await updateSettings.mutateAsync({
        logo_url: logoUrl,
        color_theme: {
          primary: primaryHSL,
          secondary: secondaryHSL,
          accent: accentHSL,
        },
        domain: enableCustomDomain ? domain : "",
        organization_name: organizationName,
        trainee_id_prefix: traineeIdPrefix.toUpperCase(),
      });

      // Apply theme immediately after saving
      const root = document.documentElement;
      root.style.setProperty('--primary', primaryHSL);
      root.style.setProperty('--secondary', secondaryHSL);
      root.style.setProperty('--accent', accentHSL);
      root.style.setProperty('--sidebar-primary', primaryHSL);
      root.style.setProperty('--sidebar-accent', accentHSL);

      setIsDirty(false);
      setSelectedFile(null);

      toast({
        title: "Settings saved successfully",
        description: "Theme has been applied to your organization.",
        variant: "default",
      });
    } catch (error) {
      console.error("Save settings error:", error);
      toast({
        title: "Save failed",
        description: "Failed to save organization settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    if (settings) {
      if (settings.color_theme?.primary) {
        setPrimaryColor(hslToHex(settings.color_theme.primary));
      }
      if (settings.color_theme?.secondary) {
        setSecondaryColor(hslToHex(settings.color_theme.secondary));
      }
      if (settings.color_theme?.accent) {
        setAccentColor(hslToHex(settings.color_theme.accent));
      }
      setLogoUrl(settings.logo_url || "");
      setDomain(settings.domain || "");
      setOrganizationName(settings.organization_name || "");
      setTraineeIdPrefix(settings.trainee_id_prefix || "VTC");
      setEnableCustomDomain(!!settings.domain);
    }
    setSelectedFile(null);
    setIsDirty(false);
  };

  const getDomainStatusBadge = () => {
    switch (domainStatus) {
      case "verified":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" /> Verified
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" /> Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Pending
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout
        title="Organization Settings"
        subtitle="Configure your organization preferences"
        navItems={navItems}
        groupLabel={groupLabel}
      >
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Organization Settings"
      subtitle="Configure your organization preferences and branding"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6">
        {/* Branding Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Branding & Theme
            </CardTitle>
            <CardDescription>Customize your organization's visual identity and color scheme</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="organizationName">Organization Name</Label>
                <Input
                  id="organizationName"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="Enter your organization name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="traineeIdPrefix" className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Trainee ID Prefix
                </Label>
                <Input
                  id="traineeIdPrefix"
                  value={traineeIdPrefix}
                  onChange={(e) => setTraineeIdPrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10))}
                  placeholder="e.g., NVTC, VVTC"
                  maxLength={10}
                  className="font-mono uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  This prefix will be used for trainee IDs (e.g., {traineeIdPrefix}202500001)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo">Organization Logo</Label>
              <div className="flex gap-6 items-start">
                <div className="flex-1 space-y-3">
                  <div className="flex gap-2">
                    <Input
                      id="logo"
                      value={logoUrl}
                      onChange={(e) => {
                        setLogoUrl(e.target.value);
                        setIsDirty(true);
                      }}
                      placeholder="Logo URL or upload a file"
                      className="flex-1"
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.svg,image/jpeg,image/png,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="whitespace-nowrap"
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {uploading ? "Uploading..." : "Upload"}
                    </Button>
                  </div>

                  {/* File selection info */}
                  {selectedFile && (
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                      <p className="text-blue-800">
                        <strong>Selected file:</strong> {selectedFile.name}({Math.round(selectedFile.size / 1024)} KB)
                      </p>
                      <p className="text-blue-600 text-xs mt-1">File will be uploaded automatically when selected</p>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Upload an image (max 5MB) or enter a URL. Supported: JPEG, PNG, WebP, SVG
                  </p>
                </div>

                <div className="flex flex-col items-center gap-2">
                  {logoUrl ? (
                    <div className="relative">
                      <div className="w-32 h-32 border rounded-lg flex items-center justify-center bg-muted overflow-hidden">
                        <img
                          src={logoUrl}
                          alt="Organization Logo"
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => {
                            console.error("Image load error:", logoUrl);
                            e.currentTarget.src = "";
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="w-32 h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center bg-muted text-muted-foreground">
                      <ImageIcon className="h-8 w-8 mb-2" />
                      <span className="text-xs text-center px-2">No logo uploaded</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <Label htmlFor="primary" className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: primaryColor }} />
                  Primary Color
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="primary"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-20 cursor-pointer"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#0F172A"
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="secondary" className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: secondaryColor }} />
                  Secondary Color
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="secondary"
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-10 w-20 cursor-pointer"
                  />
                  <Input
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    placeholder="#3B82F6"
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="accent" className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: accentColor }} />
                  Accent Color
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="accent"
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-10 w-20 cursor-pointer"
                  />
                  <Input
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    placeholder="#10B981"
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Color Preview */}
            <div className="p-4 border rounded-lg bg-muted/50">
              <Label className="text-sm font-medium">Color Preview</Label>
              <div className="mt-2 flex gap-2">
                <div className="h-8 flex-1 rounded transition-all" style={{ backgroundColor: primaryColor }} />
                <div className="h-8 flex-1 rounded transition-all" style={{ backgroundColor: secondaryColor }} />
                <div className="h-8 flex-1 rounded transition-all" style={{ backgroundColor: accentColor }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="outline" onClick={handleReset} disabled={!isDirty || updateSettings.isPending}>
            Reset Changes
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} disabled={(!isDirty && !selectedFile) || updateSettings.isPending}>
              {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Settings
            </Button>
          </div>
        </div>

        {/* Unsaved Changes Alert */}
        {isDirty && (
          <div className="fixed bottom-4 right-4 p-3 bg-amber-50 border border-amber-200 rounded-lg shadow-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">You have unsaved changes</span>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
