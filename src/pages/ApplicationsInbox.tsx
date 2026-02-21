import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileText, Clock, UserPlus, Filter } from "lucide-react";
import { useTraineeApplications } from "@/hooks/useTraineeApplications";
import { ApplicationsTable } from "@/components/registration/ApplicationsTable";
import { ScreeningDialog } from "@/components/registration/ScreeningDialog";
import { ApplicationCaptureDialog } from "@/components/registration/ApplicationCaptureDialog";
import { useTrades } from "@/hooks/useTrades";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/table-skeleton";

const ApplicationsInbox = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrade, setSelectedTrade] = useState<string>("all");
  const [selectedIntake, setSelectedIntake] = useState<string>("all");

  const [screeningDialogOpen, setScreeningDialogOpen] = useState(false);
  const [captureDialogOpen, setCaptureDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);

  // Only fetch pending (unscreened) applications
  const { data: applications, isLoading } = useTraineeApplications({
    qualification_status: "pending",
  });
  const { data: trades } = useTrades();

  const filteredApplications = applications?.filter((app) => {
    const matchesSearch =
      app.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.application_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.national_id?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTrade = selectedTrade === "all" || app.trade_id === selectedTrade;
    const matchesIntake = selectedIntake === "all" || app.intake === selectedIntake;

    return matchesSearch && matchesTrade && matchesIntake;
  });

  const handleScreen = (application: any) => {
    setSelectedApplication(application);
    setScreeningDialogOpen(true);
  };

  const handleViewDetails = (application: any) => {
    setSelectedApplication(application);
    setScreeningDialogOpen(true);
  };

  return (
    <DashboardLayout
      title="Applications Inbox"
      subtitle="New applications awaiting screening"
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-4">
        {/* Stats */}
        <Card className="p-0">
          <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium">Pending Screening</CardTitle>
            <Clock className="h-3.5 w-3.5 text-warning" />
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-xl font-bold text-warning">{filteredApplications?.length || 0}</div>
            <p className="text-[10px] text-muted-foreground">Applications awaiting review</p>
          </CardContent>
        </Card>

        {/* Applications Table Card */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-base">Pending Applications</CardTitle>
                <CardDescription className="text-xs">
                  Screen new applications to determine qualification status
                </CardDescription>
              </div>
              <Button onClick={() => setCaptureDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-1" />
                New Application
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, application number, or national ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={selectedTrade} onValueChange={setSelectedTrade}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Trade" />
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
              <Select value={selectedIntake} onValueChange={setSelectedIntake}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Intake" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Intakes</SelectItem>
                  <SelectItem value="january">January</SelectItem>
                  <SelectItem value="july">July</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {isLoading ? (
              <TableSkeleton columns={9} rows={5} />
            ) : filteredApplications?.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No pending applications"
                description="All applications have been screened, or no new applications have been submitted."
              />
            ) : (
              <ApplicationsTable
                applications={filteredApplications || []}
                onScreen={handleScreen}
                onRegister={() => {}}
                onViewDetails={handleViewDetails}
              />
            )}
          </CardContent>
        </Card>

        {/* Dialogs */}
        {selectedApplication && (
          <ScreeningDialog
            open={screeningDialogOpen}
            onOpenChange={setScreeningDialogOpen}
            application={selectedApplication}
          />
        )}

        <ApplicationCaptureDialog
          open={captureDialogOpen}
          onOpenChange={setCaptureDialogOpen}
        />
      </div>
    </DashboardLayout>
  );
};

export default ApplicationsInbox;
