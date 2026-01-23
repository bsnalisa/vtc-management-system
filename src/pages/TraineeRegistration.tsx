import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRegisterTrainee } from "@/hooks/useTrainees";
import { useTrades } from "@/hooks/useTrades";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { registrationOfficerNavItems } from "@/lib/navigationConfig";
import { FormFieldError } from "@/components/ui/form-field-error";
import { validateTraineeRegistration, ValidationResult } from "@/lib/validationUtils";
import { useToast } from "@/hooks/use-toast";

const TraineeRegistration = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: trades, isLoading: tradesLoading } = useTrades();
  const { organizationId } = useOrganizationContext();
  const registerTrainee = useRegisterTrainee();
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dateOfBirth: "",
    idNumber: "",
    phone: "",
    email: "",
    address: "",
    trade: "",
    trainingMode: "",
    level: "",
    academicYear: "2025",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    // Validate on blur
    const validation = validateTraineeRegistration(formData);
    if (validation.errors[field]) {
      setErrors(prev => ({ ...prev, [field]: validation.errors[field] }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const validation = validateTraineeRegistration(formData);
    setErrors(validation.errors);
    setTouched(Object.keys(formData).reduce((acc, key) => ({ ...acc, [key]: true }), {}));

    if (!validation.isValid) {
      toast({
        title: "Validation Error",
        description: "Please correct the highlighted fields",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await registerTrainee.mutateAsync({
        firstName: formData.firstName,
        lastName: formData.lastName,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        national_id: formData.idNumber,
        phone: formData.phone,
        email: formData.email || undefined,
        address: formData.address,
        trade_id: formData.trade,
        training_mode: formData.trainingMode,
        level: parseInt(formData.level),
        academic_year: formData.academicYear,
        organization_id: organizationId || undefined,
      });

      navigate("/trainees");
    } catch (error) {
      console.error("Registration error:", error);
    }
  };

  return (
    <DashboardLayout
      title="Trainee Registration"
      subtitle="Register a new trainee in the system"
      navItems={registrationOfficerNavItems}
      groupLabel="Registration"
    >
      <div className="space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">

        {/* Registration Form */}
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Enter the trainee's personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    placeholder="Enter first name"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    onBlur={() => handleBlur('firstName')}
                    className={touched.firstName && errors.firstName ? "border-destructive" : ""}
                  />
                  <FormFieldError error={touched.firstName ? errors.firstName : undefined} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    placeholder="Enter last name"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    onBlur={() => handleBlur('lastName')}
                    className={touched.lastName && errors.lastName ? "border-destructive" : ""}
                  />
                  <FormFieldError error={touched.lastName ? errors.lastName : undefined} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender *</Label>
                  <Select 
                    value={formData.gender} 
                    onValueChange={(value) => {
                      setFormData({ ...formData, gender: value });
                      setTouched(prev => ({ ...prev, gender: true }));
                    }}
                  >
                    <SelectTrigger className={touched.gender && errors.gender ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormFieldError error={touched.gender ? errors.gender : undefined} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    onBlur={() => handleBlur('dateOfBirth')}
                    className={touched.dateOfBirth && errors.dateOfBirth ? "border-destructive" : ""}
                    max={new Date(new Date().setFullYear(new Date().getFullYear() - 16)).toISOString().split('T')[0]}
                  />
                  <FormFieldError error={touched.dateOfBirth ? errors.dateOfBirth : undefined} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="idNumber">National ID / Passport *</Label>
                <Input
                  id="idNumber"
                  placeholder="Enter ID or passport number"
                  value={formData.idNumber}
                  onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                  onBlur={() => handleBlur('idNumber')}
                  className={touched.idNumber && errors.idNumber ? "border-destructive" : ""}
                />
                <FormFieldError error={touched.idNumber ? errors.idNumber : undefined} />
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>Enter contact details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+264 81 234 5678"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    onBlur={() => handleBlur('phone')}
                    className={touched.phone && errors.phone ? "border-destructive" : ""}
                  />
                  <FormFieldError error={touched.phone ? errors.phone : undefined} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="trainee@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    onBlur={() => handleBlur('email')}
                    className={touched.email && errors.email ? "border-destructive" : ""}
                  />
                  <FormFieldError error={touched.email ? errors.email : undefined} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Physical Address *</Label>
                <Input
                  id="address"
                  placeholder="Enter residential address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  onBlur={() => handleBlur('address')}
                  className={touched.address && errors.address ? "border-destructive" : ""}
                />
                <FormFieldError error={touched.address ? errors.address : undefined} />
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Training Details</CardTitle>
              <CardDescription>Select training program and level</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="trade">Trade / Program *</Label>
                  <Select 
                    value={formData.trade} 
                    onValueChange={(value) => {
                      setFormData({ ...formData, trade: value });
                      setTouched(prev => ({ ...prev, trade: true }));
                    }} 
                    disabled={tradesLoading}
                  >
                    <SelectTrigger className={touched.trade && errors.trade ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select trade" />
                    </SelectTrigger>
                    <SelectContent>
                      {trades?.map((trade) => (
                        <SelectItem key={trade.id} value={trade.id}>
                          {trade.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormFieldError error={touched.trade ? errors.trade : undefined} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trainingMode">Training Mode *</Label>
                  <Select 
                    value={formData.trainingMode} 
                    onValueChange={(value) => {
                      setFormData({ ...formData, trainingMode: value });
                      setTouched(prev => ({ ...prev, trainingMode: true }));
                    }}
                  >
                    <SelectTrigger className={touched.trainingMode && errors.trainingMode ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fulltime">Full-time</SelectItem>
                      <SelectItem value="bdl">BDL (Block Day Learning)</SelectItem>
                      <SelectItem value="shortcourse">Short Course</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormFieldError error={touched.trainingMode ? errors.trainingMode : undefined} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="level">Training Level *</Label>
                  <Select 
                    value={formData.level} 
                    onValueChange={(value) => {
                      setFormData({ ...formData, level: value });
                      setTouched(prev => ({ ...prev, level: true }));
                    }}
                  >
                    <SelectTrigger className={touched.level && errors.level ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Level 1</SelectItem>
                      <SelectItem value="2">Level 2</SelectItem>
                      <SelectItem value="3">Level 3</SelectItem>
                      <SelectItem value="4">Level 4</SelectItem>
                      <SelectItem value="5">Level 5</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormFieldError error={touched.level ? errors.level : undefined} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="academicYear">Academic Year</Label>
                  <Input
                    id="academicYear"
                    value={formData.academicYear}
                    disabled
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-4 justify-end mt-6">
            <Button type="button" variant="outline" onClick={() => navigate("/trainees")} className="w-full sm:w-auto">Cancel</Button>
            <Button type="submit" disabled={registerTrainee.isPending} className="w-full sm:w-auto">
              {registerTrainee.isPending ? "Registering..." : "Register Trainee"}
            </Button>
          </div>
        </form>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default TraineeRegistration;
