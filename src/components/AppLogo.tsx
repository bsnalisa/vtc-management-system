import { cn } from "@/lib/utils";

export function AppLogo({ className }: { className?: string }) {
  return <img src="/favicon.svg" alt="VTC Management System" width={36} height={36} className={cn("h-9 w-9 shrink-0 rounded-lg", className)} />;
}