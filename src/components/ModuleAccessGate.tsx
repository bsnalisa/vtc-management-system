import { ReactNode } from "react";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Lock, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ModuleAccessGateProps {
  moduleCode: string;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
}

/**
 * Component that conditionally renders content based on module access
 * Shows upgrade prompt if access is denied
 */
export const ModuleAccessGate = ({
  moduleCode,
  children,
  fallback,
  showUpgradePrompt = true,
}: ModuleAccessGateProps) => {
  const { hasModuleAccess, packageInfo } = useOrganizationContext();
  const navigate = useNavigate();

  if (hasModuleAccess(moduleCode)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showUpgradePrompt) {
    return (
      <Alert className="border-primary/50 bg-primary/5">
        <Lock className="h-4 w-4" />
        <AlertTitle className="flex items-center gap-2">
          Premium Feature
          <Zap className="h-4 w-4 text-yellow-500" />
        </AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            This feature is not available in your current package ({packageInfo?.package_name || "Basic"}).
          </p>
          <Button
            variant="default"
            size="sm"
            onClick={() => navigate("/packages")}
          >
            Upgrade Package
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};

/**
 * Higher-order component version of ModuleAccessGate
 */
export const withModuleAccess = (
  Component: React.ComponentType<any>,
  moduleCode: string
) => {
  return (props: any) => (
    <ModuleAccessGate moduleCode={moduleCode}>
      <Component {...props} />
    </ModuleAccessGate>
  );
};
