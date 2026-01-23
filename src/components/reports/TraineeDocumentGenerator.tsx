import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Search, 
  FileText, 
  Printer, 
  Download, 
  User, 
  Loader2,
  GraduationCap,
  FileCheck,
  ScrollText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Trainee {
  id: string;
  trainee_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  national_id: string | null;
  gender: string | null;
  date_of_birth: string | null;
  level: number | null;
  training_mode: string | null;
  status: string | null;
  created_at: string | null;
  trade: { name: string } | null;
}

type DocumentType = "admission_letter" | "proof_of_registration" | "academic_record";

const documentTypes = [
  { 
    id: "admission_letter" as DocumentType, 
    label: "Admission Letter", 
    icon: ScrollText,
    description: "Official admission/acceptance letter"
  },
  { 
    id: "proof_of_registration" as DocumentType, 
    label: "Proof of Registration", 
    icon: FileCheck,
    description: "Certificate confirming enrollment status"
  },
  { 
    id: "academic_record" as DocumentType, 
    label: "Academic Record", 
    icon: GraduationCap,
    description: "Transcript with grades and assessments"
  },
];

export const TraineeDocumentGenerator = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Trainee[]>([]);
  const [selectedTrainee, setSelectedTrainee] = useState<Trainee | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<DocumentType | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { organizationId, organizationName, settings } = useOrganizationContext();
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!searchQuery.trim() || !organizationId) return;
    
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from("trainees")
        .select(`
          id,
          trainee_id,
          first_name,
          last_name,
          email,
          phone,
          national_id,
          gender,
          date_of_birth,
          level,
          training_mode,
          status,
          created_at,
          trade:trades(name)
        `)
        .eq("organization_id", organizationId)
        .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,trainee_id.ilike.%${searchQuery}%,national_id.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
      
      if (!data || data.length === 0) {
        toast({
          title: "No results",
          description: "No trainees found matching your search",
        });
      }
    } catch (error: any) {
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const generateDocument = async () => {
    if (!selectedTrainee || !selectedDocType) return;
    
    setIsGenerating(true);
    try {
      let documentContent = "";
      const today = format(new Date(), "MMMM d, yyyy");
      const traineeFullName = `${selectedTrainee.first_name} ${selectedTrainee.last_name}`;
      
      // Generate document based on type
      switch (selectedDocType) {
        case "admission_letter":
          documentContent = generateAdmissionLetter(selectedTrainee, today);
          break;
        case "proof_of_registration":
          documentContent = generateProofOfRegistration(selectedTrainee, today);
          break;
        case "academic_record":
          documentContent = await generateAcademicRecord(selectedTrainee, today);
          break;
      }

      // Create downloadable file
      const blob = new Blob([documentContent], { type: "text/plain;charset=utf-8" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      const filename = `${selectedDocType}_${selectedTrainee.trainee_id}_${format(new Date(), "yyyyMMdd")}.txt`;
      
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Document Generated",
        description: `${documentTypes.find(d => d.id === selectedDocType)?.label} for ${traineeFullName} has been downloaded`,
      });
    } catch (error: any) {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAdmissionLetter = (trainee: Trainee, date: string) => {
    return `
${organizationName?.toUpperCase() || "ORGANIZATION NAME"}
================================================================================

ADMISSION LETTER

Date: ${date}
Reference: ADM/${trainee.trainee_id}/${format(new Date(), "yyyy")}

Dear ${trainee.first_name} ${trainee.last_name},

RE: OFFER OF ADMISSION

We are pleased to inform you that you have been admitted to ${organizationName || "our institution"} 
for the ${new Date().getFullYear()} academic year.

ADMISSION DETAILS:
------------------
Trainee ID:      ${trainee.trainee_id}
Programme:       ${trainee.trade?.name || "N/A"}
Level:           ${trainee.level || "N/A"}
Training Mode:   ${trainee.training_mode || "N/A"}
Start Date:      ${trainee.created_at ? format(new Date(trainee.created_at), "MMMM d, yyyy") : "To be confirmed"}

Please report to the Registration Office with the following documents:
1. Original academic certificates
2. National ID or Birth Certificate
3. Two passport-sized photographs
4. Medical fitness certificate

Congratulations on your admission!

Yours faithfully,


_____________________________
Registration Officer
${organizationName || ""}

================================================================================
This is a computer-generated document.
    `.trim();
  };

  const generateProofOfRegistration = (trainee: Trainee, date: string) => {
    return `
${organizationName?.toUpperCase() || "ORGANIZATION NAME"}
================================================================================

PROOF OF REGISTRATION / ENROLLMENT CERTIFICATE

Date of Issue: ${date}
Certificate No: REG/${trainee.trainee_id}/${format(new Date(), "yyyyMMdd")}

TO WHOM IT MAY CONCERN

This is to certify that:

TRAINEE DETAILS:
----------------
Full Name:       ${trainee.first_name} ${trainee.last_name}
Trainee ID:      ${trainee.trainee_id}
National ID:     ${trainee.national_id || "N/A"}
Gender:          ${trainee.gender || "N/A"}
Date of Birth:   ${trainee.date_of_birth ? format(new Date(trainee.date_of_birth), "MMMM d, yyyy") : "N/A"}

ENROLLMENT DETAILS:
-------------------
Programme:       ${trainee.trade?.name || "N/A"}
Current Level:   ${trainee.level || "N/A"}
Training Mode:   ${trainee.training_mode || "N/A"}
Enrollment Date: ${trainee.created_at ? format(new Date(trainee.created_at), "MMMM d, yyyy") : "N/A"}
Status:          ${trainee.status?.toUpperCase() || "ACTIVE"}

is a bona fide student of ${organizationName || "this institution"} and is currently 
enrolled in the above-mentioned programme.

This certificate is issued upon request for official purposes.


_____________________________
Registration Officer
${organizationName || ""}

Official Stamp:



================================================================================
This document is valid for 3 months from the date of issue.
Verify authenticity at the Registration Office.
    `.trim();
  };

  const generateAcademicRecord = async (trainee: Trainee, date: string) => {
    // Fetch assessment results for the trainee
    const { data: assessments } = await supabase
      .from("assessment_results")
      .select(`
        assessment_date,
        marks_obtained,
        competency_status,
        unit_standard:unit_standards(title, code, credits)
      `)
      .eq("trainee_id", trainee.id)
      .order("assessment_date", { ascending: true });

    let resultsSection = "No assessment records found.";
    
    if (assessments && assessments.length > 0) {
      resultsSection = assessments.map((a, idx) => {
        const us = a.unit_standard as any;
        return `${idx + 1}. ${us?.code || "N/A"} - ${us?.title || "N/A"}
   Credits: ${us?.credits || "N/A"} | Marks: ${a.marks_obtained || "N/A"} | Status: ${a.competency_status || "N/A"}
   Date: ${a.assessment_date ? format(new Date(a.assessment_date), "MMM d, yyyy") : "N/A"}`;
      }).join("\n\n");
    }

    return `
${organizationName?.toUpperCase() || "ORGANIZATION NAME"}
================================================================================

ACADEMIC RECORD / TRANSCRIPT

Date of Issue: ${date}
Document No: TRANS/${trainee.trainee_id}/${format(new Date(), "yyyyMMdd")}

STUDENT INFORMATION:
--------------------
Full Name:       ${trainee.first_name} ${trainee.last_name}
Trainee ID:      ${trainee.trainee_id}
National ID:     ${trainee.national_id || "N/A"}
Programme:       ${trainee.trade?.name || "N/A"}
Current Level:   ${trainee.level || "N/A"}
Training Mode:   ${trainee.training_mode || "N/A"}
Enrollment Date: ${trainee.created_at ? format(new Date(trainee.created_at), "MMMM d, yyyy") : "N/A"}

ASSESSMENT RESULTS:
-------------------
${resultsSection}


================================================================================

SUMMARY:
--------
Total Assessments: ${assessments?.length || 0}
Competent Units:   ${assessments?.filter(a => a.competency_status === 'competent').length || 0}
Not Yet Competent: ${assessments?.filter(a => a.competency_status === 'not_yet_competent').length || 0}


_____________________________
Assessment Coordinator
${organizationName || ""}

_____________________________
Registration Officer
${organizationName || ""}

================================================================================
This is an official academic record. Any alterations render it invalid.
    `.trim();
  };

  const selectTrainee = (trainee: Trainee) => {
    setSelectedTrainee(trainee);
    setSearchResults([]);
    setSearchQuery("");
  };

  const clearSelection = () => {
    setSelectedTrainee(null);
    setSelectedDocType(null);
  };

  return (
    <Card className="border-secondary/30">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-secondary/20 flex items-center justify-center">
            <FileText className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <CardTitle className="text-lg">Trainee Document Generator</CardTitle>
            <CardDescription>
              Search for a trainee and generate official documents
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Section */}
        {!selectedTrainee ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, trainee ID, or national ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Search"
                )}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="border rounded-lg divide-y max-h-64 overflow-auto">
                {searchResults.map((trainee) => (
                  <button
                    key={trainee.id}
                    onClick={() => selectTrainee(trainee)}
                    className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-center gap-3"
                  >
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {trainee.first_name} {trainee.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {trainee.trainee_id} • {trainee.trade?.name || "No trade"}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      Level {trainee.level || "N/A"}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Selected Trainee & Document Selection */
          <div className="space-y-4">
            {/* Selected Trainee Card */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">
                  {selectedTrainee.first_name} {selectedTrainee.last_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedTrainee.trainee_id} • {selectedTrainee.trade?.name || "N/A"} • Level {selectedTrainee.level || "N/A"}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Change
              </Button>
            </div>

            {/* Document Type Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Document Type</label>
              <div className="grid gap-2 sm:grid-cols-3">
                {documentTypes.map((doc) => {
                  const Icon = doc.icon;
                  const isSelected = selectedDocType === doc.id;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDocType(doc.id)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        isSelected 
                          ? "border-primary bg-primary/5 ring-1 ring-primary" 
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <Icon className={`h-5 w-5 mb-2 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      <p className="font-medium text-sm">{doc.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{doc.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Generate Button */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={generateDocument}
                disabled={!selectedDocType || isGenerating}
                className="flex-1"
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Generate & Download
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
