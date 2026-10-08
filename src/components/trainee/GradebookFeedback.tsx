import { MessageSquare } from "lucide-react";

interface FeedbackRow { id: string; component_id: string; feedback_text: string; written_at?: string | null }
interface ComponentRow { id: string; name: string }

/** Trainer feedback written against a gradebook's components, shown to the trainee under the marks. */
export const GradebookFeedback = ({ feedback, components }: { feedback: FeedbackRow[]; components: ComponentRow[] }) => {
  const rows = feedback.filter((f) => f.feedback_text?.trim());
  if (!rows.length) return null;
  return (
    <div className="px-4 py-3 border-t border-border space-y-2">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" />Trainer feedback</p>
      {rows.map((f) => (
        <div key={f.id} className="rounded bg-muted p-2 text-sm">
          <span className="text-xs font-medium text-muted-foreground">{components.find((c) => c.id === f.component_id)?.name ?? "Assessment"}: </span>
          {f.feedback_text}
        </div>
      ))}
    </div>
  );
};
