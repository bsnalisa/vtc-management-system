import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Filter, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { registrationOfficerNavItems } from "@/lib/navigationConfig";
import { ApplicationCaptureDialog } from "@/components/registration/ApplicationCaptureDialog";
import { ApplicationsTable } from "@/components/registration/ApplicationsTable";
import { ScreeningDialog } from "@/components/registration/ScreeningDialog";
import { RegistrationDialog } from "@/components/registration/RegistrationDialog";
import { ResumeDraftBanner } from "@/components/application/ResumeDraftBanner";
import { useTraineeApplications } from "@/hooks/useTraineeApplications";
import { useTrades } from "@/hooks/useTrades";
import { useApplicationDraft, useDeleteApplicationDraft } from "@/hooks/useApplicationDraft";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ComprehensiveApplicationData } from "@/types/application";
const ApplicationManagement = () => {
  const currentYear = new Date().getFullYear().toString();
  const [captureDialogOpen, setCaptureDialogOpen] = useState(false);
  const [screeningDialogOpen, setScreeningDialogOpen] = useState(false);
  const [registrationDialogOpen, setRegistrationDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  
  // Draft state
  const [resumeData, setResumeData] = useState<{
    data: ComprehensiveApplicationData;
    tab: string;
    draftId: string;
  } | null>(null);

  // Fetch draft
  const { data: draft, refetch: refetchDraft } = useApplicationDraft();
  const deleteDraft = useDeleteApplicationDraft();

  const handleResumeDraft = () => {
    if (draft) {
      setResumeData({
        data: draft.form_data,
        tab: draft.current_tab,
        draftId: draft.id,
      });
      setCaptureDialogOpen(true);
    }
  };

  const handleDiscardDraft = async () => {
    if (draft) {
      await deleteDraft.mutateAsync(draft.id);
    }
  };

  const handleDraftDeleted = () => {
    setResumeData(null);
    refetchDraft();
  };
  const [filters, setFilters] = useState({
    intake: "all",
    trade_id: "all",
    qualification_status: "all",
    registration_status: "all",
    academic_year: currentYear,
  });

  const [searchQuery, setSearchQuery] = useState("");

  // Clean filters before passing to API - convert "all" to undefined
  const cleanFilters = {
    academic_year: filters.academic_year,
    intake: filters.intake !== "all" ? filters.intake : undefined,
    trade_id: filters.trade_id !== "all" ? filters.trade_id : undefined,
    qualification_status: filters.qualification_status !== "all" ? filters.qualification_status : undefined,
    registration_status: filters.registration_status !== "all" ? filters.registration_status : undefined,
  };

  const { data: applications, isLoading, error } = useTraineeApplications(cleanFilters);

  const { data: trades, isLoading: tradesLoading } = useTrades();

  const filteredApplications = applications?.filter((app) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      app.application_number?.toLowerCase().includes(search) ||
      app.trainee_number?.toLowerCase().includes(search) ||
      app.first_name?.toLowerCase().includes(search) ||
      app.last_name?.toLowerCase().includes(search) ||
      app.national_id?.toLowerCase().includes(search)
    );
  });

  const handleScreen = (application: any) => {
    setSelectedApplication(application);
    setScreeningDialogOpen(true);
  };

  const handleRegister = (application: any) => {
    setSelectedApplication(application);
    setRegistrationDialogOpen(true);
  };

  const handleViewDetails = (application: any) => {
    setSelectedApplication(application);
    // TODO: Open details dialog
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      intake: "all",
      trade_id: "all",
      qualification_status: "all",
      registration_status: "all",
      academic_year: currentYear,
    });
    setSearchQuery("");
  };

  const hasActiveFilters =
    filters.intake !== "all" ||
    filters.trade_id !== "all" ||
    filters.qualification_status !== "all" ||
    filters.registration_status !== "all" ||
    searchQuery !== "";

  return (
    <DashboardLayout
      title="Application Management"
      subtitle="Manage trainee applications and registrations"
      navItems={registrationOfficerNavItems}
      groupLabel="Registration"
    >
      <div className="space-y-6">
        {/* Resume Draft Banner */}
        {draft && !captureDialogOpen && (
          <ResumeDraftBanner
            draft={draft}
            onResume={handleResumeDraft}
            onDiscard={handleDiscardDraft}
            isDiscarding={deleteDraft.isPending}
          />
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Failed to load applications: {error.message}</AlertDescription>
          </Alert>
        )}

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          <div className="flex gap-2 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, application number, trainee number, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={clearFilters} disabled={isLoading || !hasActiveFilters} className="flex-1 sm:flex-none">
              Clear Filters
            </Button>
            <Button onClick={() => setCaptureDialogOpen(true)} disabled={isLoading} className="flex-1 sm:flex-none">
              <Plus className="h-4 w-4 mr-2" />
              New Application
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
            <CardDescription>Filter applications by various criteria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Academic Year</label>
                <Select
                  value={filters.academic_year}
                  onValueChange={(value) => handleFilterChange("academic_year", value)}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Academic Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={currentYear}>{currentYear}</SelectItem>
                    <SelectItem value={(parseInt(currentYear) - 1).toString()}>{parseInt(currentYear) - 1}</SelectItem>
                    <SelectItem value={(parseInt(currentYear) - 2).toString()}>{parseInt(currentYear) - 2}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Intake</label>
                <Select
                  value={filters.intake}
                  onValueChange={(value) => handleFilterChange("intake", value)}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Intakes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Intakes</SelectItem>
                    <SelectItem value="january">January</SelectItem>
                    <SelectItem value="july">July</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Trade</label>
                <Select
                  value={filters.trade_id}
                  onValueChange={(value) => handleFilterChange("trade_id", value)}
                  disabled={isLoading || tradesLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Trades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Trades</SelectItem>
                    {trades?.map((trade) => (
                      <SelectItem key={trade.id} value={trade.id}>
                        {trade.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Qualification</label>
                <Select
                  value={filters.qualification_status}
                  onValueChange={(value) => handleFilterChange("qualification_status", value)}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Qualifications" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Qualifications</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="provisionally_qualified">Provisionally Qualified</SelectItem>
                    <SelectItem value="does_not_qualify">Does Not Qualify</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Registration</label>
                <Select
                  value={filters.registration_status}
                  onValueChange={(value) => handleFilterChange("registration_status", value)}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="applied">Applied</SelectItem>
                    <SelectItem value="provisionally_admitted">Provisionally Admitted</SelectItem>
                    <SelectItem value="pending_payment">Pending Payment</SelectItem>
                    <SelectItem value="fully_registered">Fully Registered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Applications Table */}
        <Card>
          <CardHeader>
            <CardTitle>Applications</CardTitle>
            <CardDescription>
              {isLoading ? "Loading..." : `${filteredApplications?.length || 0} application(s) found`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading applications...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="text-destructive font-medium">Failed to load applications</p>
                <p className="text-muted-foreground text-sm mt-2">
                  Please try refreshing the page or contact support if the problem persists.
                </p>
              </div>
            ) : !filteredApplications || filteredApplications.length === 0 ? (
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">No applications found</p>
                <p className="text-muted-foreground text-sm mt-2">
                  {hasActiveFilters ? "Try adjusting your search or filters" : "Start by creating a new application"}
                </p>
                {!hasActiveFilters && (
                  <Button onClick={() => setCaptureDialogOpen(true)} className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Application
                  </Button>
                )}
              </div>
            ) : (
              <ApplicationsTable
                applications={filteredApplications}
                onScreen={handleScreen}
                onRegister={handleRegister}
                onViewDetails={handleViewDetails}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ApplicationCaptureDialog 
        open={captureDialogOpen} 
        onOpenChange={(open) => {
          setCaptureDialogOpen(open);
          if (!open) setResumeData(null);
        }}
        initialData={resumeData?.data}
        initialTab={resumeData?.tab}
        draftId={resumeData?.draftId}
        onDraftDeleted={handleDraftDeleted}
      />

      <ScreeningDialog
        open={screeningDialogOpen}
        onOpenChange={setScreeningDialogOpen}
        application={selectedApplication}
      />

      <RegistrationDialog
        open={registrationDialogOpen}
        onOpenChange={setRegistrationDialogOpen}
        application={selectedApplication}
      />
    </DashboardLayout>
  );
};

export default ApplicationManagement;
