import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { registrationOfficerNavItems } from "@/lib/navigationConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, CheckCircle, XCircle, Clock, UserPlus, Filter } from "lucide-react";
import { useApplicationsData, useApplicationStats } from "@/hooks/useTraineeApplications";
import { ApplicationsTable } from "@/components/registration/ApplicationsTable";
import { ScreeningDialog } from "@/components/registration/ScreeningDialog";
import { RegistrationDialog } from "@/components/registration/RegistrationDialog";
import { ApplicationCaptureDialog } from "@/components/registration/ApplicationCaptureDialog";
import { useTrades } from "@/hooks/useTrades";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/table-skeleton";

const ApplicationsInbox = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrade, setSelectedTrade] = useState<string>("all");
  const [selectedIntake, setSelectedIntake] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("all");
  
  const [screeningDialogOpen, setScreeningDialogOpen] = useState(false);
  const [registrationDialogOpen, setRegistrationDialogOpen] = useState(false);
  const [captureDialogOpen, setCaptureDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);

  const { data: applications, isLoading } = useApplicationsData();
  const { data: stats } = useApplicationStats();
  const { data: trades } = useTrades();

  // Filter applications based on tab and filters
  const filteredApplications = applications?.filter((app) => {
    // Tab filter
    let matchesTab = true;
    switch (activeTab) {
      case "pending":
        matchesTab = app.qualification_status === "pending";
        break;
      case "qualified":
        matchesTab = app.qualification_status === "provisionally_qualified" &&
          app.registration_status !== "registered" &&
          app.registration_status !== "fully_registered";
        break;
      case "not_qualified":
        matchesTab = app.qualification_status === "does_not_qualify";
        break;
      case "registered":
        matchesTab = app.registration_status === "registered" || app.registration_status === "fully_registered";
        break;
    }

    // Search filter
    const matchesSearch =
      app.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.application_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.national_id?.toLowerCase().includes(searchQuery.toLowerCase());

    // Trade filter
    const matchesTrade = selectedTrade === "all" || app.trade_id === selectedTrade;

    // Intake filter
    const matchesIntake = selectedIntake === "all" || app.intake === selectedIntake;

    return matchesTab && matchesSearch && matchesTrade && matchesIntake;
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
    // For now, open screening dialog in read-only mode or a details view
    setSelectedApplication(application);
    setScreeningDialogOpen(true);
  };

  return (
    <DashboardLayout
      title="Applications Inbox"
      subtitle="Manage trainee applications and admissions"
      navItems={registrationOfficerNavItems}
      groupLabel="Registration"
    >
      <div className="space-y-4">
        {/* Stats Overview */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          <Card className="p-0 cursor-pointer hover:border-primary transition-colors" onClick={() => setActiveTab("all")}>
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium">Total</CardTitle>
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">{stats?.totalApplications || 0}</div>
            </CardContent>
          </Card>

          <Card className="p-0 cursor-pointer hover:border-primary transition-colors" onClick={() => setActiveTab("pending")}>
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium">Pending</CardTitle>
              <Clock className="h-3.5 w-3.5 text-warning" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-warning">{stats?.pending || 0}</div>
            </CardContent>
          </Card>

          <Card className="p-0 cursor-pointer hover:border-primary transition-colors" onClick={() => setActiveTab("qualified")}>
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium">Qualified</CardTitle>
              <CheckCircle className="h-3.5 w-3.5 text-primary" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-primary">{stats?.provisionallyQualified || 0}</div>
            </CardContent>
          </Card>

          <Card className="p-0 cursor-pointer hover:border-primary transition-colors" onClick={() => setActiveTab("not_qualified")}>
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium">Not Qualified</CardTitle>
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-destructive">{stats?.doesNotQualify || 0}</div>
            </CardContent>
          </Card>

          <Card className="p-0 cursor-pointer hover:border-primary transition-colors" onClick={() => setActiveTab("registered")}>
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium">Registered</CardTitle>
              <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">
                {(stats?.januaryRegistered || 0) + (stats?.julyRegistered || 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Applications Table Card */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-base">Applications</CardTitle>
                <CardDescription className="text-xs">
                  Screen applications and manage registration process
                </CardDescription>
              </div>
              <Button onClick={() => setCaptureDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-1" />
                New Application
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="qualified">Qualified</TabsTrigger>
                <TabsTrigger value="not_qualified">Not Qualified</TabsTrigger>
                <TabsTrigger value="registered">Registered</TabsTrigger>
              </TabsList>
            </Tabs>

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
                title="No applications found"
                description={searchQuery || selectedTrade !== "all" || selectedIntake !== "all"
                  ? "No applications match your filters"
                  : "Start by capturing a new application"}
              />
            ) : (
              <ApplicationsTable
                applications={filteredApplications || []}
                onScreen={handleScreen}
                onRegister={handleRegister}
                onViewDetails={handleViewDetails}
              />
            )}
          </CardContent>
        </Card>

        {/* Dialogs */}
        {selectedApplication && (
          <>
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
          </>
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
