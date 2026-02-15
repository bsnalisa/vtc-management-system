import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Filter, CheckCircle, XCircle, UserPlus, ClipboardCheck } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { registrationOfficerNavItems } from "@/lib/navigationConfig";
import { ApplicationsTable } from "@/components/registration/ApplicationsTable";
import { ScreeningDialog } from "@/components/registration/ScreeningDialog";
import { RegistrationDialog } from "@/components/registration/RegistrationDialog";
import { useTraineeApplications, useApplicationStats } from "@/hooks/useTraineeApplications";
import { useTrades } from "@/hooks/useTrades";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/table-skeleton";

const ApplicationManagement = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrade, setSelectedTrade] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("qualified");
  const [screeningDialogOpen, setScreeningDialogOpen] = useState(false);
  const [registrationDialogOpen, setRegistrationDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);

  // Fetch only screened applications (exclude pending)
  const { data: applications, isLoading } = useTraineeApplications();
  const { data: stats } = useApplicationStats();
  const { data: trades } = useTrades();

  // Filter to only screened applications (not pending)
  const screenedApplications = applications?.filter(
    (app) => app.qualification_status !== "pending"
  );

  const filteredApplications = screenedApplications?.filter((app) => {
    let matchesTab = true;
    switch (activeTab) {
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
      case "all":
        break;
    }

    const matchesSearch =
      app.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.application_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.trainee_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.national_id?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTrade = selectedTrade === "all" || app.trade_id === selectedTrade;

    return matchesTab && matchesSearch && matchesTrade;
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
    setScreeningDialogOpen(true);
  };

  return (
    <DashboardLayout
      title="Admission Results"
      subtitle="View screening outcomes and manage registration"
      navItems={registrationOfficerNavItems}
      groupLabel="Registration"
    >
      <div className="space-y-4">
        {/* Stats Overview */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
          <Card className="p-0 cursor-pointer hover:border-primary transition-colors" onClick={() => setActiveTab("qualified")}>
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium">Provisionally Qualified</CardTitle>
              <CheckCircle className="h-3.5 w-3.5 text-primary" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-primary">{stats?.provisionallyQualified || 0}</div>
              <p className="text-[10px] text-muted-foreground">Awaiting registration</p>
            </CardContent>
          </Card>

          <Card className="p-0 cursor-pointer hover:border-primary transition-colors" onClick={() => setActiveTab("not_qualified")}>
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium">Does Not Qualify</CardTitle>
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold text-destructive">{stats?.doesNotQualify || 0}</div>
              <p className="text-[10px] text-muted-foreground">Not meeting criteria</p>
            </CardContent>
          </Card>

          <Card className="p-0 cursor-pointer hover:border-primary transition-colors" onClick={() => setActiveTab("registered")}>
            <CardHeader className="p-3 pb-1 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-xs font-medium">Fully Registered</CardTitle>
              <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-xl font-bold">
                {(stats?.januaryRegistered || 0) + (stats?.julyRegistered || 0)}
              </div>
              <p className="text-[10px] text-muted-foreground">Completed registration</p>
            </CardContent>
          </Card>
        </div>

        {/* Results Table */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Admission Results
            </CardTitle>
            <CardDescription className="text-xs">
              Screened applications and their qualification outcomes
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">All Screened</TabsTrigger>
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
                  placeholder="Search by name, application/trainee number, or ID..."
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
            </div>

            {isLoading ? (
              <TableSkeleton columns={9} rows={5} />
            ) : filteredApplications?.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="No results found"
                description="No screened applications match your criteria"
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
      </div>
    </DashboardLayout>
  );
};

export default ApplicationManagement;
