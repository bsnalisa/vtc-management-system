import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { useSystemAuditLogs } from "@/hooks/useSystemAuditLogs";
import {
  Settings,
  Save,
  RefreshCw,
  Shield,
  Mail,
  DollarSign,
  BookOpen,
  Users,
  FileText,
  Database,
  Bell,
  Package,
  BarChart3,
  Plug,
  Scale,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Mock configuration data - System-wide configurations for Super Admin only
const mockSystemConfigs = [
  // Package & Subscription Management
  {
    id: 1,
    config_key: "TRIAL_PERIOD_DAYS",
    config_value: "30",
    description: "Default trial period for new organizations (days)",
    category: "packages",
    value_type: "number",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 2,
    config_key: "SUBSCRIPTION_EXPIRY_NOTIFICATION_DAYS",
    config_value: "7",
    description: "Days before subscription expiry to send notification to organizations",
    category: "packages",
    value_type: "number",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 3,
    config_key: "AUTO_SUSPEND_EXPIRED_SUBSCRIPTIONS",
    config_value: "true",
    description: "Automatically suspend organizations with expired subscriptions",
    category: "packages",
    value_type: "boolean",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 4,
    config_key: "GRACE_PERIOD_AFTER_EXPIRY_DAYS",
    config_value: "3",
    description: "Grace period after subscription expiry before suspension (days)",
    category: "packages",
    value_type: "number",
    updated_at: "2024-01-15T10:30:00Z",
  },

  // System Settings
  {
    id: 5,
    config_key: "BACKUP_FREQUENCY_DAYS",
    config_value: "7",
    description: "Automatic system-wide backup frequency (days)",
    category: "system",
    value_type: "number",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 6,
    config_key: "DATA_RETENTION_YEARS",
    config_value: "7",
    description: "How long to retain historical data across all organizations (years)",
    category: "system",
    value_type: "number",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 7,
    config_key: "MAINTENANCE_MODE",
    config_value: "false",
    description: "Enable platform-wide maintenance mode (blocks all user access)",
    category: "system",
    value_type: "boolean",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 8,
    config_key: "MAX_FILE_UPLOAD_SIZE_MB",
    config_value: "10",
    description: "Maximum file upload size across platform (MB)",
    category: "system",
    value_type: "number",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 9,
    config_key: "API_RATE_LIMIT_PER_MINUTE",
    config_value: "100",
    description: "Maximum API requests per minute per user (platform-wide)",
    category: "system",
    value_type: "number",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 10,
    config_key: "ENABLE_ORGANIZATION_SUBDOMAIN",
    config_value: "true",
    description: "Allow organizations to use custom subdomains",
    category: "system",
    value_type: "boolean",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 11,
    config_key: "AUTO_CLEANUP_INACTIVE_ORGS_MONTHS",
    config_value: "12",
    description: "Auto-cleanup organizations inactive for specified months (0 = disabled)",
    category: "system",
    value_type: "number",
    updated_at: "2024-01-15T10:30:00Z",
  },

  // Security & Access (Platform-wide baseline)
  {
    id: 12,
    config_key: "REQUIRE_EMAIL_VERIFICATION",
    config_value: "true",
    description: "Require email verification for all new user accounts platform-wide",
    category: "security",
    value_type: "boolean",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 13,
    config_key: "SESSION_TIMEOUT_MINUTES",
    config_value: "60",
    description: "Default user session timeout across platform (minutes)",
    category: "security",
    value_type: "number",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 14,
    config_key: "AUTO_LOGOUT_ENABLED",
    config_value: "true",
    description: "Automatically log out inactive users platform-wide",
    category: "security",
    value_type: "boolean",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 15,
    config_key: "PASSWORD_MIN_LENGTH",
    config_value: "8",
    description: "Minimum password length requirement (platform-wide)",
    category: "security",
    value_type: "number",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 16,
    config_key: "REQUIRE_PASSWORD_COMPLEXITY",
    config_value: "true",
    description: "Require uppercase, lowercase, numbers, and special characters",
    category: "security",
    value_type: "boolean",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 17,
    config_key: "MAX_LOGIN_ATTEMPTS",
    config_value: "5",
    description: "Maximum failed login attempts before account lockout",
    category: "security",
    value_type: "number",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 18,
    config_key: "LOCKOUT_DURATION_MINUTES",
    config_value: "30",
    description: "Account lockout duration after max failed attempts (minutes)",
    category: "security",
    value_type: "number",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 19,
    config_key: "ENABLE_TWO_FACTOR_AUTH",
    config_value: "false",
    description: "Enable two-factor authentication option for users",
    category: "security",
    value_type: "boolean",
    updated_at: "2024-01-15T10:30:00Z",
  },

  // Email & Notifications (Platform Infrastructure)
  {
    id: 20,
    config_key: "SMTP_SERVER",
    config_value: "smtp.gmail.com",
    description: "SMTP server for platform email notifications",
    category: "email",
    value_type: "text",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 21,
    config_key: "SMTP_PORT",
    config_value: "587",
    description: "SMTP server port",
    category: "email",
    value_type: "number",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 22,
    config_key: "EMAIL_FROM_ADDRESS",
    config_value: "noreply@tvetmis.com",
    description: "Default sender email address for platform emails",
    category: "email",
    value_type: "text",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 23,
    config_key: "EMAIL_FROM_NAME",
    config_value: "TVET MIS Platform",
    description: "Default sender name for platform emails",
    category: "email",
    value_type: "text",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 24,
    config_key: "ENABLE_EMAIL_NOTIFICATIONS",
    config_value: "true",
    description: "Enable platform-wide email notifications",
    category: "email",
    value_type: "boolean",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 25,
    config_key: "EMAIL_RETRY_ATTEMPTS",
    config_value: "3",
    description: "Number of retry attempts for failed email sends",
    category: "email",
    value_type: "number",
    updated_at: "2024-01-15T10:30:00Z",
  },

  // Billing & Payments (Platform-wide defaults)
  {
    id: 26,
    config_key: "PLATFORM_CURRENCY",
    config_value: "NAD",
    description: "Platform default currency for billing",
    category: "billing",
    value_type: "select",
    options: ["NAD", "USD", "ZAR", "EUR", "GBP"],
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 27,
    config_key: "TAX_RATE",
    config_value: "15",
    description: "Platform VAT/Tax rate for subscription billing (percentage)",
    category: "billing",
    value_type: "number",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 28,
    config_key: "PAYMENT_GATEWAY",
    config_value: "stripe",
    description: "Default payment gateway for subscription payments",
    category: "billing",
    value_type: "select",
    options: ["stripe", "paypal", "manual"],
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 29,
    config_key: "AUTO_GENERATE_INVOICES",
    config_value: "true",
    description: "Automatically generate invoices for subscription fees",
    category: "billing",
    value_type: "boolean",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 30,
    config_key: "INVOICE_DUE_DAYS",
    config_value: "14",
    description: "Default invoice due period (days)",
    category: "billing",
    value_type: "number",
    updated_at: "2024-01-15T10:30:00Z",
  },

  // User Management (Platform-wide policies)
  {
    id: 31,
    config_key: "ALLOW_SELF_REGISTRATION",
    config_value: "false",
    description: "Allow users to self-register (without organization invitation)",
    category: "user_management",
    value_type: "boolean",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 32,
    config_key: "REQUIRE_ADMIN_APPROVAL_NEW_ORGS",
    config_value: "true",
    description: "Require super admin approval for new organization registrations",
    category: "user_management",
    value_type: "boolean",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 33,
    config_key: "USER_INACTIVITY_PERIOD_DAYS",
    config_value: "90",
    description: "Days of inactivity before account flagging (platform-wide)",
    category: "user_management",
    value_type: "number",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 34,
    config_key: "ALLOW_MULTI_ORGANIZATION_ACCESS",
    config_value: "false",
    description: "Allow users to belong to multiple organizations",
    category: "user_management",
    value_type: "boolean",
    updated_at: "2024-01-15T10:30:00Z",
  },

  // Reporting & Analytics (Platform-wide)
  {
    id: 35,
    config_key: "AUTO_GENERATE_PLATFORM_REPORTS",
    config_value: "true",
    description: "Automatically generate monthly platform analytics reports",
    category: "reporting",
    value_type: "boolean",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 36,
    config_key: "REPORT_RETENTION_MONTHS",
    config_value: "24",
    description: "How long to retain generated platform reports (months)",
    category: "reporting",
    value_type: "number",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 37,
    config_key: "ENABLE_USAGE_ANALYTICS",
    config_value: "true",
    description: "Track platform usage analytics across organizations",
    category: "reporting",
    value_type: "boolean",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 38,
    config_key: "ANONYMIZE_ANALYTICS_DATA",
    config_value: "true",
    description: "Anonymize user data in platform analytics",
    category: "reporting",
    value_type: "boolean",
    updated_at: "2024-01-15T10:30:00Z",
  },

  // Integration Settings
  {
    id: 39,
    config_key: "ENABLE_API_ACCESS",
    config_value: "true",
    description: "Enable external API access for organizations",
    category: "integrations",
    value_type: "boolean",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 40,
    config_key: "API_VERSION",
    config_value: "v1",
    description: "Current API version",
    category: "integrations",
    value_type: "select",
    options: ["v1", "v2"],
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 41,
    config_key: "ENABLE_WEBHOOK_NOTIFICATIONS",
    config_value: "true",
    description: "Allow organizations to configure webhook notifications",
    category: "integrations",
    value_type: "boolean",
    updated_at: "2024-01-15T10:30:00Z",
  },

  // Compliance & Legal
  {
    id: 42,
    config_key: "GDPR_COMPLIANCE_MODE",
    config_value: "true",
    description: "Enable GDPR compliance features",
    category: "compliance",
    value_type: "boolean",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 43,
    config_key: "DATA_EXPORT_ENABLED",
    config_value: "true",
    description: "Allow users to export their data",
    category: "compliance",
    value_type: "boolean",
    updated_at: "2024-01-15T10:30:00Z",
  },
  {
    id: 44,
    config_key: "AUDIT_LOG_RETENTION_DAYS",
    config_value: "365",
    description: "Platform audit log retention period (days)",
    category: "compliance",
    value_type: "number",
    updated_at: "2024-01-15T10:30:00Z",
  },
];

const SystemConfig = () => {
  const { data: auditLogs, isLoading } = useSystemAuditLogs();
  const { toast } = useToast();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>("");
  const [configs, setConfigs] = useState(mockSystemConfigs);

  // Mock update function - replace with actual API call
  const handleSave = async (configKey: string) => {
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setConfigs((prev) =>
        prev.map((config) =>
          config.config_key === configKey
            ? { ...config, config_value: editValue, updated_at: new Date().toISOString() }
            : config,
        ),
      );

      setEditingKey(null);
      toast({
        title: "Configuration updated",
        description: `${configKey} has been successfully updated.`,
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Failed to update configuration.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (config: any) => {
    setEditingKey(config.config_key);
    setEditValue(config.config_value);
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValue("");
  };

  const getConfigIcon = (category: string) => {
    switch (category) {
      case "security":
        return <Shield className="h-5 w-5" />;
      case "email":
        return <Mail className="h-5 w-5" />;
      case "billing":
        return <DollarSign className="h-5 w-5" />;
      case "user_management":
        return <Users className="h-5 w-5" />;
      case "system":
        return <Database className="h-5 w-5" />;
      case "packages":
        return <Package className="h-5 w-5" />;
      case "reporting":
        return <BarChart3 className="h-5 w-5" />;
      case "integrations":
        return <Plug className="h-5 w-5" />;
      case "compliance":
        return <Scale className="h-5 w-5" />;
      default:
        return <Settings className="h-5 w-5" />;
    }
  };

  const getConfigColor = (category: string) => {
    switch (category) {
      case "security":
        return "bg-red-100 text-red-800 border-red-200";
      case "email":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "billing":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "user_management":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "system":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "packages":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "reporting":
        return "bg-teal-100 text-teal-800 border-teal-200";
      case "integrations":
        return "bg-cyan-100 text-cyan-800 border-cyan-200";
      case "compliance":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const renderConfigValue = (config: any) => {
    if (editingKey === config.config_key) {
      switch (config.value_type) {
        case "boolean":
          return (
            <div className="flex items-center gap-3">
              <Switch checked={editValue === "true"} onCheckedChange={(checked) => setEditValue(checked.toString())} />
              <span className="text-sm">{editValue === "true" ? "Enabled" : "Disabled"}</span>
            </div>
          );
        case "number":
          return (
            <Input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="max-w-xs"
            />
          );
        case "select":
          return (
            <Select value={editValue} onValueChange={setEditValue}>
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {config.options?.map((option: string) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        case "text":
          return <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={3} />;
        default:
          return <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="max-w-xs" />;
      }
    }

    // Display mode
    if (config.value_type === "boolean") {
      const isEnabled = config.config_value === "true";
      return <Badge variant={isEnabled ? "default" : "secondary"}>{isEnabled ? "Enabled" : "Disabled"}</Badge>;
    }

    return <div className="text-sm bg-muted px-3 py-2 rounded-md">{String(config.config_value || "Not set")}</div>;
  };

  const renderActionButtons = (config: any) => {
    if (editingKey === config.config_key) {
      return (
        <div className="flex gap-2 mt-3">
          <Button size="sm" onClick={() => handleSave(config.config_key)}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      );
    }

    return (
      <Button variant="outline" size="sm" onClick={() => handleEdit(config)}>
        Edit
      </Button>
    );
  };

  // Group configs by category
  const groupedConfigs = configs?.reduce((acc: any, config: any) => {
    const category = config.category || "general";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(config);
    return acc;
  }, {});

  const categoryNames: { [key: string]: string } = {
    security: "Security & Access Control",
    email: "Email Infrastructure",
    billing: "Billing & Payments",
    user_management: "User Management Policies",
    system: "System Configuration",
    packages: "Package & Subscription Management",
    reporting: "Reporting & Analytics",
    integrations: "API & Integrations",
    compliance: "Compliance & Legal",
    general: "General Settings",
  };

  if (isLoading) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Platform Configuration</h1>
              <p className="text-muted-foreground">Manage system-wide settings and policies across all organizations</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Info Alert */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-semibold text-blue-900">Platform-Wide Configurations</h3>
                <p className="text-sm text-blue-800">
                  These settings apply to the entire platform and affect all organizations. Organization-specific settings 
                  (such as academic year, class sizes, hostel policies, library rules, etc.) should be configured by each 
                  organization's admin in their Organization Settings page.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabbed Configuration Categories */}
        <Tabs defaultValue="packages" className="w-full">
          <TabsList className="w-full grid grid-cols-3 lg:grid-cols-9 h-auto gap-2 bg-muted p-2">
            <TabsTrigger value="packages" className="flex items-center gap-2 data-[state=active]:bg-background">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Packages</span>
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2 data-[state=active]:bg-background">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">System</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2 data-[state=active]:bg-background">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2 data-[state=active]:bg-background">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-2 data-[state=active]:bg-background">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Billing</span>
            </TabsTrigger>
            <TabsTrigger value="user_management" className="flex items-center gap-2 data-[state=active]:bg-background">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="reporting" className="flex items-center gap-2 data-[state=active]:bg-background">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Reports</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center gap-2 data-[state=active]:bg-background">
              <Plug className="h-4 w-4" />
              <span className="hidden sm:inline">API</span>
            </TabsTrigger>
            <TabsTrigger value="compliance" className="flex items-center gap-2 data-[state=active]:bg-background">
              <Scale className="h-4 w-4" />
              <span className="hidden sm:inline">Legal</span>
            </TabsTrigger>
          </TabsList>

          {groupedConfigs && Object.entries(groupedConfigs).map(([category, configs]: [string, any]) => (
            <TabsContent key={category} value={category} className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getConfigIcon(category)}
                    {categoryNames[category] || category}
                  </CardTitle>
                  <CardDescription>
                    Configure {categoryNames[category]?.toLowerCase() || category} settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {configs.map((config: any) => (
                      <div
                        key={config.config_key}
                        className="p-4 border rounded-lg space-y-3 hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Label htmlFor={config.config_key} className="font-semibold text-base">
                                {config.config_key.replace(/_/g, " ")}
                              </Label>
                              <Badge variant="outline" className={getConfigColor(config.category)}>
                                {config.category}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{config.description}</p>
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          <div className="flex-1 w-full">
                            {renderConfigValue(config)}
                          </div>
                          <div className="flex gap-2">
                            {renderActionButtons(config)}
                          </div>
                        </div>
                        
                        <div className="text-xs text-muted-foreground">
                          Last updated: {config.updated_at ? new Date(config.updated_at).toLocaleString() : "Never"}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuration Actions
            </CardTitle>
            <CardDescription>System-wide configuration management</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                <Database className="h-6 w-6" />
                <span>Backup Configuration</span>
                <span className="text-xs text-muted-foreground">Export current settings</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                <RefreshCw className="h-6 w-6" />
                <span>Reset to Defaults</span>
                <span className="text-xs text-muted-foreground">Restore factory settings</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                <FileText className="h-6 w-6" />
                <span>Audit Logs</span>
                <span className="text-xs text-muted-foreground">View configuration changes</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
};

export default SystemConfig;
