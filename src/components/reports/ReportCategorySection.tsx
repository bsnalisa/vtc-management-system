import { ReportDefinition } from "@/lib/reportConfig";
import { ReportCard } from "./ReportCard";

interface ReportCategorySectionProps {
  categoryId: string;
  categoryLabel: string;
  categoryDescription: string;
  reports: ReportDefinition[];
  onGenerate: (reportId: string, format: "csv" | "excel") => void;
  isGenerating: boolean;
  currentGeneratingId: string | null;
}

export const ReportCategorySection = ({
  categoryId,
  categoryLabel,
  categoryDescription,
  reports,
  onGenerate,
  isGenerating,
  currentGeneratingId,
}: ReportCategorySectionProps) => {
  if (reports.length === 0) return null;

  const categoryIcons: Record<string, string> = {
    academic: "📚",
    financial: "💰",
    operations: "⚙️",
    administrative: "📋",
    hr: "👥",
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3 pb-2 border-b border-border/50">
        <span className="text-2xl">{categoryIcons[categoryId]}</span>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{categoryLabel}</h2>
          <p className="text-sm text-muted-foreground">{categoryDescription}</p>
        </div>
      </div>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            onGenerate={onGenerate}
            isGenerating={isGenerating}
            currentGeneratingId={currentGeneratingId}
          />
        ))}
      </div>
    </section>
  );
};
