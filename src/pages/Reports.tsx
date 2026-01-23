import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useReportGeneration } from "@/hooks/useReportGeneration";
import { getReportsForRole, getReportsByCategory, reportCategories } from "@/lib/reportConfig";
import { ReportCategorySection } from "@/components/reports/ReportCategorySection";
import { TraineeDocumentGenerator } from "@/components/reports/TraineeDocumentGenerator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FileText, Building2, BarChart3, User } from "lucide-react";

// Roles that can generate individual trainee documents
const DOCUMENT_GENERATOR_ROLES = [
  "registration_officer",
  "head_of_trainee_support",
  "admin",
  "organization_admin",
  "super_admin",
];

const Reports = () => {
  const { navItems, groupLabel, role } = useRoleNavigation();
  const { organizationName, settings, loading: orgLoading } = useOrganizationContext();
  const { generateReport, isGenerating } = useReportGeneration();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [currentGeneratingId, setCurrentGeneratingId] = useState<string | null>(null);

  const canGenerateTraineeDocs = role && DOCUMENT_GENERATOR_ROLES.includes(role);

  // Get role-based reports
  const availableReports = useMemo(() => {
    return getReportsForRole(role);
  }, [role]);

  // Filter by search
  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return availableReports;
    
    const query = searchQuery.toLowerCase();
    return availableReports.filter(
      report =>
        report.title.toLowerCase().includes(query) ||
        report.description.toLowerCase().includes(query)
    );
  }, [availableReports, searchQuery]);

  // Group by category
  const reportsByCategory = useMemo(() => {
    return getReportsByCategory(filteredReports);
  }, [filteredReports]);

  const handleGenerate = async (reportId: string, format: "csv" | "excel") => {
    setCurrentGeneratingId(reportId);
    await generateReport({ reportId, format });
    setCurrentGeneratingId(null);
  };

  if (orgLoading) {
    return (
      <DashboardLayout
        title="Reports"
        subtitle="Generate comprehensive reports"
        navItems={navItems}
        groupLabel={groupLabel}
      >
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Reports"
      subtitle="Generate and download organizational reports"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6">
        {/* Organization Branding Header */}
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                {settings?.logo_url ? (
                  <img 
                    src={settings.logo_url} 
                    alt={organizationName || "Organization"} 
                    className="h-12 w-12 object-contain rounded-lg border border-border/50 bg-background p-1"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-xl">{organizationName || "Organization"}</CardTitle>
                  <p className="text-sm text-muted-foreground">Reports Center</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  {availableReports.length} Reports Available
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">
              All generated reports include organization branding and are formatted for professional use.
              Reports are filtered based on your role and access permissions.
            </p>
          </CardContent>
        </Card>

        {/* Tabs for different report types */}
        {canGenerateTraineeDocs ? (
          <Tabs defaultValue="documents" className="space-y-6">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="documents" className="gap-2">
                <User className="h-4 w-4" />
                Trainee Documents
              </TabsTrigger>
              <TabsTrigger value="aggregate" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Aggregate Reports
              </TabsTrigger>
            </TabsList>

            <TabsContent value="documents" className="space-y-6 mt-0">
              <TraineeDocumentGenerator />
            </TabsContent>

            <TabsContent value="aggregate" className="space-y-6 mt-0">
              {/* Search */}
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Reports by Category */}
              {filteredReports.length === 0 ? (
                <Card className="py-12">
                  <CardContent className="text-center">
                    <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-1">No Reports Found</h3>
                    <p className="text-sm text-muted-foreground">
                      {searchQuery 
                        ? "Try adjusting your search query"
                        : "No reports are available for your role"
                      }
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-8">
                  {reportCategories.map(category => (
                    <ReportCategorySection
                      key={category.id}
                      categoryId={category.id}
                      categoryLabel={category.label}
                      categoryDescription={category.description}
                      reports={reportsByCategory[category.id] || []}
                      onGenerate={handleGenerate}
                      isGenerating={isGenerating}
                      currentGeneratingId={currentGeneratingId}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <>
            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Reports by Category */}
            {filteredReports.length === 0 ? (
              <Card className="py-12">
                <CardContent className="text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-1">No Reports Found</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery 
                      ? "Try adjusting your search query"
                      : "No reports are available for your role"
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                {reportCategories.map(category => (
                  <ReportCategorySection
                    key={category.id}
                    categoryId={category.id}
                    categoryLabel={category.label}
                    categoryDescription={category.description}
                    reports={reportsByCategory[category.id] || []}
                    onGenerate={handleGenerate}
                    isGenerating={isGenerating}
                    currentGeneratingId={currentGeneratingId}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Reports;
