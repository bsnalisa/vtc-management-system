import { useState } from "react";
import { SuperAdminLayout } from "@/components/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useOrganizations } from "@/hooks/useOrganizations";
import { usePackages, useAssignPackage } from "@/hooks/usePackages";
import { withRoleAccess } from "@/components/withRoleAccess";
import { 
  Package, 
  Building2, 
  Calendar,
  CheckCircle2,
  AlertCircle,
  Users,
  Zap,
  Crown,
  Rocket
} from "lucide-react";

const SuperAdminPackageAssignment = () => {
  const { data: organizations } = useOrganizations();
  const { data: packages } = usePackages();
  const assignPackage = useAssignPackage();
  
  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedPackage, setSelectedPackage] = useState("");
  const [isTrial, setIsTrial] = useState(false);
  const [trialDays, setTrialDays] = useState("14");

  const handleAssign = async () => {
    if (!selectedOrg || !selectedPackage) return;
    
    await assignPackage.mutateAsync({
      organizationId: selectedOrg,
      packageId: selectedPackage,
      isTrial,
      trialDays: isTrial ? parseInt(trialDays) : undefined,
    });
    
    setSelectedOrg("");
    setSelectedPackage("");
    setIsTrial(false);
    setTrialDays("14");
  };

  const getPackageIcon = (pkgName: string) => {
    switch (pkgName.toLowerCase()) {
      case "professional":
        return <Crown className="h-4 w-4" />;
      case "extended":
        return <Rocket className="h-4 w-4" />;
      case "premium":
        return <Zap className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getPackageColor = (pkgName: string) => {
    switch (pkgName.toLowerCase()) {
      case "professional":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "extended":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "premium":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const selectedOrgData = organizations?.find(org => org.id === selectedOrg);
  const selectedPackageData = packages?.find(pkg => pkg.id === selectedPackage);

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Package Assignment</h1>
            <p className="text-muted-foreground mt-2">
              Manage package assignments and subscriptions across organizations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              {organizations?.length || 0} Organizations
            </Badge>
            <Badge variant="outline" className="text-sm">
              {packages?.length || 0} Packages
            </Badge>
          </div>
        </div>

        {/* Assignment Form */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Form Card */}
          <Card className="lg:col-span-2">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Package className="h-5 w-5" />
                Assign Package to Organization
              </CardTitle>
              <CardDescription className="text-blue-700">
                Select an organization and package to assign subscription access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Organization Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Select Organization
                </Label>
                <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                  <SelectTrigger className="focus:ring-2 focus:ring-blue-500">
                    <SelectValue placeholder="Choose an organization..." />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations?.map((org) => (
                      <SelectItem key={org.id} value={org.id} className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{org.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Current: <Badge variant="outline" className="text-xs">{org.package}</Badge>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Package Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Select Package
                </Label>
                <Select value={selectedPackage} onValueChange={setSelectedPackage}>
                  <SelectTrigger className="focus:ring-2 focus:ring-blue-500">
                    <SelectValue placeholder="Choose a package..." />
                  </SelectTrigger>
                  <SelectContent>
                    {packages?.map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id} className="flex items-center gap-2 py-2">
                        {getPackageIcon(pkg.name)}
                        <div className="flex-1">
                          <div className="font-medium">{pkg.name}</div>
                          <div className="text-xs text-muted-foreground">
                            ${pkg.price}/{pkg.billing_cycle} • {pkg.features.length} features
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Trial Options */}
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isTrial"
                    checked={isTrial}
                    onChange={(e) => setIsTrial(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <Label htmlFor="isTrial" className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Assign as Trial Period
                  </Label>
                </div>

                {isTrial && (
                  <div className="space-y-2 pl-7">
                    <Label htmlFor="trialDays" className="text-sm">Trial Duration (days)</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="trialDays"
                        type="number"
                        value={trialDays}
                        onChange={(e) => setTrialDays(e.target.value)}
                        min="1"
                        max="90"
                        className="focus:ring-2 focus:ring-blue-500 w-24"
                      />
                      <div className="flex gap-1">
                        {[7, 14, 30].map((days) => (
                          <Button
                            key={days}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setTrialDays(days.toString())}
                            className="text-xs h-8"
                          >
                            {days}d
                          </Button>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Trial periods can be set from 1 to 90 days
                    </p>
                  </div>
                )}
              </div>

              {/* Assignment Button */}
              <Button 
                onClick={handleAssign}
                disabled={!selectedOrg || !selectedPackage || assignPackage.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg font-semibold"
                size="lg"
              >
                {assignPackage.isPending ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                    Assigning Package...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Assign Package
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Preview Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Assignment Preview
              </CardTitle>
              <CardDescription>
                Review your package assignment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedOrgData && selectedPackageData ? (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <Building2 className="h-8 w-8 text-blue-600" />
                      <div>
                        <div className="font-semibold text-sm">{selectedOrgData.name}</div>
                        <div className="text-xs text-muted-foreground">Organization</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className={`h-8 w-8 rounded-lg ${getPackageColor(selectedPackageData.name)} flex items-center justify-center`}>
                        {getPackageIcon(selectedPackageData.name)}
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{selectedPackageData.name}</div>
                        <div className="text-xs text-muted-foreground">
                          ${selectedPackageData.price}/{selectedPackageData.billing_cycle}
                        </div>
                      </div>
                    </div>

                    {isTrial && (
                      <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <Calendar className="h-6 w-6 text-orange-600" />
                        <div>
                          <div className="font-semibold text-sm text-orange-800">
                            {trialDays}-day Trial
                          </div>
                          <div className="text-xs text-orange-600">
                            Trial period assignment
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-medium text-sm mb-2">Package Includes:</h4>
                    <div className="space-y-1">
                      {selectedPackageData.features.slice(0, 3).map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </div>
                      ))}
                      {selectedPackageData.features.length > 3 && (
                        <div className="text-xs text-muted-foreground pl-5">
                          +{selectedPackageData.features.length - 3} more features
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Select an organization and package to preview assignment</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Current Assignments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Current Package Assignments
            </CardTitle>
            <CardDescription>
              Overview of all organizations and their assigned packages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {organizations?.map((org) => (
                <div key={org.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{org.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge 
                          variant="outline" 
                          className={getPackageColor(org.package)}
                        >
                          {getPackageIcon(org.package)}
                          {org.package}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ID: {org.id.slice(0, 8)}...
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge variant={org.active ? "default" : "secondary"}>
                    {org.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
};

export default withRoleAccess(SuperAdminPackageAssignment, {
  requiredRoles: ["super_admin"],
  redirectTo: "/dashboard",
});