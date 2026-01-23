import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { ReportDefinition } from "@/lib/reportConfig";

interface ReportCardProps {
  report: ReportDefinition;
  onGenerate: (reportId: string, format: "csv" | "excel") => void;
  isGenerating: boolean;
  currentGeneratingId: string | null;
}

export const ReportCard = ({ 
  report, 
  onGenerate, 
  isGenerating, 
  currentGeneratingId 
}: ReportCardProps) => {
  const Icon = report.icon;
  const isCurrentlyGenerating = isGenerating && currentGeneratingId === report.id;

  const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
    academic: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/20" },
    financial: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/20" },
    operations: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/20" },
    administrative: { bg: "bg-purple-500/10", text: "text-purple-600", border: "border-purple-500/20" },
    hr: { bg: "bg-rose-500/10", text: "text-rose-600", border: "border-rose-500/20" },
  };

  const colors = categoryColors[report.category] || categoryColors.academic;

  return (
    <Card className={`group hover:shadow-lg transition-all duration-300 border ${colors.border} hover:border-primary/30`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={`h-11 w-11 rounded-xl ${colors.bg} flex items-center justify-center transition-transform group-hover:scale-110`}>
            <Icon className={`h-5 w-5 ${colors.text}`} />
          </div>
        </div>
        <CardTitle className="text-base font-semibold mt-3 line-clamp-1">
          {report.title}
        </CardTitle>
        <CardDescription className="text-sm line-clamp-2 min-h-[40px]">
          {report.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-9"
            onClick={() => onGenerate(report.id, "csv")}
            disabled={isGenerating}
          >
            {isCurrentlyGenerating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
            CSV
          </Button>
          <Button
            size="sm"
            className="flex-1 h-9"
            onClick={() => onGenerate(report.id, "excel")}
            disabled={isGenerating}
          >
            {isCurrentlyGenerating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
            )}
            Excel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
