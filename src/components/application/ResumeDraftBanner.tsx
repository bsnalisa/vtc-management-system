import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileText, Clock, Trash2, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ComprehensiveApplicationData } from "@/types/application";

interface ResumeDraftBannerProps {
  draft: {
    id: string;
    form_data: ComprehensiveApplicationData;
    progress_percentage: number;
    last_updated_at: string;
    current_tab: string;
  };
  onResume: () => void;
  onDiscard: () => void;
  isDiscarding?: boolean;
}

export const ResumeDraftBanner = ({
  draft,
  onResume,
  onDiscard,
  isDiscarding = false,
}: ResumeDraftBannerProps) => {
  const applicantName = [draft.form_data.first_name, draft.form_data.last_name]
    .filter(Boolean)
    .join(" ") || "Unnamed";

  const lastUpdated = formatDistanceToNow(new Date(draft.last_updated_at), { addSuffix: true });

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-base sm:text-lg truncate">
                Continue Your Application
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                {applicantName} • {draft.progress_percentage}% complete
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Progress value={draft.progress_percentage} className="h-2 flex-1 max-w-[200px]" />
                <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                  <Clock className="h-3 w-3" />
                  {lastUpdated}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={onDiscard}
              disabled={isDiscarding}
              className="flex-1 sm:flex-none"
            >
              <Trash2 className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Discard</span>
            </Button>
            <Button
              size="sm"
              onClick={onResume}
              className="flex-1 sm:flex-none"
            >
              <span className="hidden xs:inline">Resume</span>
              <span className="xs:hidden">Continue</span>
              <ArrowRight className="h-4 w-4 ml-1 sm:ml-2" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};