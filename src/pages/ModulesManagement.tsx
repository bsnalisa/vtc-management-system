import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/DashboardLayout";
import { organizationAdminNavItems } from "@/lib/navigationConfig";
import { useOrganizationModules } from "@/hooks/useModules";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ExternalLink, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const ModulesManagement = () => {
  const { organizationId } = useOrganizationContext();
  const { data: organizationModules, isLoading } = useOrganizationModules(organizationId);
  const navigate = useNavigate();

  const handleSupportTicket = () => {
    navigate("/support-tickets");
  };

  return (
    <DashboardLayout
      title="Modules Management"
      subtitle="View and manage your organization's active modules"
      navItems={organizationAdminNavItems}
      groupLabel="Navigation"
    >
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid gap-6">
            {organizationModules?.map((orgModule: any) => (
              <Card key={orgModule.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{orgModule.modules.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {orgModule.modules.description || "No description available"}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant={orgModule.enabled ? "default" : "secondary"}>
                      {orgModule.enabled ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Module Code</p>
                        <p className="font-medium">{orgModule.modules.code}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Category</p>
                        <p className="font-medium">{orgModule.modules.category}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-4 border-t">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleSupportTicket}
                      >
                        <HelpCircle className="h-4 w-4 mr-2" />
                        Get Support
                      </Button>
                      {orgModule.modules.description && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open('https://docs.lovable.dev', '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Documentation
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {(!organizationModules || organizationModules.length === 0) && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">No Active Modules</p>
                  <p className="text-muted-foreground text-center">
                    Your organization doesn't have any active modules yet.
                    <br />
                    Contact support to activate modules for your subscription.
                  </p>
                  <Button 
                    className="mt-4"
                    onClick={handleSupportTicket}
                  >
                    Contact Support
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ModulesManagement;
