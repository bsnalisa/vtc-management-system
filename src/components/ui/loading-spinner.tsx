import { cn } from "@/lib/utils";

export function LoadingIndicator({ className }: { className?: string }) {
  return (
    <span role="status" aria-label="Loading" className={cn("relative inline-flex h-4 w-4 shrink-0 items-center justify-center align-middle [&>img]:size-full", className)}>
      <img src="/favicon.svg" alt="" aria-hidden="true" className="animate-graduation-bounce" />
      <span aria-hidden="true" className="absolute -bottom-1 left-1/2 h-0.5 w-3/4 rounded-full bg-current opacity-20 animate-graduation-shadow" />
    </span>
  );
}

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
      <LoadingIndicator className={cn("text-primary", sizeClasses[size])} />
      {text && (
        <p className="text-sm text-muted-foreground">{text}</p>
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
  return <LoadingIndicator className={className} />;
}
