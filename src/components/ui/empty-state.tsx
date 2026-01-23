import { LucideIcon, FileQuestion, Search, Users, FileText, Package, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  variant?: "default" | "search" | "users" | "documents" | "stock" | "data";
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  variant = "default",
}: EmptyStateProps) {
  const getDefaultIcon = () => {
    switch (variant) {
      case "search":
        return Search;
      case "users":
        return Users;
      case "documents":
        return FileText;
      case "stock":
        return Package;
      case "data":
        return Database;
      default:
        return FileQuestion;
    }
  };

  const Icon = icon || getDefaultIcon();

  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}