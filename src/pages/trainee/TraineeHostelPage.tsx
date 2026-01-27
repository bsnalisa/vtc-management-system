import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { Building, Bed, Calendar, DollarSign, AlertCircle, CheckCircle, Phone } from "lucide-react";
import { withRoleAccess } from "@/components/withRoleAccess";
import { Separator } from "@/components/ui/separator";

const TraineeHostelPage = () => {
  // Mock hostel data - in production, fetch from hostel_allocations
  const hasHostelAllocation = true;
  
  const hostelData = {
    building: "Block A - Male Hostel",
    room: "A-105",
    bed: "Bed 2",
    checkInDate: "February 1, 2025",
    checkOutDate: "November 30, 2025",
    status: "active" as const,
    monthlyFee: 1500,
    balance: 3000,
  };

  const roommates = [
    { name: "John Shipanga", bed: "Bed 1", trade: "Welding" },
    { name: "Peter Angula", bed: "Bed 3", trade: "Electrical" },
  ];

  const hostelRules = [
    "Quiet hours: 10 PM - 6 AM",
    "No visitors after 8 PM",
    "Keep common areas clean",
    "Report maintenance issues promptly",
    "No cooking in rooms",
  ];

  if (!hasHostelAllocation) {
    return (
      <DashboardLayout
        title="Hostel Accommodation"
        subtitle="View your hostel allocation and details"
        navItems={traineeNavItems}
        groupLabel="Trainee iEnabler"
      >
        <Card className="border-0 shadow-md">
          <CardContent className="p-12 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Building className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Hostel Allocation</h3>
            <p className="text-muted-foreground mb-4">
              You have not been allocated hostel accommodation. If you require accommodation,
              please contact the Hostel Coordinator.
            </p>
            <Button>Request Accommodation</Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Hostel Accommodation"
      subtitle="View your hostel allocation and details"
      navItems={traineeNavItems}
      groupLabel="Trainee iEnabler"
    >
      <div className="space-y-6">
        {/* Allocation Summary */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>My Room Allocation</CardTitle>
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Building className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Building</p>
                  <p className="font-medium">{hostelData.building}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-blue-100">
                  <Building className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Room</p>
                  <p className="font-medium">{hostelData.room}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-purple-100">
                  <Bed className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bed</p>
                  <p className="font-medium">{hostelData.bed}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-orange-100">
                  <Calendar className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium text-sm">{hostelData.checkInDate} - {hostelData.checkOutDate}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Fee Status */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Hostel Fees
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-4 rounded-lg bg-muted">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Fee</p>
                  <p className="text-xl font-bold">N$ {hostelData.monthlyFee.toLocaleString()}</p>
                </div>
                <Badge variant="outline">Per Month</Badge>
              </div>
              
              {hostelData.balance > 0 && (
                <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-yellow-800">Outstanding Balance</p>
                      <p className="text-2xl font-bold text-yellow-900">N$ {hostelData.balance.toLocaleString()}</p>
                    </div>
                  </div>
                  <Button className="w-full mt-3">Pay Now</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Roommates */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Roommates</CardTitle>
              <CardDescription>Your room companions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {roommates.map((roommate, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div>
                    <p className="font-medium">{roommate.name}</p>
                    <p className="text-sm text-muted-foreground">{roommate.trade} • {roommate.bed}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Hostel Rules */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Hostel Rules & Guidelines</CardTitle>
            <CardDescription>Please adhere to these rules during your stay</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {hostelRules.map((rule, index) => (
                <li key={index} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
            <Separator className="my-4" />
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Hostel Coordinator</p>
                <p className="text-sm text-muted-foreground">+264 81 234 5678 • hostel@vtc.edu.na</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(TraineeHostelPage, {
  requiredRoles: ["trainee"],
});
