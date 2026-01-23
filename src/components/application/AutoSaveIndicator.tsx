import { Cloud, CloudOff, Loader2, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface AutoSaveIndicatorProps {
  isSaving: boolean;
  lastSaved?: string;
  error?: boolean;
  className?: string;
}

export const AutoSaveIndicator = ({
  isSaving,
  lastSaved,
  error = false,
  className,
}: AutoSaveIndicatorProps) => {
  if (error) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-destructive", className)}>
        <CloudOff className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Failed to save</span>
      </div>
    );
  }

  if (isSaving) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="hidden sm:inline">Saving...</span>
      </div>
    );
  }

  if (lastSaved) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <Check className="h-3.5 w-3.5 text-green-500" />
        <span className="hidden sm:inline">
          Saved {formatDistanceToNow(new Date(lastSaved), { addSuffix: true })}
        </span>
        <span className="sm:hidden">Saved</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <Cloud className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Auto-save enabled</span>
    </div>
  );
};