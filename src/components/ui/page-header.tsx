import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  backUrl?: string;
  className?: string;
  children?: ReactNode;
}

export function PageHeader({
  title,
  description,
  icon,
  actions,
  backUrl,
  className,
  children,
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          {backUrl && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(backUrl)}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          {icon && (
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
            {description && (
              <p className="text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {actions}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}