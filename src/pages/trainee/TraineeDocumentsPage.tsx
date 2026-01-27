import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/DashboardLayout";
import { traineeNavItems } from "@/lib/navigationConfig";
import { FileText, Upload, Download, Eye, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { withRoleAccess } from "@/components/withRoleAccess";

interface Document {
  id: string;
  name: string;
  type: string;
  status: "pending" | "verified" | "rejected";
  uploadedAt: string;
  size: string;
}

const TraineeDocumentsPage = () => {
  // Mock documents data - in production, fetch from storage
  const documents: Document[] = [
    { id: "1", name: "National ID Copy", type: "identity", status: "verified", uploadedAt: "Jan 15, 2025", size: "1.2 MB" },
    { id: "2", name: "Grade 12 Certificate", type: "academic", status: "verified", uploadedAt: "Jan 15, 2025", size: "2.5 MB" },
    { id: "3", name: "Passport Photo", type: "photo", status: "verified", uploadedAt: "Jan 15, 2025", size: "500 KB" },
    { id: "4", name: "Medical Certificate", type: "medical", status: "pending", uploadedAt: "Jan 18, 2025", size: "800 KB" },
  ];

  const statusConfig = {
    pending: { color: "bg-yellow-100 text-yellow-800", label: "Pending Review", icon: <Clock className="h-3 w-3" /> },
    verified: { color: "bg-green-100 text-green-800", label: "Verified", icon: <CheckCircle className="h-3 w-3" /> },
    rejected: { color: "bg-red-100 text-red-800", label: "Rejected", icon: <AlertCircle className="h-3 w-3" /> },
  };

  return (
    <DashboardLayout
      title="My Documents"
      subtitle="Manage your uploaded documents"
      navItems={traineeNavItems}
      groupLabel="Trainee iEnabler"
    >
      <div className="space-y-6">
        {/* Upload Section */}
        <Card className="border-0 shadow-md border-dashed">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="p-4 rounded-full bg-primary/10 mb-4">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Upload New Document</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                Upload additional documents required for your registration. Supported formats: PDF, JPG, PNG (max 10MB)
              </p>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Select Files
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Documents List */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Uploaded Documents</CardTitle>
            <CardDescription>{documents.length} document(s) uploaded</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {documents.map((doc) => {
                const status = statusConfig[doc.status];
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-muted">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{doc.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {doc.size} • Uploaded {doc.uploadedAt}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={status.color} variant="outline">
                        {status.icon}
                        <span className="ml-1">{status.label}</span>
                      </Badge>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Required Documents Checklist */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Required Documents Checklist</CardTitle>
            <CardDescription>Ensure all required documents are uploaded and verified</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: "National ID / Passport", required: true, uploaded: true },
                { name: "Grade 12 Certificate or Equivalent", required: true, uploaded: true },
                { name: "Passport Size Photo", required: true, uploaded: true },
                { name: "Medical Certificate", required: false, uploaded: true },
                { name: "Proof of Address", required: false, uploaded: false },
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    item.uploaded ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                  }`}>
                    {item.uploaded ? <CheckCircle className="h-3 w-3" /> : <div className="w-2 h-2 rounded-full bg-current" />}
                  </div>
                  <span className={item.uploaded ? "" : "text-muted-foreground"}>
                    {item.name}
                    {item.required && <span className="text-red-500 ml-1">*</span>}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default withRoleAccess(TraineeDocumentsPage, {
  requiredRoles: ["trainee"],
});
