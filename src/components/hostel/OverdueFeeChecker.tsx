import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function OverdueFeeChecker() {
  const [isChecking, setIsChecking] = useState(false);

  const handleCheckOverdue = async () => {
    setIsChecking(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('check-overdue-hostel-fees', {
        body: {}
      });

      if (error) throw error;

      if (data.success) {
        if (data.overdue_count === 0) {
          toast.success('No overdue fees found', {
            description: 'All hostel fees are up to date!'
          });
        } else {
          toast.success('Overdue fee check complete', {
            description: `Found ${data.overdue_count} overdue fees. Notifications sent to ${data.organizations_notified} organization(s).`
          });
        }
      } else {
        toast.error('Failed to check overdue fees', {
          description: data.error || 'Unknown error occurred'
        });
      }
    } catch (error: any) {
      console.error('Error checking overdue fees:', error);
      toast.error('Failed to check overdue fees', {
        description: error.message || 'An unexpected error occurred'
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={isChecking}>
          <AlertTriangle className="h-4 w-4 mr-2" />
          Check Overdue Fees
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Check for Overdue Hostel Fees</AlertDialogTitle>
          <AlertDialogDescription>
            This will scan all hostel fees and identify any that are past their due date.
            <br /><br />
            Hostel coordinators will receive email notifications for overdue fees in their organizations.
            <br /><br />
            <strong>Note:</strong> This check runs automatically every day at 8:00 AM.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleCheckOverdue} disabled={isChecking}>
            {isChecking ? 'Checking...' : 'Check Now'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
