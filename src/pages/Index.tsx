import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { organizationAdminNavItems } from "@/lib/navigationConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useOrganizationSettings, useUpdateOrganizationSettings } from "@/hooks/useOrganizationSettings";
import {
  Loader2,
  Palette,
  Upload,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  Globe,
  X,
  Save,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { hexToHSL, hslToHex } from "@/lib/colorUtils";

export default function OrganizationSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
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
  const [uploading, setUploading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [domainStatus, setDomainStatus] = useState<"pending" | "verified" | "failed">("pending");
  const [enableCustomDomain, setEnableCustomDomain] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (settings) {
      if (settings.color_theme?.primary) {
        const primaryHex = hslToHex(settings.color_theme.primary);
        setPrimaryColor(primaryHex);
      }
      if (settings.color_theme?.secondary) {
        const secondaryHex = hslToHex(settings.color_theme.secondary);
        setSecondaryColor(secondaryHex);
      }
      if (settings.color_theme?.accent) {
        const accentHex = hslToHex(settings.color_theme.accent);
        setAccentColor(accentHex);
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

      checkDomainVerification(settings.domain);
    }
  }, [settings]);

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
        selectedFile !== null;

      setIsDirty(hasChanges);
    }
  }, [primaryColor, secondaryColor, accentColor, logoUrl, domain, organizationName, selectedFile, settings]);

  useEffect(() => {
    if (primaryColor && secondaryColor && accentColor) {
      applyColorsToDocument();
    }
  }, [primaryColor, secondaryColor, accentColor]);

  const applyColorsToDocument = () => {
    const root = document.documentElement;
    const primaryRGB = hexToRGB(primaryColor);
    const secondaryRGB = hexToRGB(secondaryColor);
    const accentRGB = hexToRGB(accentColor);

    if (primaryRGB) {
      root.style.setProperty("--primary", primaryRGB);
      root.style.setProperty("--primary-foreground", getContrastColor(primaryColor));
    }
    if (secondaryRGB) {
      root.style.setProperty("--secondary", secondaryRGB);
      root.style.setProperty("--secondary-foreground", getContrastColor(secondaryColor));
    }
    if (accentRGB) {
      root.style.setProperty("--accent", accentRGB);
      root.style.setProperty("--accent-foreground", getContrastColor(accentColor));
    }
  };

  const hexToRGB = (hex: string): string => {
    hex = hex.replace(/^#/, "");
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `${r} ${g} ${b}`;
  };

  const getContrastColor = (hexcolor: string): string => {
    hexcolor = hexcolor.replace("#", "");
    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? "0 0 0" : "255 255 255";
  };

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
    setSelectedFile(file);
    handleFileUpload(file);
  };

  const handleFileUpload = async (file: File) => {
    if (!file || !organizationId) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: `Please upload a JPEG, PNG, WebP, or SVG image.`,
        variant: "destructive",
      });
      setSelectedFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: `Please upload an image smaller than 5MB.`,
        variant: "destructive",
      });
      setSelectedFile(null);
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "png";
      const timestamp = Date.now();
      const fileName = `${organizationId}/logo-${timestamp}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("organization-logos").upload(fileName, file, {
        upsert: true,
        cacheControl: "3600",
      });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("organization-logos").getPublicUrl(fileName);

      const finalLogoUrl = `${publicUrl}?t=${timestamp}`;
      setLogoUrl(finalLogoUrl);
      setSelectedFile(null);
      setIsDirty(true);

      toast({
        title: "Logo uploaded successfully",
        description: "Your logo has been uploaded. Click 'Save Settings' to apply changes.",
      });
    } catch (error: any) {
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
    setLogoUrl("");
    setSelectedFile(null);
    setIsDirty(true);
    toast({
      title: "Logo removed",
      description: "Logo has been removed. Click 'Save Settings' to apply changes.",
    });
  };

  const handleSaveSettings = async () => {
    try {
      const primaryHSL = hexToHSL(primaryColor);
      const secondaryHSL = hexToHSL(secondaryColor);
      const accentHSL = hexToHSL(accentColor);

      const updateData = {
        logo_url: logoUrl,
        color_theme: {
          primary: primaryHSL,
          secondary: secondaryHSL,
          accent: accentHSL,
        },
        domain: enableCustomDomain ? domain : "",
        organization_name: organizationName,
      };

      await updateSettings.mutateAsync(updateData);
      setIsDirty(false);
      setSelectedFile(null);

      toast({
        title: "Settings saved successfully",
        description: "Your organization settings have been updated.",
      });
    } catch (error) {
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
        const primaryHex = hslToHex(settings.color_theme.primary);
        setPrimaryColor(primaryHex);
      }
      if (settings.color_theme?.secondary) {
        const secondaryHex = hslToHex(settings.color_theme.secondary);
        setSecondaryColor(secondaryHex);
      }
      if (settings.color_theme?.accent) {
        const accentHex = hslToHex(settings.color_theme.accent);
        setAccentColor(accentHex);
      }
      setLogoUrl(settings.logo_url || "");
      setDomain(settings.domain || "");
      setOrganizationName(settings.organization_name || "");
      setEnableCustomDomain(!!settings.domain);
    }
    setSelectedFile(null);
    setIsDirty(false);
  };

  const getDomainStatusBadge = () => {
    switch (domainStatus) {
      case "verified":
        return (
          <Badge variant="default" className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
            <CheckCircle className="h-3 w-3 mr-1" /> Verified
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200 hover:bg-red-50">
            <AlertCircle className="h-3 w-3 mr-1" /> Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Pending
          </Badge>
        );
    }
  };

  const ColorPreview = () => (
    <div className="p-6 border rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/50">
      <Label className="text-sm font-semibold mb-4 block text-slate-700 dark:text-slate-300">Live Color Preview</Label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: primaryColor }}
            />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Primary</span>
          </div>
          <div
            className="h-12 rounded-lg shadow-sm flex items-center justify-center text-white font-medium text-sm transition-all hover:shadow-md"
            style={{ backgroundColor: primaryColor }}
          >
            Primary Action
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: secondaryColor }}
            />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Secondary</span>
          </div>
          <div
            className="h-12 rounded-lg shadow-sm flex items-center justify-center font-medium text-sm transition-all hover:shadow-md"
            style={{
              backgroundColor: secondaryColor,
              color: getContrastColor(secondaryColor) === "255 255 255" ? "white" : "black",
            }}
          >
            Secondary Action
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: accentColor }}
            />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Accent</span>
          </div>
          <div
            className="h-12 rounded-lg shadow-sm flex items-center justify-center font-medium text-sm transition-all hover:shadow-md"
            style={{
              backgroundColor: accentColor,
              color: getContrastColor(accentColor) === "255 255 255" ? "white" : "black",
            }}
          >
            Accent Element
          </div>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <DashboardLayout
        title="Organization Settings"
        subtitle="Configure your organization preferences"
        navItems={organizationAdminNavItems}
      >
        <div className="flex items-center justify-center h-96">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Loading settings...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Organization Settings"
      subtitle="Manage your organization's branding, theme, and domain preferences"
      navItems={organizationAdminNavItems}
    >
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Branding Settings */}
        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Branding & Theme</CardTitle>
                <CardDescription>Customize your organization's visual identity and color scheme</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="organizationName" className="text-sm font-semibold">
                  Organization Name
                </Label>
                <Input
                  id="organizationName"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="Enter your organization name"
                  className="border-slate-200 focus:border-primary transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Organization Logo</Label>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <div className="flex gap-2">
                      <Input
                        value={logoUrl}
                        onChange={(e) => {
                          setLogoUrl(e.target.value);
                          setIsDirty(true);
                        }}
                        placeholder="Logo URL"
                        className="flex-1 border-slate-200 focus:border-primary transition-colors"
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
                        className="whitespace-nowrap border-slate-200 hover:bg-slate-50"
                      >
                        {uploading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        {uploading ? "Uploading..." : "Upload"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Max 5MB. Supports JPEG, PNG, WebP, SVG</p>
                  </div>

                  <div className="flex-shrink-0">
                    {logoUrl ? (
                      <div className="relative group">
                        <div className="w-20 h-20 rounded-lg border-2 border-slate-200 flex items-center justify-center bg-white overflow-hidden">
                          <img
                            src={logoUrl}
                            alt="Organization Logo"
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                              e.currentTarget.src = "";
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </div>
                        <button
                          onClick={handleRemoveLogo}
                          className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-sm hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center bg-slate-50">
                        <ImageIcon className="h-6 w-6 text-slate-400" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-sm font-semibold">Color Theme</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primary" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Primary Color
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary"
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-10 w-16 cursor-pointer p-1 border-slate-200"
                    />
                    <Input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#0F172A"
                      className="font-mono text-sm border-slate-200 focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondary" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Secondary Color
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondary"
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="h-10 w-16 cursor-pointer p-1 border-slate-200"
                    />
                    <Input
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      placeholder="#3B82F6"
                      className="font-mono text-sm border-slate-200 focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accent" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Accent Color
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="accent"
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="h-10 w-16 cursor-pointer p-1 border-slate-200"
                    />
                    <Input
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      placeholder="#10B981"
                      className="font-mono text-sm border-slate-200 focus:border-primary transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            <ColorPreview />
          </CardContent>
        </Card>

        {/* Custom Domain Settings */}
        <Card className="border shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Custom Domain</CardTitle>
                <CardDescription>Configure a custom domain for your organization's dashboard</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
              <input
                type="checkbox"
                id="enableDomain"
                checked={enableCustomDomain}
                onChange={(e) => setEnableCustomDomain(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <Label htmlFor="enableDomain" className="text-sm font-medium cursor-pointer">
                Enable Custom Domain
              </Label>
            </div>

            {enableCustomDomain && (
              <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                <div className="flex gap-3 items-end">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="domain" className="text-sm font-semibold">
                      Domain Name
                    </Label>
                    <Input
                      id="domain"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      placeholder="your-organization.com"
                      className="border-slate-200 focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="pb-[2px]">{getDomainStatusBadge()}</div>
                </div>
                <p className="text-xs text-muted-foreground">Add a CNAME record pointing to your VMS dashboard URL</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!isDirty || updateSettings.isPending}
            className="w-full sm:w-auto border-slate-200 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset Changes
          </Button>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="flex-1 sm:flex-none border-slate-200 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveSettings}
              disabled={(!isDirty && !selectedFile) || updateSettings.isPending}
              className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-white shadow-sm hover:shadow transition-all"
            >
              {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </Button>
          </div>
        </div>

        {/* Unsaved Changes Alert */}
        {isDirty && (
          <div className="fixed bottom-6 right-6 z-50 p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-lg animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100">
                <AlertCircle className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">Unsaved Changes</p>
                <p className="text-xs text-amber-600">Don't forget to save your settings</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
