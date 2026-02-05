import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, CheckCircle, Clock, UserCheck, AlertCircle, Banknote } from "lucide-react";
import { getProvisioningStatusDisplay } from "@/hooks/useProvisionTraineeAuth";

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
      case "fully_registered":
      case "registered":
        return <Badge className="bg-green-500">Registered</Badge>;
      case "payment_cleared":
      case "payment_verified":
        return <Badge className="bg-emerald-500">Payment Cleared</Badge>;
      case "pending_payment":
        return <Badge className="bg-yellow-500">Pending Payment</Badge>;
      case "provisionally_admitted":
        return <Badge className="bg-blue-500">Awaiting Payment</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Applied</Badge>;
    }
  };

  const getAccountStatusBadge = (application: Application) => {
    // Only show account status for qualified applications
    if (application.qualification_status !== 'provisionally_qualified') {
      return <span className="text-muted-foreground text-sm">-</span>;
    }

    const { label, variant, color } = getProvisioningStatusDisplay(
      application.account_provisioning_status,
      !!application.user_id
    );
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={variant} className={color}>
              {application.account_provisioning_status === 'failed' && (
                <AlertCircle className="h-3 w-3 mr-1" />
              )}
              {label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {application.user_id ? (
              <p>Account active: {application.system_email}</p>
            ) : application.account_provisioning_status === 'failed' ? (
              <p>Provisioning failed - clear payment to retry</p>
            ) : application.system_email ? (
              <p>Will be created on payment: {application.system_email}</p>
            ) : (
              <p>Account created after payment clearance</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Determine action button based on workflow status
  const getActionButton = (application: Application) => {
    // 1. Screen action - for applications pending screening
    if (application.qualification_status === "pending") {
      return (
        <Button size="sm" variant="outline" onClick={() => onScreen(application)}>
          <CheckCircle className="h-4 w-4 mr-1" />
          Screen
        </Button>
      );
    }

    // 2. For qualified applications, show status-based actions
    if (application.qualification_status === "provisionally_qualified") {
      switch (application.registration_status) {
        case "provisionally_admitted":
          // Awaiting payment - show indicator
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    <Clock className="h-3 w-3 mr-1" />
                    Awaiting Payment
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Payment must be cleared by Debtor Officer</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        
        case "payment_cleared":
        case "payment_verified":
          // Ready for registration
          return (
            <Button size="sm" onClick={() => onRegister(application)}>
              <UserCheck className="h-4 w-4 mr-1" />
              Register
            </Button>
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
                  <Button size="sm" variant="ghost" onClick={() => onViewDetails(application)}>
                    <FileText className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
