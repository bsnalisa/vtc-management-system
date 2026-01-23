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
import { Loader2 } from "lucide-react";

interface UserDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    user_id: string;
    firstname: string | null;
    surname: string | null;
    email: string | null;
  } | null;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
  mode: "delete" | "deactivate";
}

export const UserDeleteDialog = ({ 
  open, 
  onOpenChange, 
  user, 
  onConfirm,
  isLoading = false,
  mode
}: UserDeleteDialogProps) => {
  if (!user) return null;

  const isDelete = mode === "delete";
  const title = isDelete ? "Delete User" : "Deactivate User";
  const description = isDelete
    ? `Are you sure you want to permanently delete "${user.firstname} ${user.surname}" (${user.email})? This action cannot be undone.`
    : `Are you sure you want to deactivate "${user.firstname} ${user.surname}" (${user.email})? They will no longer be able to sign in.`;
  const actionText = isDelete ? "Delete" : "Deactivate";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isLoading}
            className={isDelete ? "bg-destructive hover:bg-destructive/90" : ""}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              actionText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
