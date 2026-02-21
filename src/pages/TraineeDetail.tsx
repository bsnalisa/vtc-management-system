import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useTraineeDetail, useUpdateTraineePersonalDetails } from "@/hooks/useTraineeDetail";
import { useCreateUpdateRequest } from "@/hooks/useTraineeUpdateRequests";
import { useTrades } from "@/hooks/useTrades";

const TraineeDetail = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: trainee, isLoading } = useTraineeDetail(id);
  const { data: trades } = useTrades();
  const updatePersonalDetails = useUpdateTraineePersonalDetails();
  const createUpdateRequest = useCreateUpdateRequest();

  const [personalData, setPersonalData] = useState<any>({});
  const [enrollmentData, setEnrollmentData] = useState<any>({});
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [isEditingEnrollment, setIsEditingEnrollment] = useState(false);

  // Initialize form data when trainee loads
  useState(() => {
    if (trainee) {
      setPersonalData({
        first_name: trainee.first_name,
        last_name: trainee.last_name,
        gender: trainee.gender,
        date_of_birth: trainee.date_of_birth,
        national_id: trainee.national_id,
        phone: trainee.phone,
        email: trainee.email,
        address: trainee.address,
      });
      setEnrollmentData({
        trade_id: trainee.trade_id,
        training_mode: trainee.training_mode,
        level: trainee.level,
        academic_year: trainee.academic_year,
      });
    }
  });

  const handleSavePersonalDetails = () => {
    if (!id) return;
    updatePersonalDetails.mutate(
      { traineeId: id, updates: personalData },
      {
        onSuccess: () => setIsEditingPersonal(false),
      }
    );
  };

  const handleSubmitEnrollmentUpdate = () => {
    if (!id || !trainee) return;

    const oldValues = {
      trade_id: trainee.trade_id,
      training_mode: trainee.training_mode,
      level: trainee.level,
      academic_year: trainee.academic_year,
    };

    createUpdateRequest.mutate(
      {
        trainee_id: id,
        request_type: "enrollment_details",
        old_values: oldValues,
        new_values: enrollmentData,
      },
      {
        onSuccess: () => setIsEditingEnrollment(false),
      }
    );
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Loading..." subtitle="Please wait..." navItems={navItems} groupLabel={groupLabel}>
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!trainee) {
    return (
      <DashboardLayout title="Trainee Not Found" subtitle="Unable to load trainee details" navItems={navItems} groupLabel={groupLabel}>
        <Card>
          <CardContent className="pt-6">
            <p>Trainee not found.</p>
            <Button onClick={() => navigate("/trainees")} className="mt-4">
              Back to List
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={`${trainee.first_name} ${trainee.last_name}`}
      subtitle={`Trainee ID: ${trainee.trainee_id}`}
      navItems={navItems}
      groupLabel={groupLabel}
    >
      <div className="space-y-6">
        <Button variant="outline" onClick={() => navigate("/trainees")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to List
        </Button>

        {trainee.has_pending_update && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900">Pending Approval</p>
              <p className="text-sm text-amber-700">This trainee has changes awaiting approval from Head of Trainee Support.</p>
            </div>
          </div>
        )}

        <Tabs defaultValue="personal" className="space-y-6">
          <TabsList>
            <TabsTrigger value="personal">Personal Details</TabsTrigger>
            <TabsTrigger value="enrollment">Enrollment Details</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>View and edit trainee personal details</CardDescription>
                  </div>
                  {!isEditingPersonal ? (
                    <Button onClick={() => setIsEditingPersonal(true)} className="w-full sm:w-auto">Edit</Button>
                  ) : (
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button variant="outline" onClick={() => setIsEditingPersonal(false)} className="flex-1 sm:flex-none">Cancel</Button>
                      <Button onClick={handleSavePersonalDetails} className="flex-1 sm:flex-none">
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>First Name</Label>
                    {isEditingPersonal ? (
                      <Input
                        value={personalData.first_name || ""}
                        onChange={(e) => setPersonalData({ ...personalData, first_name: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm mt-1">{trainee.first_name}</p>
                    )}
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    {isEditingPersonal ? (
                      <Input
                        value={personalData.last_name || ""}
                        onChange={(e) => setPersonalData({ ...personalData, last_name: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm mt-1">{trainee.last_name}</p>
                    )}
                  </div>
                  <div>
                    <Label>Gender</Label>
                    {isEditingPersonal ? (
                      <Select
                        value={personalData.gender || ""}
                        onValueChange={(value) => setPersonalData({ ...personalData, gender: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm mt-1 capitalize">{trainee.gender}</p>
                    )}
                  </div>
                  <div>
                    <Label>Date of Birth</Label>
                    {isEditingPersonal ? (
                      <Input
                        type="date"
                        value={personalData.date_of_birth || ""}
                        onChange={(e) => setPersonalData({ ...personalData, date_of_birth: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm mt-1">{trainee.date_of_birth}</p>
                    )}
                  </div>
                  <div>
                    <Label>National ID</Label>
                    {isEditingPersonal ? (
                      <Input
                        value={personalData.national_id || ""}
                        onChange={(e) => setPersonalData({ ...personalData, national_id: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm mt-1">{trainee.national_id}</p>
                    )}
                  </div>
                  <div>
                    <Label>Phone</Label>
                    {isEditingPersonal ? (
                      <Input
                        value={personalData.phone || ""}
                        onChange={(e) => setPersonalData({ ...personalData, phone: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm mt-1">{trainee.phone}</p>
                    )}
                  </div>
                  <div>
                    <Label>Email</Label>
                    {isEditingPersonal ? (
                      <Input
                        type="email"
                        value={personalData.email || ""}
                        onChange={(e) => setPersonalData({ ...personalData, email: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm mt-1">{trainee.email || "N/A"}</p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <Label>Address</Label>
                    {isEditingPersonal ? (
                      <Input
                        value={personalData.address || ""}
                        onChange={(e) => setPersonalData({ ...personalData, address: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm mt-1">{trainee.address}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="enrollment" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Enrollment Details</CardTitle>
                    <CardDescription>Changes require approval from Head of Trainee Support</CardDescription>
                  </div>
                  {!isEditingEnrollment ? (
                    <Button onClick={() => setIsEditingEnrollment(true)} className="w-full sm:w-auto">Request Changes</Button>
                  ) : (
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button variant="outline" onClick={() => setIsEditingEnrollment(false)} className="flex-1 sm:flex-none">Cancel</Button>
                      <Button onClick={handleSubmitEnrollmentUpdate} className="flex-1 sm:flex-none">
                        <Save className="mr-2 h-4 w-4" />
                        Submit for Approval
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Programme/Trade</Label>
                    {isEditingEnrollment ? (
                      <Select
                        value={enrollmentData.trade_id || ""}
                        onValueChange={(value) => setEnrollmentData({ ...enrollmentData, trade_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {trades?.map((trade) => (
                            <SelectItem key={trade.id} value={trade.id}>
                              {trade.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm mt-1">{trainee.trades?.name}</p>
                    )}
                  </div>
                  <div>
                    <Label>Training Mode</Label>
                    {isEditingEnrollment ? (
                      <Select
                        value={enrollmentData.training_mode || ""}
                        onValueChange={(value) => setEnrollmentData({ ...enrollmentData, training_mode: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fulltime">Full Time</SelectItem>
                          <SelectItem value="bdl">Block & Day Release</SelectItem>
                          <SelectItem value="shortcourse">Short Course</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm mt-1 capitalize">{trainee.training_mode.replace("_", " ")}</p>
                    )}
                  </div>
                  <div>
                    <Label>Level</Label>
                    {isEditingEnrollment ? (
                      <Select
                        value={String(enrollmentData.level) || ""}
                        onValueChange={(value) => setEnrollmentData({ ...enrollmentData, level: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4].map((level) => (
                            <SelectItem key={level} value={String(level)}>
                              Level {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm mt-1">Level {trainee.level}</p>
                    )}
                  </div>
                  <div>
                    <Label>Academic Year</Label>
                    {isEditingEnrollment ? (
                      <Input
                        value={enrollmentData.academic_year || ""}
                        onChange={(e) => setEnrollmentData({ ...enrollmentData, academic_year: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm mt-1">{trainee.academic_year}</p>
                    )}
                  </div>
                </div>
                <Separator />
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-900 font-medium">📝 Important</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Changes to enrollment details require approval from the Head of Trainee Support before they take effect.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default TraineeDetail;
