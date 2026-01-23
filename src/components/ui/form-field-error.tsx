import { cn } from "@/lib/utils";

interface FormFieldErrorProps {
  error?: string;
  className?: string;
}

export function FormFieldError({ error, className }: FormFieldErrorProps) {
  if (!error) return null;
  
  return (
    <p className={cn("text-sm text-destructive mt-1", className)}>
      {error}
    </p>
  );
}
