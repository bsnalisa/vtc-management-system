import { useState } from "react";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePackages, useOrganizationPackage, useUpgradePackage } from "@/hooks/usePackages";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { formatPackagePrice, getDaysRemaining } from "@/lib/packageUtils";
import { Check, AlertTriangle, Zap, Crown, Star, Rocket, Package as PackageIcon } from "lucide-react";
import { withRoleAccess } from "@/components/withRoleAccess";

const PackageManagement = () => {
  const { organizationId, packageInfo } = useOrganizationContext();
  const { data: packages, isLoading: packagesLoading } = usePackages();
  const { data: currentPackage } = useOrganizationPackage(organizationId);
  const upgradePackage = useUpgradePackage();
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);

  const handleUpgrade = async (packageId: string) => {
    if (!organizationId) return;
    
    await upgradePackage.mutateAsync({
      organizationId,
      newPackageId: packageId,
    });
    
    setSelectedPackageId(null);
  };

  const daysRemaining = packageInfo?.end_date ? getDaysRemaining(packageInfo.end_date) : null;
  const isTrialExpiring = packageInfo?.is_trial && daysRemaining !== null && daysRemaining <= 3;

  const getPackageGradient = (pkgName: string) => {
    switch (pkgName.toLowerCase()) {
      case "professional":
        return "from-purple-500 to-pink-500";
      case "extended":
        return "from-blue-500 to-cyan-500";
      case "premium":
        return "from-green-500 to-emerald-500";
      default:
        return "from-gray-500 to-slate-500";
    }
  };

  const getPackageIcon = (pkgName: string) => {
    switch (pkgName.toLowerCase()) {
      case "professional":
        return <Crown className="h-6 w-6" />;
      case "extended":
        return <Rocket className="h-6 w-6" />;
      case "premium":
        return <Star className="h-6 w-6" />;
      default:
        return <PackageIcon className="h-6 w-6" />;
    }
  };

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Package Management</h1>
            <p className="text-muted-foreground mt-2">
              Manage subscriptions and access to platform features
            </p>
          </div>
          <Button variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">
            <PackageIcon className="h-4 w-4 mr-2" />
            Billing History
          </Button>
        </div>

        {/* Current Package Alert */}
        {packageInfo && (
          <Alert variant={isTrialExpiring ? "destructive" : "default"} className="border-l-4 border-l-blue-500">
            <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${getPackageGradient(packageInfo.package_name)} flex items-center justify-center`}>
                  {getPackageIcon(packageInfo.package_name)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-foreground">Current Package:</strong> 
                    <span className="font-semibold">{packageInfo.package_name}</span>
                    {packageInfo.is_trial && (
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                        Trial
                      </Badge>
                    )}
                  </div>
                  {daysRemaining !== null && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`h-2 w-24 bg-muted rounded-full overflow-hidden ${daysRemaining <= 7 ? 'bg-red-100' : 'bg-green-100'}`}>
                        <div 
                          className={`h-full rounded-full ${daysRemaining <= 7 ? 'bg-red-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.max((daysRemaining / 30) * 100, 5)}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {daysRemaining} days remaining
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {isTrialExpiring && (
                <div className="flex items-center gap-2 bg-red-50 px-3 py-2 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-700">Trial expiring soon!</span>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Current Usage Stats */}
        {packageInfo && (
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Zap className="h-5 w-5" />
                Current Usage & Limits
              </CardTitle>
              <CardDescription className="text-blue-700">
                Your current package capabilities and resource allocation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
                  <div className="text-2xl font-bold text-blue-600">
                    {packageInfo.limits.max_trainees ?? "∞"}
                  </div>
                  <div className="text-sm text-blue-800 font-medium">Max Trainees</div>
                  <div className="text-xs text-blue-600 mt-1">Active users</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
                  <div className="text-2xl font-bold text-blue-600">
                    {packageInfo.limits.max_trainers ?? "∞"}
                  </div>
                  <div className="text-sm text-blue-800 font-medium">Max Trainers</div>
                  <div className="text-xs text-blue-600 mt-1">Teaching staff</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
                  <div className="text-2xl font-bold text-blue-600">
                    {packageInfo.limits.max_classes ?? "∞"}
                  </div>
                  <div className="text-sm text-blue-800 font-medium">Max Classes</div>
                  <div className="text-xs text-blue-600 mt-1">Concurrent courses</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg border border-blue-100 shadow-sm">
                  <div className="text-2xl font-bold text-blue-600">
                    {packageInfo.limits.max_storage_mb ? `${packageInfo.limits.max_storage_mb}MB` : "∞"}
                  </div>
                  <div className="text-sm text-blue-800 font-medium">Storage</div>
                  <div className="text-xs text-blue-600 mt-1">Document storage</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Available Packages */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground">Available Packages</h2>
            <Badge variant="outline" className="text-muted-foreground">
              {packages?.length || 0} plans available
            </Badge>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-6">
            {packagesLoading ? (
              <div className="col-span-3 text-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading packages...</p>
              </div>
            ) : (
              packages?.map((pkg) => {
                const isCurrent = currentPackage?.package_id === pkg.id;
                const isSelected = selectedPackageId === pkg.id;
                const isPopular = pkg.name.toLowerCase() === "professional";
                
                return (
                  <Card 
                    key={pkg.id} 
                    className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg ${
                      isCurrent ? 'border-2 border-blue-500' : 'border'
                    } ${isSelected ? 'ring-2 ring-blue-500' : ''} ${
                      isPopular ? 'border-purple-300 scale-105' : ''
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 px-4 py-1">
                          Most Popular
                        </Badge>
                      </div>
                    )}
                    
                    {isCurrent && (
                      <div className="absolute top-4 right-4">
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          Current Plan
                        </Badge>
                      </div>
                    )}
                    
                    <CardHeader className={`pb-4 ${isPopular ? 'bg-gradient-to-r from-purple-50 to-pink-50' : 'bg-muted/30'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${getPackageGradient(pkg.name)} flex items-center justify-center text-white`}>
                            {getPackageIcon(pkg.name)}
                          </div>
                          {pkg.name}
                        </CardTitle>
                        {isPopular && <Zap className="h-5 w-5 text-yellow-500" />}
                      </div>
                      <CardDescription className="text-sm">{pkg.description}</CardDescription>
                      <div className="mt-4">
                        <div className="text-3xl font-bold text-foreground">
                          {formatPackagePrice(pkg.price, "USD", pkg.billing_cycle)}
                        </div>
                        {pkg.billing_cycle && (
                          <div className="text-sm text-muted-foreground">
                            per {pkg.billing_cycle}
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4 pt-4">
                      <div className="space-y-3">
                        {pkg.features.map((feature, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-foreground leading-relaxed">{feature}</span>
                          </div>
                        ))}
                      </div>
                      
                      {!isCurrent && (
                        <Button 
                          className={`w-full mt-4 ${
                            isPopular 
                              ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700' 
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                          variant={isSelected ? "default" : "default"}
                          onClick={() => {
                            setSelectedPackageId(pkg.id);
                            handleUpgrade(pkg.id);
                          }}
                          disabled={upgradePackage.isPending}
                        >
                          {upgradePackage.isPending && isSelected ? (
                            <>
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                              Upgrading...
                            </>
                          ) : (
                            `Select ${pkg.name}`
                          )}
                        </Button>
                      )}
                      
                      {isCurrent && (
                        <Button variant="outline" className="w-full" disabled>
                          Current Plan
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Enabled Modules */}
        {packageInfo && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackageIcon className="h-5 w-5" />
                Enabled Modules
              </CardTitle>
              <CardDescription>
                Features and modules available in your current package
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {packageInfo.module_access.map((moduleCode) => (
                  <Badge 
                    key={moduleCode} 
                    variant="secondary"
                    className="bg-green-50 text-green-700 border-green-200 px-3 py-1.5 text-sm"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    {moduleCode.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SuperAdminLayout>
  );
};

export default withRoleAccess(PackageManagement, {
  requiredRoles: ["admin", "organization_admin"],
  redirectTo: "/dashboard",
});