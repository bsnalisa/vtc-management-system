import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGenerateDocument, useGeneratedDocuments, useDownloadDocument } from "@/hooks/useDocumentGeneration";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { withRoleAccess } from "@/components/withRoleAccess";
import { MODULE_CODES } from "@/lib/packageUtils";
import { ModuleAccessGate } from "@/components/ModuleAccessGate";

const DocumentGeneration = () => {
  const { navItems, groupLabel } = useRoleNavigation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [documentType, setDocumentType] = useState<string>("");
  const [templateName, setTemplateName] = useState("");
  const [documentData, setDocumentData] = useState("");

  const generateDocument = useGenerateDocument();
  const { data: documents, isLoading } = useGeneratedDocuments();
  const downloadDocument = useDownloadDocument();

  const handleGenerate = async () => {
    if (!documentType || !templateName) return;

    try {
      const parsedData = documentData ? JSON.parse(documentData) : {};
      
      await generateDocument.mutateAsync({
        documentType: documentType as any,
        templateName,
        data: parsedData,
      });

      setIsDialogOpen(false);
      setDocumentType("");
      setTemplateName("");
      setDocumentData("");
    } catch (error) {
      console.error("Generation error:", error);
    }
  };

  const handleDownload = (filePath: string) => {
    downloadDocument.mutate(filePath);
  };

  return (
    <ModuleAccessGate moduleCode={MODULE_CODES.DOCUMENT_GENERATION}>
      <DashboardLayout
        title="Document Generation"
        subtitle="Generate PDFs for invoices, reports, certificates, and more"
        navItems={navItems}
        groupLabel={groupLabel}
      >
        <div className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Generate Document
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Generate New Document</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Document Type</Label>
                    <Select value={documentType} onValueChange={setDocumentType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="invoice">Invoice</SelectItem>
                        <SelectItem value="report">Report</SelectItem>
                        <SelectItem value="certificate">Certificate</SelectItem>
                        <SelectItem value="form">Form</SelectItem>
                        <SelectItem value="letter">Letter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Template Name</Label>
                    <Input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g., fee-invoice, completion-certificate"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Document Data (JSON)</Label>
                    <Textarea
                      value={documentData}
                      onChange={(e) => setDocumentData(e.target.value)}
                      placeholder='{"title": "Example", "content": "..."}'
                      rows={10}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter document data in JSON format
                    </p>
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={!documentType || !templateName || generateDocument.isPending}
                    className="w-full"
                  >
                    {generateDocument.isPending ? "Generating..." : "Generate PDF"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Generated Documents</CardTitle>
              <CardDescription>
                View and download previously generated documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading documents...</div>
              ) : documents && documents.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document Type</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>File Name</TableHead>
                      <TableHead>Generated</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <Badge variant="secondary">
                            {doc.document_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{doc.template_name}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {doc.file_name}
                        </TableCell>
                        <TableCell>
                          {new Date(doc.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc.file_path)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No documents generated yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Document Templates Guide</CardTitle>
              <CardDescription>
                Example data structures for each document type
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold">Invoice Template</h4>
                <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto">
{`{
  "invoiceNumber": "INV-2025-001",
  "date": "2025-11-03",
  "billTo": {
    "name": "Student Name",
    "address": "123 Main St",
    "email": "student@example.com"
  },
  "items": [
    {
      "description": "Tuition Fee",
      "quantity": 1,
      "unitPrice": "1000.00",
      "amount": "1000.00"
    }
  ],
  "total": "1000.00"
}`}
                </pre>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Certificate Template</h4>
                <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto">
{`{
  "recipientName": "John Doe",
  "courseName": "Welding Level 2",
  "completionDate": "2025-11-03"
}`}
                </pre>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">Report Template</h4>
                <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto">
{`{
  "title": "Monthly Performance Report",
  "period": "October 2025",
  "sections": [
    {
      "title": "Overview",
      "content": "Summary of activities..."
    }
  ]
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ModuleAccessGate>
  );
};

export default withRoleAccess(DocumentGeneration, {
  requiredRoles: ["admin", "organization_admin", "registration_officer", "trainer", "head_of_training"],
  redirectTo: "/dashboard",
});
