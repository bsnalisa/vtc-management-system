import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Phone, GraduationCap, Briefcase, Heart, Shield, FileText, CheckCircle, Camera, Home, ChevronLeft, ChevronRight } from "lucide-react";
import { useTrades } from "@/hooks/useTrades";
import { useNamibiaRegions } from "@/hooks/useNamibiaRegions";
import { useCalculatePoints } from "@/hooks/useEntryRequirements";
import { useQualificationCheck } from "@/hooks/useQualificationCheck";
import { useAutoSaveDraft } from "@/hooks/useApplicationDraft";
import { SubjectEntry } from "./SubjectEntry";
import { QualificationIndicator } from "./QualificationIndicator";
import { DocumentUpload, MultipleDocumentUpload } from "./DocumentUpload";
import { AutoSaveIndicator } from "./AutoSaveIndicator";
import { 
  ComprehensiveApplicationData, 
  SchoolSubject, 
  TITLES, 
  MARITAL_STATUSES, 
  ICT_ACCESS_OPTIONS,
  CLOTHING_SIZES,
  SHOE_SIZES 
} from "@/types/application";

interface ComprehensiveApplicationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ComprehensiveApplicationData) => Promise<void>;
  isSubmitting?: boolean;
  initialData?: ComprehensiveApplicationData;
  initialTab?: string;
  draftId?: string;
  onDraftDeleted?: () => void;
}

const initialFormData: ComprehensiveApplicationData = {
  title: "",
  first_name: "",
  last_name: "",
  date_of_birth: "",
  gender: "male",
  national_id: "",
  phone: "",
  nationality: "Namibian",
  marital_status: "",
  address: "",
  region: "",
  postal_address: "",
  email: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  emergency_contact_relationship: "",
  emergency_contact_region: "",
  emergency_contact_email: "",
  emergency_contact_town: "",
  trade_id: "",
  trade_id_choice2: "",
  preferred_training_mode: "fulltime",
  preferred_level: 1,
  intake: "january",
  academic_year: new Date().getFullYear().toString(),
  highest_grade_passed: 12,
  school_subjects: [],
  needs_financial_assistance: false,
  needs_hostel_accommodation: false,
  has_disability: false,
  has_special_needs: false,
  has_chronic_diseases: false,
  ict_access: [],
  declaration_accepted: false,
};

const TAB_ORDER = ["personal", "emergency", "training", "education", "employment", "assistance", "health", "ppe", "declaration"];

export const ComprehensiveApplicationForm = ({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  initialData,
  initialTab,
  draftId,
  onDraftDeleted,
}: ComprehensiveApplicationFormProps) => {
  const [formData, setFormData] = useState<ComprehensiveApplicationData>(initialData || initialFormData);
  const [activeTab, setActiveTab] = useState(initialTab || "personal");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [currentDraftId, setCurrentDraftId] = useState<string | undefined>(draftId);

  const { data: trades } = useTrades();
  const { data: regions } = useNamibiaRegions();
  const { calculatePoints } = useCalculatePoints();

  // Auto-save functionality
  const { isSaving, lastSaved, saveNow } = useAutoSaveDraft(
    formData,
    activeTab,
    currentDraftId,
    open // Only save when dialog is open
  );

  const calculatedPoints = calculatePoints(formData.school_subjects);

  // Auto-qualification check
  const qualificationResult = useQualificationCheck({
    tradeId: formData.trade_id,
    level: formData.preferred_level,
    subjects: formData.school_subjects,
    dateOfBirth: formData.date_of_birth,
    highestGradePassed: formData.highest_grade_passed,
    hasWorkExperience: !!formData.employer_name,
    yearsOfExperience: formData.employer_duration ? parseInt(formData.employer_duration) || 0 : 0,
  });

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open && initialData) {
      setFormData(initialData);
      setActiveTab(initialTab || "personal");
      setCurrentDraftId(draftId);
    } else if (!open) {
      // Reset when closing if no draft
      if (!draftId) {
        setFormData(initialFormData);
        setActiveTab("personal");
      }
    }
  }, [open, initialData, initialTab, draftId]);

  const updateField = <K extends keyof ComprehensiveApplicationData>(
    field: K,
    value: ComprehensiveApplicationData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const goToNextTab = () => {
    const currentIndex = TAB_ORDER.indexOf(activeTab);
    if (currentIndex < TAB_ORDER.length - 1) {
      setActiveTab(TAB_ORDER[currentIndex + 1]);
    }
  };

  const goToPrevTab = () => {
    const currentIndex = TAB_ORDER.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(TAB_ORDER[currentIndex - 1]);
    }
  };

  const toggleIctAccess = (option: string) => {
    const current = formData.ict_access;
    if (current.includes(option)) {
      updateField("ict_access", current.filter((o) => o !== option));
    } else {
      updateField("ict_access", [...current, option]);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Required personal fields
    if (!formData.first_name.trim()) errors.first_name = "First name is required";
    if (!formData.last_name.trim()) errors.last_name = "Last name is required";
    if (!formData.date_of_birth) errors.date_of_birth = "Date of birth is required";
    if (!formData.national_id.trim()) errors.national_id = "National ID is required";
    if (!formData.phone.trim()) errors.phone = "Phone number is required";
    if (!formData.address.trim()) errors.address = "Address is required";
    if (!formData.region) errors.region = "Region is required";

    // Emergency contact
    if (!formData.emergency_contact_name.trim()) errors.emergency_contact_name = "Emergency contact name is required";
    if (!formData.emergency_contact_phone.trim()) errors.emergency_contact_phone = "Emergency contact phone is required";
    if (!formData.emergency_contact_relationship.trim()) errors.emergency_contact_relationship = "Relationship is required";
    if (!formData.emergency_contact_town.trim()) errors.emergency_contact_town = "Town/Village is required";

    // Training details
    if (!formData.trade_id) errors.trade_id = "Trade selection is required";

    // Declaration
    if (!formData.declaration_accepted) errors.declaration_accepted = "You must accept the declaration";

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      // Find first tab with error
      if (validationErrors.first_name || validationErrors.last_name || validationErrors.date_of_birth || validationErrors.national_id || validationErrors.phone || validationErrors.address || validationErrors.region) {
        setActiveTab("personal");
      } else if (validationErrors.emergency_contact_name || validationErrors.emergency_contact_phone || validationErrors.emergency_contact_relationship || validationErrors.emergency_contact_town) {
        setActiveTab("emergency");
      } else if (validationErrors.trade_id) {
        setActiveTab("training");
      } else if (validationErrors.declaration_accepted) {
        setActiveTab("declaration");
      }
      return;
    }

    try {
      await onSubmit(formData);
      setFormData(initialFormData);
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in parent
    }
  };

  const calculateAge = (dob: string): number => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(formData.date_of_birth);

  const handleClose = () => {
    saveNow(); // Save before closing
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-5xl max-h-[95vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-0 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-lg sm:text-xl">Trainee Application Form</DialogTitle>
            <AutoSaveIndicator isSaving={isSaving} lastSaved={lastSaved} />
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="px-3 sm:px-6 border-b shrink-0">
              <div className="w-full overflow-x-auto">
                <TabsList className="w-full justify-start flex-nowrap h-auto py-2 bg-transparent gap-0.5 sm:gap-1 min-w-max">
                  <TabsTrigger value="personal" className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <User className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="hidden xs:inline">Personal</span>
                  </TabsTrigger>
                  <TabsTrigger value="emergency" className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Phone className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="hidden xs:inline">Emergency</span>
                  </TabsTrigger>
                  <TabsTrigger value="training" className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <GraduationCap className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="hidden xs:inline">Training</span>
                  </TabsTrigger>
                  <TabsTrigger value="education" className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="hidden sm:inline">Education</span>
                  </TabsTrigger>
                  <TabsTrigger value="employment" className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Briefcase className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="hidden sm:inline">Employment</span>
                  </TabsTrigger>
                  <TabsTrigger value="assistance" className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Home className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="hidden sm:inline">Assistance</span>
                  </TabsTrigger>
                  <TabsTrigger value="health" className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Heart className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="hidden sm:inline">Health</span>
                  </TabsTrigger>
                  <TabsTrigger value="ppe" className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Shield className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="hidden sm:inline">PPE</span>
                  </TabsTrigger>
                  <TabsTrigger value="declaration" className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <CheckCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="hidden sm:inline">Declaration</span>
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 pb-4">
              {/* PERSONAL INFORMATION */}
              <TabsContent value="personal" className="mt-4 space-y-6 data-[state=inactive]:hidden">
                <Card>
                  <CardHeader>
                    <CardTitle>A. Applicant Photo</CardTitle>
                    <CardDescription>Upload a passport-sized photo</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="w-32 h-40 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted">
                        <Camera className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div className="space-y-2">
                        <Button type="button" variant="outline" size="sm">
                          Upload Photo
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Passport photo required. Max 2MB, JPG/PNG format.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>B. Applicant's Particulars</CardTitle>
                    <CardDescription>Personal information of the applicant</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Select value={formData.title || ""} onValueChange={(v) => updateField("title", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select title" />
                          </SelectTrigger>
                          <SelectContent>
                            {TITLES.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Surname *</Label>
                        <Input
                          value={formData.last_name}
                          onChange={(e) => updateField("last_name", e.target.value)}
                          className={validationErrors.last_name ? "border-destructive" : ""}
                        />
                        {validationErrors.last_name && (
                          <p className="text-xs text-destructive">{validationErrors.last_name}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>First Name(s) *</Label>
                        <Input
                          value={formData.first_name}
                          onChange={(e) => updateField("first_name", e.target.value)}
                          className={validationErrors.first_name ? "border-destructive" : ""}
                        />
                        {validationErrors.first_name && (
                          <p className="text-xs text-destructive">{validationErrors.first_name}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Date of Birth *</Label>
                        <Input
                          type="date"
                          value={formData.date_of_birth}
                          onChange={(e) => updateField("date_of_birth", e.target.value)}
                          className={validationErrors.date_of_birth ? "border-destructive" : ""}
                        />
                        {age > 0 && (
                          <p className="text-xs text-muted-foreground">Age: {age} years</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Gender *</Label>
                        <Select value={formData.gender} onValueChange={(v) => updateField("gender", v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Identity Number *</Label>
                        <Input
                          value={formData.national_id}
                          onChange={(e) => updateField("national_id", e.target.value)}
                          className={validationErrors.national_id ? "border-destructive" : ""}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Contact Number *</Label>
                        <Input
                          value={formData.phone}
                          onChange={(e) => updateField("phone", e.target.value)}
                          className={validationErrors.phone ? "border-destructive" : ""}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Nationality *</Label>
                        <Input
                          value={formData.nationality}
                          onChange={(e) => updateField("nationality", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Marital Status</Label>
                        <Select value={formData.marital_status || ""} onValueChange={(v) => updateField("marital_status", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            {MARITAL_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Region *</Label>
                        <Select value={formData.region} onValueChange={(v) => updateField("region", v)}>
                          <SelectTrigger className={validationErrors.region ? "border-destructive" : ""}>
                            <SelectValue placeholder="Select region" />
                          </SelectTrigger>
                          <SelectContent>
                            {regions?.map((r) => (
                              <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Residential Address *</Label>
                      <Textarea
                        value={formData.address}
                        onChange={(e) => updateField("address", e.target.value)}
                        className={validationErrors.address ? "border-destructive" : ""}
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Postal Address</Label>
                        <Textarea
                          value={formData.postal_address || ""}
                          onChange={(e) => updateField("postal_address", e.target.value)}
                          rows={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email Address</Label>
                        <Input
                          type="email"
                          value={formData.email || ""}
                          onChange={(e) => updateField("email", e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* EMERGENCY CONTACT */}
              <TabsContent value="emergency" className="mt-4 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>C. Emergency Contact / Legal Guardian</CardTitle>
                    <CardDescription>Contact person in case of emergency</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Full Name *</Label>
                        <Input
                          value={formData.emergency_contact_name}
                          onChange={(e) => updateField("emergency_contact_name", e.target.value)}
                          className={validationErrors.emergency_contact_name ? "border-destructive" : ""}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cell Number *</Label>
                        <Input
                          value={formData.emergency_contact_phone}
                          onChange={(e) => updateField("emergency_contact_phone", e.target.value)}
                          className={validationErrors.emergency_contact_phone ? "border-destructive" : ""}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Relationship *</Label>
                        <Select 
                          value={formData.emergency_contact_relationship} 
                          onValueChange={(v) => updateField("emergency_contact_relationship", v)}
                        >
                          <SelectTrigger className={validationErrors.emergency_contact_relationship ? "border-destructive" : ""}>
                            <SelectValue placeholder="Select relationship" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Parent">Parent</SelectItem>
                            <SelectItem value="Guardian">Guardian</SelectItem>
                            <SelectItem value="Spouse">Spouse</SelectItem>
                            <SelectItem value="Sibling">Sibling</SelectItem>
                            <SelectItem value="Relative">Relative</SelectItem>
                            <SelectItem value="Friend">Friend</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Region</Label>
                        <Select value={formData.emergency_contact_region || ""} onValueChange={(v) => updateField("emergency_contact_region", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select region" />
                          </SelectTrigger>
                          <SelectContent>
                            {regions?.map((r) => (
                              <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Town/Village *</Label>
                        <Input
                          value={formData.emergency_contact_town}
                          onChange={(e) => updateField("emergency_contact_town", e.target.value)}
                          className={validationErrors.emergency_contact_town ? "border-destructive" : ""}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={formData.emergency_contact_email || ""}
                        onChange={(e) => updateField("emergency_contact_email", e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TRAINING DETAILS */}
              <TabsContent value="training" className="mt-4 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>D. Training Details</CardTitle>
                    <CardDescription>Select your preferred trade and training options</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Choice 1 - Trade *</Label>
                        <Select value={formData.trade_id} onValueChange={(v) => updateField("trade_id", v)}>
                          <SelectTrigger className={validationErrors.trade_id ? "border-destructive" : ""}>
                            <SelectValue placeholder="Select trade" />
                          </SelectTrigger>
                          <SelectContent>
                            {trades?.map((trade) => (
                              <SelectItem key={trade.id} value={trade.id}>
                                {trade.name} ({trade.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Choice 2 - Trade (Alternative)</Label>
                        <Select 
                          value={formData.trade_id_choice2 || "none"} 
                          onValueChange={(v) => updateField("trade_id_choice2", v === "none" ? "" : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select alternative trade" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No alternative</SelectItem>
                            {trades?.filter(t => t.id !== formData.trade_id).map((trade) => (
                              <SelectItem key={trade.id} value={trade.id}>
                                {trade.name} ({trade.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Training Mode *</Label>
                        <Select value={formData.preferred_training_mode} onValueChange={(v) => updateField("preferred_training_mode", v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fulltime">Full Time</SelectItem>
                            <SelectItem value="bdl">Part Time / BDL</SelectItem>
                            <SelectItem value="shortcourse">Short Course</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Level *</Label>
                        <Select value={formData.preferred_level.toString()} onValueChange={(v) => updateField("preferred_level", parseInt(v))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Level 1</SelectItem>
                            <SelectItem value="2">Level 2</SelectItem>
                            <SelectItem value="3">Level 3</SelectItem>
                            <SelectItem value="4">Level 4</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Intake *</Label>
                        <Select value={formData.intake} onValueChange={(v) => updateField("intake", v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="january">January</SelectItem>
                            <SelectItem value="july">July</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Academic Year *</Label>
                        <Input
                          value={formData.academic_year}
                          onChange={(e) => updateField("academic_year", e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <QualificationIndicator 
                  result={formData.trade_id ? qualificationResult : null}
                  calculatedPoints={calculatedPoints} 
                />
              </TabsContent>

              {/* EDUCATION */}
              <TabsContent value="education" className="mt-4 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>E. Educational History (Tertiary)</CardTitle>
                    <CardDescription>Previous tertiary education if any</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Institution</Label>
                        <Input
                          value={formData.tertiary_institution || ""}
                          onChange={(e) => updateField("tertiary_institution", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Region</Label>
                        <Select value={formData.tertiary_region || ""} onValueChange={(v) => updateField("tertiary_region", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select region" />
                          </SelectTrigger>
                          <SelectContent>
                            {regions?.map((r) => (
                              <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2 md:col-span-2">
                        <Label>Address</Label>
                        <Input
                          value={formData.tertiary_address || ""}
                          onChange={(e) => updateField("tertiary_address", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          value={formData.tertiary_phone || ""}
                          onChange={(e) => updateField("tertiary_phone", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Year of Exam</Label>
                        <Input
                          type="number"
                          value={formData.tertiary_exam_year || ""}
                          onChange={(e) => updateField("tertiary_exam_year", parseInt(e.target.value) || undefined)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>F. Educational History (High School)</CardTitle>
                    <CardDescription>Secondary school qualifications</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Highest Grade Passed *</Label>
                      <Select 
                        value={formData.highest_grade_passed?.toString() || ""} 
                        onValueChange={(v) => updateField("highest_grade_passed", parseInt(v))}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select grade" />
                        </SelectTrigger>
                        <SelectContent>
                          {[10, 11, 12].map((g) => (
                            <SelectItem key={g} value={g.toString()}>Grade {g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <SubjectEntry
                      subjects={formData.school_subjects}
                      onSubjectsChange={(subjects) => updateField("school_subjects", subjects)}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* EMPLOYMENT */}
              <TabsContent value="employment" className="mt-4 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>G. Employment Information</CardTitle>
                    <CardDescription>Current or previous employment (if applicable)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Employer Name</Label>
                        <Input
                          value={formData.employer_name || ""}
                          onChange={(e) => updateField("employer_name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Position Held</Label>
                        <Input
                          value={formData.employer_position || ""}
                          onChange={(e) => updateField("employer_position", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2 md:col-span-2">
                        <Label>Employer Address</Label>
                        <Input
                          value={formData.employer_address || ""}
                          onChange={(e) => updateField("employer_address", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Duration</Label>
                        <Input
                          value={formData.employer_duration || ""}
                          onChange={(e) => updateField("employer_duration", e.target.value)}
                          placeholder="e.g., 2 years"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          value={formData.employer_phone || ""}
                          onChange={(e) => updateField("employer_phone", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Town</Label>
                        <Input
                          value={formData.employer_town || ""}
                          onChange={(e) => updateField("employer_town", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Region</Label>
                        <Select value={formData.employer_region || ""} onValueChange={(v) => updateField("employer_region", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select region" />
                          </SelectTrigger>
                          <SelectContent>
                            {regions?.map((r) => (
                              <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={formData.employer_email || ""}
                          onChange={(e) => updateField("employer_email", e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ASSISTANCE */}
              <TabsContent value="assistance" className="mt-4 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>H. Financial Assistance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="financial_assistance"
                        checked={formData.needs_financial_assistance}
                        onCheckedChange={(checked) => updateField("needs_financial_assistance", !!checked)}
                      />
                      <Label htmlFor="financial_assistance" className="cursor-pointer">
                        Do you need financial assistance?
                      </Label>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>I. Hostel Accommodation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="hostel"
                        checked={formData.needs_hostel_accommodation}
                        onCheckedChange={(checked) => updateField("needs_hostel_accommodation", !!checked)}
                      />
                      <Label htmlFor="hostel" className="cursor-pointer">
                        Do you need hostel accommodation?
                      </Label>
                    </div>

                    {formData.needs_hostel_accommodation && (
                      <Alert>
                        <AlertDescription>
                          A separate hostel application form will be required. Please submit this application first, then complete the hostel application.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>L. ICT Access</CardTitle>
                    <CardDescription>Select all that apply</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-4">
                      {ICT_ACCESS_OPTIONS.map((option) => (
                        <div key={option} className="flex items-center space-x-2">
                          <Checkbox
                            id={`ict_${option}`}
                            checked={formData.ict_access.includes(option)}
                            onCheckedChange={() => toggleIctAccess(option)}
                          />
                          <Label htmlFor={`ict_${option}`} className="cursor-pointer">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* HEALTH */}
              <TabsContent value="health" className="mt-4 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>J. Health Particulars</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="disability"
                          checked={formData.has_disability}
                          onCheckedChange={(checked) => updateField("has_disability", !!checked)}
                        />
                        <Label htmlFor="disability" className="cursor-pointer">
                          Do you have any disability?
                        </Label>
                      </div>
                      {formData.has_disability && (
                        <div className="ml-6 space-y-2">
                          <Label>Nature of disability</Label>
                          <Textarea
                            value={formData.disability_description || ""}
                            onChange={(e) => updateField("disability_description", e.target.value)}
                            placeholder="Please describe your disability..."
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="special_needs"
                          checked={formData.has_special_needs}
                          onCheckedChange={(checked) => updateField("has_special_needs", !!checked)}
                        />
                        <Label htmlFor="special_needs" className="cursor-pointer">
                          Do you have any special needs?
                        </Label>
                      </div>
                      {formData.has_special_needs && (
                        <div className="ml-6 space-y-2">
                          <Label>Specify special needs</Label>
                          <Textarea
                            value={formData.special_needs_description || ""}
                            onChange={(e) => updateField("special_needs_description", e.target.value)}
                            placeholder="Please specify your special needs..."
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="chronic"
                          checked={formData.has_chronic_diseases}
                          onCheckedChange={(checked) => updateField("has_chronic_diseases", !!checked)}
                        />
                        <Label htmlFor="chronic" className="cursor-pointer">
                          Do you have any chronic diseases?
                        </Label>
                      </div>
                      {formData.has_chronic_diseases && (
                        <div className="ml-6 space-y-2">
                          <Label>Specify chronic diseases</Label>
                          <Textarea
                            value={formData.chronic_diseases_description || ""}
                            onChange={(e) => updateField("chronic_diseases_description", e.target.value)}
                            placeholder="Please specify chronic diseases..."
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* PPE */}
              <TabsContent value="ppe" className="mt-4 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>K. Personal Protective Equipment (PPE) Sizes</CardTitle>
                    <CardDescription>Provide your clothing sizes for PPE allocation</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Shoe Size</Label>
                        <Select value={formData.shoe_size || ""} onValueChange={(v) => updateField("shoe_size", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                          <SelectContent>
                            {SHOE_SIZES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Overall Size</Label>
                        <Select value={formData.overall_size || ""} onValueChange={(v) => updateField("overall_size", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                          <SelectContent>
                            {CLOTHING_SIZES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>T-shirt Size</Label>
                        <Select value={formData.tshirt_size || ""} onValueChange={(v) => updateField("tshirt_size", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                          <SelectContent>
                            {CLOTHING_SIZES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Skirt/Trousers Size</Label>
                        <Select value={formData.skirt_trousers_size || ""} onValueChange={(v) => updateField("skirt_trousers_size", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                          <SelectContent>
                            {CLOTHING_SIZES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Chef Trouser Size</Label>
                        <Select value={formData.chef_trouser_size || ""} onValueChange={(v) => updateField("chef_trouser_size", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                          <SelectContent>
                            {CLOTHING_SIZES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Chef Jacket Size</Label>
                        <Select value={formData.chef_jacket_size || ""} onValueChange={(v) => updateField("chef_jacket_size", v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                          <SelectContent>
                            {CLOTHING_SIZES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* DECLARATION */}
              <TabsContent value="declaration" className="mt-4 space-y-6 pb-6">
                <Card>
                  <CardHeader>
                    <CardTitle>M. Supporting Documents</CardTitle>
                    <CardDescription>Upload required documents (PDF, JPG, PNG - Max 5MB each)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <DocumentUpload
                        label="Certified Copy of ID / Birth Certificate"
                        description="Full birth certificate or certified ID copy"
                        required
                        currentPath={formData.id_document_path}
                        onUpload={(path) => updateField("id_document_path", path)}
                        folder="applications/id-documents"
                      />
                      <DocumentUpload
                        label="School Leaving Certificate"
                        description="Official school leaving certificate"
                        required
                        currentPath={formData.school_leaving_cert_path}
                        onUpload={(path) => updateField("school_leaving_cert_path", path)}
                        folder="applications/certificates"
                      />
                      <DocumentUpload
                        label="Academic Qualifications / Statement of Results"
                        description="NSSCO/NSSCH/IGCSE results"
                        required
                        currentPath={formData.academic_qualifications_path}
                        onUpload={(path) => updateField("academic_qualifications_path", path)}
                        folder="applications/qualifications"
                      />
                      <MultipleDocumentUpload
                        label="Additional Supporting Documents"
                        description="Any other relevant documents"
                        currentPaths={formData.additional_documents_paths || []}
                        onUpload={(paths) => updateField("additional_documents_paths", paths)}
                        maxFiles={5}
                        folder="applications/additional"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className={validationErrors.declaration_accepted ? "border-destructive" : ""}>
                  <CardHeader>
                    <CardTitle>N. Declaration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="declaration"
                        checked={formData.declaration_accepted}
                        onCheckedChange={(checked) => updateField("declaration_accepted", !!checked)}
                        className="mt-1"
                      />
                      <Label htmlFor="declaration" className="cursor-pointer leading-relaxed">
                        I hereby confirm that all the information provided is correct and all the attached 
                        supporting documents are authentic. Any false information will result in disqualification.
                      </Label>
                    </div>
                    {validationErrors.declaration_accepted && (
                      <p className="text-sm text-destructive mt-2">{validationErrors.declaration_accepted}</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>

          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 px-3 sm:px-6 py-3 sm:py-4 border-t bg-background">
            <Button type="button" variant="outline" onClick={handleClose} className="order-3 sm:order-1">
              Save & Close
            </Button>
            <div className="flex gap-2 order-1 sm:order-2">
              <Button
                type="button"
                variant="outline"
                onClick={goToPrevTab}
                disabled={activeTab === TAB_ORDER[0]}
                className="flex-1 sm:flex-none"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
              {activeTab !== TAB_ORDER[TAB_ORDER.length - 1] ? (
                <Button
                  type="button"
                  onClick={goToNextTab}
                  className="flex-1 sm:flex-none"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none"
                >
                  {isSubmitting ? "Submitting..." : "Submit"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
