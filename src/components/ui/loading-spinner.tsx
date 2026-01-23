import { cn } from "@/lib/utils";
import { GraduationCap } from "lucide-react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
  fullPage?: boolean;
}

export function LoadingSpinner({
  size = "md",
  className,
  text,
  fullPage = false,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-10 w-10",
    lg: "h-16 w-16",
  };

  const spinner = (
    <div className={cn(
      "flex flex-col items-center justify-center gap-3",
      className
    )}>
      <div className="relative">
        <GraduationCap 
          className={cn(
            "text-primary animate-graduation-bounce",
            sizeClasses[size]
          )} 
        />
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-primary/20 rounded-full animate-graduation-shadow" />
      </div>
      {text && (
        <p className="text-sm text-muted-foreground animate-pulse">{text}</p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
}

// Page loading component for route transitions
export function PageLoader({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}

// Inline button loading state
export function ButtonSpinner({ className }: { className?: string }) {
  return <GraduationCap className={cn("h-4 w-4 animate-graduation-bounce", className)} />;
}
