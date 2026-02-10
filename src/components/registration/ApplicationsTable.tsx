import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, UserCheck, AlertCircle, Eye } from "lucide-react";

interface Application {
  id: string;
  application_number: string;
  trainee_number: string | null;
  system_email?: string | null;
  user_id?: string | null;
  account_provisioning_status?: string | null;
  first_name: string;
  last_name: string;
  national_id: string;
  phone: string;
  trades: { name: string; code: string } | null;
  preferred_training_mode: string;
  preferred_level: number;
  intake: string;
  academic_year: string;
  qualification_status: string;
  registration_status: string;
  created_at: string;
}

interface ApplicationsTableProps {
  applications: Application[];
  onScreen: (application: Application) => void;
  onRegister: (application: Application) => void;
  onViewDetails: (application: Application) => void;
}

export const ApplicationsTable = ({
  applications,
  onScreen,
  onRegister,
  onViewDetails,
}: ApplicationsTableProps) => {

  const getQualificationBadge = (status: string) => {
    switch (status) {
      case "provisionally_qualified":
        return <Badge className="bg-green-500">Provisionally Qualified</Badge>;
      case "does_not_qualify":
        return <Badge variant="destructive">Does Not Qualify</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getRegistrationBadge = (status: string) => {
    switch (status) {
      case "registered":
      case "fully_registered":
        return <Badge className="bg-green-500">REGISTERED</Badge>;
      case "registration_fee_pending":
        return <Badge className="bg-amber-500">REGISTRATION_FEE_PENDING</Badge>;
      case "provisionally_admitted":
        return <Badge className="bg-blue-500">PROVISIONALLY_ADMITTED</Badge>;
      case "pending_payment":
        return <Badge className="bg-violet-500">APPLICATION_FEE_PENDING</Badge>;
      case "rejected":
        return <Badge variant="destructive">REJECTED</Badge>;
      default:
        return <Badge variant="secondary">APPLIED</Badge>;
    }
  };

  const getAccountStatusBadge = (application: Application) => {
    // Account is created ONLY after application fee clearance (provisionally_admitted or later)
    if (application.user_id) {
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          Active
        </Badge>
      );
    }

    if (application.account_provisioning_status === 'failed') {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <AlertCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    }

    // For all pre-clearance stages, show "Not Created"
    if (['applied', 'pending_payment', 'pending'].includes(application.registration_status) ||
        application.qualification_status === 'pending') {
      return (
        <Badge variant="outline" className="text-muted-foreground border-muted">
          Not Created
        </Badge>
      );
    }

    return <span className="text-muted-foreground text-sm">-</span>;
  };

  // Determine action button based on workflow status
  const getActionButton = (application: Application) => {
    // 1. Screen action - ONLY for applications that haven't been screened yet
    if (application.qualification_status === "pending") {
      return (
        <Button size="sm" variant="outline" onClick={() => onScreen(application)}>
          <CheckCircle className="h-4 w-4 mr-1" />
          Screen
        </Button>
      );
    }

    // 2. Rejected - no further actions
    if (application.qualification_status === "does_not_qualify") {
      return (
        <Badge variant="outline" className="text-destructive border-destructive/30">
          Rejected
        </Badge>
      );
    }

    // 3. For qualified applications, show status-based actions
    if (application.qualification_status === "provisionally_qualified") {
      switch (application.registration_status) {
        case "pending_payment":
          // Awaiting application fee - Debtor Officer handles this
          return (
            <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200">
              <Clock className="h-3 w-3 mr-1" />
              Awaiting App Fee
            </Badge>
          );
        
        case "provisionally_admitted":
          // Ready for registration
          return (
            <Button size="sm" onClick={() => onRegister(application)}>
              <UserCheck className="h-4 w-4 mr-1" />
              Register
            </Button>
          );
        
        case "registration_fee_pending":
          // Awaiting registration fee - Debtor Officer handles this
          return (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              <Clock className="h-3 w-3 mr-1" />
              Awaiting Reg Fee
            </Badge>
          );
        
        case "registered":
        case "fully_registered":
          // Completed
          return (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              Complete
            </Badge>
          );
      }
    }

    return null;
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>App Number</TableHead>
            <TableHead>Trainee Number</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>National ID</TableHead>
            <TableHead>Trade</TableHead>
            <TableHead>Intake</TableHead>
            <TableHead>Qualification</TableHead>
            <TableHead>Registration</TableHead>
            <TableHead>Account</TableHead>
            <TableHead className="min-w-[180px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((application) => (
            <TableRow key={application.id}>
              <TableCell className="font-mono text-sm">{application.application_number}</TableCell>
              <TableCell className="font-mono text-sm">
                {application.trainee_number || "-"}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {application.first_name} {application.last_name}
              </TableCell>
              <TableCell>{application.national_id}</TableCell>
              <TableCell>{application.trades?.name || "-"}</TableCell>
              <TableCell className="capitalize whitespace-nowrap">
                {application.intake} {application.academic_year}
              </TableCell>
              <TableCell>{getQualificationBadge(application.qualification_status)}</TableCell>
              <TableCell>{getRegistrationBadge(application.registration_status)}</TableCell>
              <TableCell>{getAccountStatusBadge(application)}</TableCell>
              <TableCell>
                <div className="flex gap-2 flex-nowrap">
                  {getActionButton(application)}
                  {/* Only show view details for screened applications (not the screening icon) */}
                  {application.qualification_status !== "pending" && (
                    <Button size="sm" variant="ghost" onClick={() => onViewDetails(application)} title="View Details">
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
