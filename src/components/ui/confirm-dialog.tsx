import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2, CheckCircle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  variant?: "default" | "destructive" | "warning";
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  variant = "default",
  isLoading = false,
}: ConfirmDialogProps) {
  const getIcon = () => {
    switch (variant) {
      case "destructive":
        return <Trash2 className="h-6 w-6 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-6 w-6 text-yellow-500" />;
      default:
        return <CheckCircle className="h-6 w-6 text-primary" />;
    }
  };

  const getConfirmButtonVariant = () => {
    switch (variant) {
      case "destructive":
        return "destructive";
      case "warning":
        return "default";
      default:
        return "default";
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            {getIcon()}
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant={getConfirmButtonVariant()}
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : confirmText}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}