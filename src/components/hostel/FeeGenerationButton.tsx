import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CalendarClock } from "lucide-react";
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

export function FeeGenerationButton() {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateFees = async () => {
    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-hostel-fees', {
        body: {}
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message, {
          description: `Generated ${data.generated} fee records for ${new Date(data.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
        });
      } else {
        toast.error('Failed to generate fees', {
          description: data.error || 'Unknown error occurred'
        });
      }
    } catch (error: any) {
      console.error('Error generating fees:', error);
      toast.error('Failed to generate fees', {
        description: error.message || 'An unexpected error occurred'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={isGenerating}>
          <CalendarClock className="h-4 w-4 mr-2" />
          Generate Monthly Fees
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Generate Monthly Hostel Fees</AlertDialogTitle>
          <AlertDialogDescription>
            This will automatically generate hostel fee records for all active allocations for {currentMonth}.
            <br /><br />
            Fee records will only be created for allocations that don't already have fees for this month.
            <br /><br />
            Are you sure you want to proceed?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleGenerateFees} disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Generate Fees'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
