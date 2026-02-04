import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle, DollarSign, UserPlus, Loader2 } from "lucide-react";
import { useProvisionTraineeAuth } from "@/hooks/useProvisionTraineeAuth";

interface Application {
  id: string;
  application_number: string;
  trainee_number: string | null;
  system_email?: string | null;
  user_id?: string | null;
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
        return <Badge className="bg-green-500">Fully Registered</Badge>;
      case "pending_payment":
        return <Badge className="bg-yellow-500">Pending Payment</Badge>;
      case "provisionally_admitted":
        return <Badge className="bg-blue-500">Provisionally Admitted</Badge>;
      case "payment_verified":
        return <Badge className="bg-emerald-500">Payment Verified</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Applied</Badge>;
    }
  };

  const getAccountBadge = (application: Application) => {
    if (application.user_id) {
      return <Badge className="bg-green-500">Active</Badge>;
    }
    if (application.system_email && application.qualification_status === 'provisionally_qualified') {
      return <Badge variant="destructive">Not Created</Badge>;
    }
    return <Badge variant="secondary">N/A</Badge>;
  };

  const handleProvision = (application: Application) => {
    provisionAuth.mutate({ applicationId: application.id });
  };

  const canProvision = (application: Application) => {
    return (
      application.qualification_status === 'provisionally_qualified' &&
      application.system_email &&
      !application.user_id
    );
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
            <TableHead className="min-w-[200px]">Actions</TableHead>
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
              <TableCell>{getAccountBadge(application)}</TableCell>
              <TableCell>
                <div className="flex gap-2 flex-nowrap">
                  {application.qualification_status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => onScreen(application)}>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Screen
                    </Button>
                  )}
                  {canProvision(application) && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleProvision(application)}
                      disabled={provisionAuth.isPending}
                    >
                      {provisionAuth.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4 mr-1" />
                      )}
                      Create Account
                    </Button>
                  )}
                  {application.qualification_status === "provisionally_qualified" &&
                    application.registration_status === "provisionally_admitted" && (
                      <Button size="sm" onClick={() => onRegister(application)}>
                        <DollarSign className="h-4 w-4 mr-1" />
                        Register
                      </Button>
                    )}
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
