import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, Clock, AlertTriangle, Pause, Play, Archive } from "lucide-react";

type StatusVariant = "success" | "error" | "warning" | "info" | "pending" | "inactive" | "default";

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  showIcon?: boolean;
  className?: string;
}

const statusConfig: Record<string, { variant: StatusVariant; icon: typeof CheckCircle }> = {
  // Common statuses
  active: { variant: "success", icon: CheckCircle },
  inactive: { variant: "inactive", icon: XCircle },
  enabled: { variant: "success", icon: CheckCircle },
  disabled: { variant: "inactive", icon: XCircle },
  
  // Approval statuses
  approved: { variant: "success", icon: CheckCircle },
  rejected: { variant: "error", icon: XCircle },
  pending: { variant: "pending", icon: Clock },
  pending_approval: { variant: "pending", icon: Clock },
  
  // Payment statuses
  paid: { variant: "success", icon: CheckCircle },
  unpaid: { variant: "error", icon: XCircle },
  partial: { variant: "warning", icon: AlertTriangle },
  overdue: { variant: "error", icon: AlertTriangle },
  
  // General
  completed: { variant: "success", icon: CheckCircle },
  cancelled: { variant: "inactive", icon: Archive },
  in_progress: { variant: "info", icon: Play },
  on_hold: { variant: "warning", icon: Pause },
  
  // Training
  enrolled: { variant: "success", icon: CheckCircle },
  graduated: { variant: "success", icon: CheckCircle },
  dropped: { variant: "error", icon: XCircle },
  
  // Application
  submitted: { variant: "info", icon: Clock },
  under_review: { variant: "pending", icon: Clock },
  accepted: { variant: "success", icon: CheckCircle },
  waitlisted: { variant: "warning", icon: Clock },
};

const variantStyles: Record<StatusVariant, string> = {
  success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
  error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  pending: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  inactive: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800",
  default: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status, variant, showIcon = true, className }: StatusBadgeProps) {
  const normalizedStatus = status?.toLowerCase().replace(/\s+/g, "_") || "";
  const config = statusConfig[normalizedStatus];
  
  const finalVariant = variant || config?.variant || "default";
  const Icon = config?.icon || CheckCircle;
  
  const displayText = status
    ?.replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase()) || "Unknown";

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border",
        variantStyles[finalVariant],
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3 mr-1" />}
      {displayText}
    </Badge>
  );
}