import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, CheckCircle, DollarSign, UserPlus, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { useProvisionTraineeAuth, canProvisionAccount, getProvisioningStatusDisplay } from "@/hooks/useProvisionTraineeAuth";

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
  const provisionAuth = useProvisionTraineeAuth();

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
        return <Badge className="bg-blue-500">Provisionally Admitted</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Applied</Badge>;
    }
  };

  const getAccountStatusBadge = (application: Application) => {
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
              <p>Provisioning failed - click Retry to try again</p>
            ) : application.system_email ? (
              <p>Pending: {application.system_email}</p>
            ) : (
              <p>No system email assigned yet</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const handleProvision = (application: Application) => {
    provisionAuth.mutate({ applicationId: application.id, triggerType: 'manual' });
  };

  const getProvisioningEligibility = (application: Application) => {
    return canProvisionAccount({
      qualification_status: application.qualification_status,
      account_provisioning_status: application.account_provisioning_status,
      trainee_number: application.trainee_number,
      system_email: application.system_email,
      user_id: application.user_id,
    });
  };

  // Determine which action button to show based on status
  const getActionButton = (application: Application) => {
    const { canProvision } = getProvisioningEligibility(application);
    const isFailed = application.account_provisioning_status === 'failed';
    
    // Screen action - only for pending qualification
    if (application.qualification_status === "pending") {
      return (
        <Button size="sm" variant="outline" onClick={() => onScreen(application)}>
          <CheckCircle className="h-4 w-4 mr-1" />
          Screen
        </Button>
      );
    }

    // Provision/Retry action - for qualified apps needing account
    if (canProvision) {
      return (
        <Button 
          size="sm" 
          variant={isFailed ? "destructive" : "outline"}
          onClick={() => handleProvision(application)}
          disabled={provisionAuth.isPending}
        >
          {provisionAuth.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : isFailed ? (
            <RefreshCw className="h-4 w-4 mr-1" />
          ) : (
            <UserPlus className="h-4 w-4 mr-1" />
          )}
          {isFailed ? 'Retry' : 'Create Account'}
        </Button>
      );
    }

    // Register action - for payment cleared applications
    if (
      application.qualification_status === "provisionally_qualified" &&
      (application.registration_status === "payment_cleared" || 
       application.registration_status === "payment_verified")
    ) {
      return (
        <Button size="sm" onClick={() => onRegister(application)}>
          <CheckCircle className="h-4 w-4 mr-1" />
          Register
        </Button>
      );
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
