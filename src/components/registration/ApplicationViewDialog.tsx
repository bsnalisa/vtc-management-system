import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Download, User, Phone, GraduationCap, Briefcase, Heart, Shield, FileText, Home } from "lucide-react";
import { EXAM_LEVELS } from "@/types/application";

interface ApplicationViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: any;
}

const Field = ({ label, value }: { label: string; value: any }) => {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}</p>
    </div>
  );
};

const SectionCard = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
  <Card>
    <CardHeader className="p-4 pb-2">
      <CardTitle className="text-sm flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="p-4 pt-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </CardContent>
  </Card>
);

const getExamLevelLabel = (value: string) => {
  return EXAM_LEVELS.find((l) => l.value === value)?.label || value;
};

export const ApplicationViewDialog = ({ open, onOpenChange, application }: ApplicationViewDialogProps) => {
  if (!application) return null;

  const subjects: any[] = Array.isArray(application.school_subjects) ? application.school_subjects : [];
  const ictAccess: string[] = Array.isArray(application.ict_access) ? application.ict_access : [];
  const additionalDocs: string[] = Array.isArray(application.additional_documents_paths) ? application.additional_documents_paths : [];

  const handleDownloadPDF = () => {
    // Build a printable view
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const tradeName = application.trades?.name || "N/A";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>Application - ${application.application_number}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; color: #333; }
        h1 { font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 8px; }
        h2 { font-size: 14px; margin-top: 20px; color: #555; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
        .field { margin-bottom: 6px; }
        .field .label { font-weight: bold; display: inline-block; min-width: 180px; }
        table { border-collapse: collapse; width: 100%; margin-top: 8px; }
        th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; font-size: 11px; }
        th { background: #f0f0f0; }
        .status { padding: 2px 8px; border-radius: 4px; font-weight: bold; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>Trainee Application Form</h1>
      <div class="field"><span class="label">Application Number:</span> ${application.application_number || ""}</div>
      <div class="field"><span class="label">Trainee Number:</span> ${application.trainee_number || "N/A"}</div>
      <div class="field"><span class="label">Date Applied:</span> ${application.created_at ? new Date(application.created_at).toLocaleDateString() : ""}</div>

      <h2>A. Applicant's Particulars</h2>
      <div class="field"><span class="label">Title:</span> ${application.title || ""}</div>
      <div class="field"><span class="label">Full Name:</span> ${application.first_name} ${application.last_name}</div>
      <div class="field"><span class="label">Gender:</span> ${application.gender || ""}</div>
      <div class="field"><span class="label">Date of Birth:</span> ${application.date_of_birth || ""}</div>
      <div class="field"><span class="label">National ID:</span> ${application.national_id || ""}</div>
      <div class="field"><span class="label">Phone:</span> ${application.phone || ""}</div>
      <div class="field"><span class="label">Email:</span> ${application.email || ""}</div>
      <div class="field"><span class="label">Nationality:</span> ${application.nationality || ""}</div>
      <div class="field"><span class="label">Marital Status:</span> ${application.marital_status || ""}</div>
      <div class="field"><span class="label">Address:</span> ${application.address || ""}</div>
      <div class="field"><span class="label">Region:</span> ${application.region || ""}</div>
      <div class="field"><span class="label">Postal Address:</span> ${application.postal_address || ""}</div>

      <h2>B. Emergency Contact</h2>
      <div class="field"><span class="label">Name:</span> ${application.emergency_contact_name || ""}</div>
      <div class="field"><span class="label">Phone:</span> ${application.emergency_contact_phone || ""}</div>
      <div class="field"><span class="label">Relationship:</span> ${application.emergency_contact_relationship || ""}</div>
      <div class="field"><span class="label">Town:</span> ${application.emergency_contact_town || ""}</div>
      <div class="field"><span class="label">Region:</span> ${application.emergency_contact_region || ""}</div>
      <div class="field"><span class="label">Email:</span> ${application.emergency_contact_email || ""}</div>

      <h2>C. Training Details</h2>
      <div class="field"><span class="label">Trade (1st Choice):</span> ${tradeName}</div>
      <div class="field"><span class="label">Training Mode:</span> ${application.preferred_training_mode || ""}</div>
      <div class="field"><span class="label">Level:</span> ${application.preferred_level || ""}</div>
      <div class="field"><span class="label">Intake:</span> ${application.intake || ""} ${application.academic_year || ""}</div>

      <h2>D. Educational History</h2>
      <div class="field"><span class="label">Highest Grade Passed:</span> ${application.highest_grade_passed || ""}</div>
      <div class="field"><span class="label">Calculated Points:</span> ${application.calculated_points ?? "N/A"}</div>
      ${application.tertiary_institution ? `
        <div class="field"><span class="label">Tertiary Institution:</span> ${application.tertiary_institution}</div>
        <div class="field"><span class="label">Tertiary Region:</span> ${application.tertiary_region || ""}</div>
        <div class="field"><span class="label">Exam Year:</span> ${application.tertiary_exam_year || ""}</div>
      ` : ""}
      ${subjects.length > 0 ? `
        <table><tr><th>Subject</th><th>Exam Level</th><th>Symbol</th><th>Points</th></tr>
        ${subjects.map((s: any) => `<tr><td>${s.subject_name || ""}</td><td>${s.exam_level || ""}</td><td>${s.symbol || ""}</td><td>${s.points ?? ""}</td></tr>`).join("")}
        </table>
      ` : ""}

      <h2>E. Employment Information</h2>
      ${application.employer_name ? `
        <div class="field"><span class="label">Employer:</span> ${application.employer_name}</div>
        <div class="field"><span class="label">Position:</span> ${application.employer_position || ""}</div>
        <div class="field"><span class="label">Duration:</span> ${application.employer_duration || ""}</div>
        <div class="field"><span class="label">Address:</span> ${application.employer_address || ""}</div>
        <div class="field"><span class="label">Town:</span> ${application.employer_town || ""}</div>
        <div class="field"><span class="label">Phone:</span> ${application.employer_phone || ""}</div>
      ` : "<p>No employment information provided.</p>"}

      <h2>F. Financial Assistance & Hostel</h2>
      <div class="field"><span class="label">Needs Financial Assistance:</span> ${application.needs_financial_assistance ? "Yes" : "No"}</div>
      <div class="field"><span class="label">Needs Hostel Accommodation:</span> ${application.needs_hostel_accommodation ? "Yes" : "No"}</div>

      <h2>G. Health Particulars</h2>
      <div class="field"><span class="label">Has Disability:</span> ${application.has_disability ? "Yes" : "No"}</div>
      ${application.disability_description ? `<div class="field"><span class="label">Disability Details:</span> ${application.disability_description}</div>` : ""}
      <div class="field"><span class="label">Has Special Needs:</span> ${application.has_special_needs ? "Yes" : "No"}</div>
      ${application.special_needs_description ? `<div class="field"><span class="label">Special Needs Details:</span> ${application.special_needs_description}</div>` : ""}
      <div class="field"><span class="label">Has Chronic Diseases:</span> ${application.has_chronic_diseases ? "Yes" : "No"}</div>
      ${application.chronic_diseases_description ? `<div class="field"><span class="label">Chronic Disease Details:</span> ${application.chronic_diseases_description}</div>` : ""}

      <h2>H. PPE Sizes</h2>
      <div class="field"><span class="label">Shoe Size:</span> ${application.shoe_size || "N/A"}</div>
      <div class="field"><span class="label">Overall Size:</span> ${application.overall_size || "N/A"}</div>
      <div class="field"><span class="label">T-Shirt Size:</span> ${application.tshirt_size || "N/A"}</div>

      <h2>I. ICT Access</h2>
      <div class="field">${ictAccess.length > 0 ? ictAccess.join(", ") : "None specified"}</div>

      <h2>J. Declaration</h2>
      <div class="field"><span class="label">Declaration Accepted:</span> ${application.declaration_accepted ? "Yes" : "No"}</div>

      <h2>K. Supporting Documents Attached</h2>
      <div class="field"><span class="label">ID Document:</span> ${application.id_document_path ? "Attached" : "Not attached"}</div>
      <div class="field"><span class="label">School Leaving Certificate:</span> ${application.school_leaving_cert_path ? "Attached" : "Not attached"}</div>
      <div class="field"><span class="label">Academic Qualifications:</span> ${application.academic_qualifications_path ? "Attached" : "Not attached"}</div>
      ${additionalDocs.length > 0 ? `<div class="field"><span class="label">Additional Documents:</span> ${additionalDocs.length} document(s) attached</div>` : ""}

      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">
              Application: {application.application_number}
            </DialogTitle>
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="mr-6">
              <Download className="h-4 w-4 mr-1" />
              Download PDF
            </Button>
          </div>
          <div className="flex gap-2 mt-1">
            <Badge variant="secondary">{application.first_name} {application.last_name}</Badge>
            {application.trainee_number && <Badge variant="outline">{application.trainee_number}</Badge>}
          </div>
        </DialogHeader>

        <Tabs defaultValue="personal" className="mt-2">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="personal" className="text-xs">Personal</TabsTrigger>
            <TabsTrigger value="emergency" className="text-xs">Emergency</TabsTrigger>
            <TabsTrigger value="training" className="text-xs">Training</TabsTrigger>
            <TabsTrigger value="education" className="text-xs">Education</TabsTrigger>
            <TabsTrigger value="employment" className="text-xs">Employment</TabsTrigger>
            <TabsTrigger value="assistance" className="text-xs">Assistance</TabsTrigger>
            <TabsTrigger value="health" className="text-xs">Health</TabsTrigger>
            <TabsTrigger value="ppe" className="text-xs">PPE</TabsTrigger>
            <TabsTrigger value="documents" className="text-xs">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-3 mt-3">
            <SectionCard title="Applicant's Particulars" icon={User}>
              <Field label="Title" value={application.title} />
              <Field label="First Name" value={application.first_name} />
              <Field label="Last Name" value={application.last_name} />
              <Field label="Gender" value={application.gender} />
              <Field label="Date of Birth" value={application.date_of_birth} />
              <Field label="National ID" value={application.national_id} />
              <Field label="Phone" value={application.phone} />
              <Field label="Email" value={application.email} />
              <Field label="Nationality" value={application.nationality} />
              <Field label="Marital Status" value={application.marital_status} />
              <Field label="Address" value={application.address} />
              <Field label="Region" value={application.region} />
              <Field label="Postal Address" value={application.postal_address} />
            </SectionCard>
          </TabsContent>

          <TabsContent value="emergency" className="space-y-3 mt-3">
            <SectionCard title="Emergency Contact" icon={Phone}>
              <Field label="Contact Name" value={application.emergency_contact_name} />
              <Field label="Phone" value={application.emergency_contact_phone} />
              <Field label="Relationship" value={application.emergency_contact_relationship} />
              <Field label="Town" value={application.emergency_contact_town} />
              <Field label="Region" value={application.emergency_contact_region} />
              <Field label="Email" value={application.emergency_contact_email} />
            </SectionCard>
          </TabsContent>

          <TabsContent value="training" className="space-y-3 mt-3">
            <SectionCard title="Training Details" icon={GraduationCap}>
              <Field label="Trade (1st Choice)" value={application.trades?.name} />
              <Field label="Training Mode" value={application.preferred_training_mode} />
              <Field label="Level" value={application.preferred_level} />
              <Field label="Intake" value={`${application.intake} ${application.academic_year}`} />
            </SectionCard>
          </TabsContent>

          <TabsContent value="education" className="space-y-3 mt-3">
            <SectionCard title="Educational History" icon={GraduationCap}>
              <Field label="Highest Grade Passed" value={application.highest_grade_passed} />
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Calculated Points</p>
                <p className="text-sm font-medium">{application.calculated_points ?? 0}</p>
              </div>
              <Field label="Tertiary Institution" value={application.tertiary_institution} />
              <Field label="Tertiary Region" value={application.tertiary_region} />
              <Field label="Tertiary Exam Year" value={application.tertiary_exam_year} />
            </SectionCard>
            {subjects.length > 0 && (
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm">School Subjects</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1.5 px-2 text-xs text-muted-foreground font-medium">Subject</th>
                          <th className="text-left py-1.5 px-2 text-xs text-muted-foreground font-medium">Exam Level</th>
                          <th className="text-left py-1.5 px-2 text-xs text-muted-foreground font-medium">Symbol</th>
                          <th className="text-left py-1.5 px-2 text-xs text-muted-foreground font-medium">Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjects.map((s: any, i: number) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-1.5 px-2">{s.subject_name}</td>
                            <td className="py-1.5 px-2">{getExamLevelLabel(s.exam_level)}</td>
                            <td className="py-1.5 px-2">{s.symbol}</td>
                            <td className="py-1.5 px-2">{s.points ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="employment" className="space-y-3 mt-3">
            <SectionCard title="Employment Information" icon={Briefcase}>
              {application.employer_name ? (
                <>
                  <Field label="Employer" value={application.employer_name} />
                  <Field label="Position" value={application.employer_position} />
                  <Field label="Duration" value={application.employer_duration} />
                  <Field label="Address" value={application.employer_address} />
                  <Field label="Town" value={application.employer_town} />
                  <Field label="Region" value={application.employer_region} />
                  <Field label="Phone" value={application.employer_phone} />
                  <Field label="Email" value={application.employer_email} />
                </>
              ) : (
                <p className="text-sm text-muted-foreground col-span-full">No employment information provided.</p>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="assistance" className="space-y-3 mt-3">
            <SectionCard title="Financial Assistance & Hostel" icon={Home}>
              <Field label="Needs Financial Assistance" value={application.needs_financial_assistance} />
              <Field label="Needs Hostel Accommodation" value={application.needs_hostel_accommodation} />
            </SectionCard>
          </TabsContent>

          <TabsContent value="health" className="space-y-3 mt-3">
            <SectionCard title="Health Particulars" icon={Heart}>
              <Field label="Has Disability" value={application.has_disability} />
              <Field label="Disability Description" value={application.disability_description} />
              <Field label="Has Special Needs" value={application.has_special_needs} />
              <Field label="Special Needs Description" value={application.special_needs_description} />
              <Field label="Has Chronic Diseases" value={application.has_chronic_diseases} />
              <Field label="Chronic Diseases Description" value={application.chronic_diseases_description} />
            </SectionCard>
          </TabsContent>

          <TabsContent value="ppe" className="space-y-3 mt-3">
            <SectionCard title="PPE Sizes & ICT Access" icon={Shield}>
              <Field label="Shoe Size" value={application.shoe_size} />
              <Field label="Overall Size" value={application.overall_size} />
              <Field label="T-Shirt Size" value={application.tshirt_size} />
              <Field label="Skirt/Trousers Size" value={application.skirt_trousers_size} />
              <Field label="Chef Trouser Size" value={application.chef_trouser_size} />
              <Field label="Chef Jacket Size" value={application.chef_jacket_size} />
              <Separator className="col-span-full" />
              <Field label="ICT Access" value={ictAccess.length > 0 ? ictAccess.join(", ") : "None specified"} />
            </SectionCard>
          </TabsContent>

          <TabsContent value="documents" className="space-y-3 mt-3">
            <SectionCard title="Supporting Documents & Declaration" icon={FileText}>
              <Field label="ID Document" value={application.id_document_path ? "Uploaded" : "Not uploaded"} />
              <Field label="School Leaving Certificate" value={application.school_leaving_cert_path ? "Uploaded" : "Not uploaded"} />
              <Field label="Academic Qualifications" value={application.academic_qualifications_path ? "Uploaded" : "Not uploaded"} />
              <Field label="Declaration Accepted" value={application.declaration_accepted} />
            </SectionCard>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
