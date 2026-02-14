import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { Building, Bed, Calendar, DollarSign, AlertCircle, CheckCircle, Phone, Loader2 } from "lucide-react";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Separator } from "@/components/ui/separator";
import { useTraineeUserId, useTraineeRecord, useTraineeHostelAllocation, useTraineeRoommates, useTraineeHostelFees } from "@/hooks/useTraineePortalData";

const TraineeHostelPage = () => {
  const userId = useTraineeUserId();
  const { data: trainee, isLoading: tLoading } = useTraineeRecord(userId);
  const { data: allocation, isLoading: aLoading } = useTraineeHostelAllocation(trainee?.id);
  const { data: roommates } = useTraineeRoommates(allocation?.room_id, trainee?.id);
  const { data: hostelFees } = useTraineeHostelFees(trainee?.id);

  const isLoading = tLoading || aLoading;

  if (isLoading) {
    return (
      <DashboardLayout title="Hostel Accommodation" subtitle="View your hostel allocation and details" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  if (!allocation) {
    return (
      <DashboardLayout title="Hostel Accommodation" subtitle="View your hostel allocation and details" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
        <Card className="border-0 shadow-md">
          <CardContent className="p-12 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Building className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Hostel Allocation</h3>
            <p className="text-muted-foreground">You have not been allocated hostel accommodation. If you require accommodation, please contact the Hostel Coordinator.</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const building = allocation.hostel_buildings as any;
  const room = allocation.hostel_rooms as any;
  const bed = allocation.hostel_beds as any;
  const totalHostelFees = hostelFees?.reduce((s, f) => s + Number(f.fee_amount || 0), 0) || 0;
  const totalHostelPaid = hostelFees?.reduce((s, f) => s + Number(f.amount_paid || 0), 0) || 0;
  const hostelBalance = totalHostelFees - totalHostelPaid;

  return (
    <DashboardLayout title="Hostel Accommodation" subtitle="View your hostel allocation and details" navItems={traineeNavItems} groupLabel="Trainee iEnabler">
      <div className="space-y-6">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>My Room Allocation</CardTitle>
              <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10"><Building className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Building</p>
                  <p className="font-medium">{building?.name || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-blue-100"><Building className="h-5 w-5 text-blue-600" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Room</p>
                  <p className="font-medium">{room?.room_number || "N/A"} (Floor {room?.floor || "N/A"})</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-purple-100"><Bed className="h-5 w-5 text-purple-600" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Bed</p>
                  <p className="font-medium">Bed {bed?.bed_number || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-orange-100"><Calendar className="h-5 w-5 text-orange-600" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Check-in</p>
                  <p className="font-medium text-sm">{allocation.check_in_date ? new Date(allocation.check_in_date).toLocaleDateString("en-ZA") : "N/A"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" />Hostel Fees</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-4 rounded-lg bg-muted">
                <div>
                  <p className="text-sm text-muted-foreground">Total Hostel Fees</p>
                  <p className="text-xl font-bold">N$ {totalHostelFees.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Paid</p>
                  <p className="text-xl font-bold text-primary">N$ {totalHostelPaid.toLocaleString()}</p>
                </div>
              </div>
              {hostelBalance > 0 && (
                <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-800">Outstanding Balance</p>
                      <p className="text-2xl font-bold text-yellow-900">N$ {hostelBalance.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Roommates</CardTitle>
              <CardDescription>Your room companions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {roommates && roommates.length > 0 ? roommates.map((rm: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div>
                    <p className="font-medium">{rm.trainees?.first_name} {rm.trainees?.last_name}</p>
                    <p className="text-sm text-muted-foreground">{rm.trainees?.trades?.name || "N/A"} • Bed {rm.hostel_beds?.bed_number || "N/A"}</p>
                  </div>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground text-center py-4">No roommates assigned</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Hostel Rules & Guidelines</CardTitle>
            <CardDescription>Please adhere to these rules during your stay</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {["Quiet hours: 10 PM - 6 AM", "No visitors after 8 PM", "Keep common areas clean", "Report maintenance issues promptly", "No cooking in rooms"].map((rule, i) => (
                <li key={i} className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-primary" /><span>{rule}</span></li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(TraineeHostelPage, { requiredRoles: ["trainee"] });
