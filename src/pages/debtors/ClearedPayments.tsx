import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CheckCircle, 
  Search,
  History,
  FileText,
  GraduationCap,
  Building,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { debtorOfficerNavItems } from "@/lib/navigationConfig";
import { useFinancialQueue, FinancialQueueEntry } from "@/hooks/useFinancialQueue";
import { format } from "date-fns";

const ClearedPayments = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");

  // Query cleared payments
  const { data: queueEntries, isLoading } = useFinancialQueue("cleared", entityTypeFilter === "all" ? undefined : entityTypeFilter);

  const filteredEntries = queueEntries?.filter((entry) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    
    const name = entry.trainee_applications
      ? `${entry.trainee_applications.first_name} ${entry.trainee_applications.last_name}`
      : entry.trainees
      ? `${entry.trainees.first_name} ${entry.trainees.last_name}`
      : "";
    const traineeNumber = entry.trainee_applications?.trainee_number || entry.trainees?.trainee_id || "";
    
    return (
      name.toLowerCase().includes(searchLower) ||
      traineeNumber.toLowerCase().includes(searchLower)
    );
  });

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case "APPLICATION":
        return <FileText className="h-4 w-4 text-violet-600" />;
      case "REGISTRATION":
        return <GraduationCap className="h-4 w-4 text-sky-600" />;
      case "HOSTEL":
        return <Building className="h-4 w-4 text-purple-600" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getEntityBadge = (entityType: string) => {
    switch (entityType) {
      case "APPLICATION":
        return <Badge className="bg-violet-100 text-violet-800 border-violet-200">Application</Badge>;
      case "REGISTRATION":
        return <Badge className="bg-sky-100 text-sky-800 border-sky-200">Registration</Badge>;
      case "HOSTEL":
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Hostel</Badge>;
      default:
        return <Badge variant="outline">{entityType}</Badge>;
    }
  };

  const getPersonName = (entry: FinancialQueueEntry) => {
    if (entry.trainee_applications) {
      return `${entry.trainee_applications.first_name} ${entry.trainee_applications.last_name}`;
    }
    if (entry.trainees) {
      return `${entry.trainees.first_name} ${entry.trainees.last_name}`;
    }
    return "Unknown";
  };

  const getTraineeNumber = (entry: FinancialQueueEntry) => {
    return entry.trainee_applications?.trainee_number || entry.trainees?.trainee_id || "N/A";
  };

  return (
    <DashboardLayout
      title="Cleared Payments"
      subtitle="Payment history and audit trail"
      navItems={debtorOfficerNavItems}
      groupLabel="Financial Operations"
    >
      <div className="space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Payment History
            </CardTitle>
            <CardDescription>
              All cleared payments from the financial queue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or trainee number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="APPLICATION">Application Fees</SelectItem>
                  <SelectItem value="REGISTRATION">Registration Fees</SelectItem>
                  <SelectItem value="HOSTEL">Hostel Fees</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-96" />
            </CardContent>
          </Card>
        ) : filteredEntries?.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="font-semibold text-lg">No Cleared Payments</h3>
              <p className="text-muted-foreground">
                No payments have been cleared yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trainee</TableHead>
                      <TableHead>Fee Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Cleared At</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries?.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-muted">
                              {getEntityIcon(entry.entity_type)}
                            </div>
                            <div>
                              <p className="font-medium">{getPersonName(entry)}</p>
                              <p className="text-sm text-muted-foreground font-mono">
                                {getTraineeNumber(entry)}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {getEntityBadge(entry.entity_type)}
                            <p className="text-xs text-muted-foreground">
                              {entry.fee_types?.name || entry.description}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <p className="font-bold text-emerald-600">
                            N$ {Number(entry.amount_paid).toLocaleString()}
                          </p>
                          {entry.amount !== entry.amount_paid && (
                            <p className="text-xs text-muted-foreground">
                              of N$ {Number(entry.amount).toLocaleString()}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {entry.payment_method?.replace(/_/g, ' ') || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {entry.cleared_at ? (
                            <div>
                              <p className="text-sm">{format(new Date(entry.cleared_at), "PP")}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(entry.cleared_at), "p")}
                              </p>
                            </div>
                          ) : (
                            "N/A"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Cleared
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ClearedPayments;
