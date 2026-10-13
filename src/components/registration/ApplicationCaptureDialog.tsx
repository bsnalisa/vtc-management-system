import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ComprehensiveApplicationForm } from "@/components/application/ComprehensiveApplicationForm";
import { useCreateApplication } from "@/hooks/useTraineeApplications";
import { useDeleteApplicationDraft } from "@/hooks/useApplicationDraft";
import { ComprehensiveApplicationData } from "@/types/application";

interface ApplicationCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: ComprehensiveApplicationData;
  initialTab?: string;
  draftId?: string;
  onDraftDeleted?: () => void;
}

export const ApplicationCaptureDialog = ({ 
  open, 
  onOpenChange,
  initialData,
  initialTab,
  draftId,
  onDraftDeleted,
}: ApplicationCaptureDialogProps) => {
  const createApplication = useCreateApplication();
  const deleteDraft = useDeleteApplicationDraft();
  const { toast } = useToast();
  const [account, setAccount] = useState<{ email: string; password?: string; existing: boolean; name: string } | null>(null);

  const handleSubmit = async (formData: ComprehensiveApplicationData) => {
    // The applicant account is created from the email, so a centre-captured application needs one
    if (!formData.email?.trim()) {
      const message = "Enter the applicant's email address (Personal tab). It is used to create their applicant account.";
      toast({ title: "Email required", description: message, variant: "destructive" });
      throw new Error(message);
    }
    const application = await createApplication.mutateAsync(formData);

    // Captured at the centre: create the applicant account so the trainee can follow the status
    const { data, error } = await supabase.functions.invoke("create-applicant-account", {
      body: { application_id: application.id },
    });
    if (error || !data?.success) {
      toast({
        title: "Application captured, applicant account not created",
        description: data?.error || error?.message || "Try again from the application.",
        variant: "destructive",
      });
    } else {
      setAccount({
        email: data.email,
        password: data.temporary_password,
        existing: !!data.existing,
        name: `${formData.first_name} ${formData.last_name}`,
      });
    }
    
    // Delete the draft after successful submission
    if (draftId) {
      await deleteDraft.mutateAsync(draftId);
      onDraftDeleted?.();
    }
  };

  return (
    <>
    <ComprehensiveApplicationForm
      open={open}
      onOpenChange={onOpenChange}
      onSubmit={handleSubmit}
      isSubmitting={createApplication.isPending}
      initialData={initialData}
      initialTab={initialTab}
      draftId={draftId}
      onDraftDeleted={onDraftDeleted}
    />
    <Dialog open={!!account} onOpenChange={(o) => !o && setAccount(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Applicant account {account?.existing ? "linked" : "created"}</DialogTitle>
          <DialogDescription>
            {account?.name} can sign in at the applicant page to follow the status of this application.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
          <div><span className="text-muted-foreground">Email:</span> <span className="font-mono">{account?.email}</span></div>
          {account?.password ? (
            <div><span className="text-muted-foreground">Temporary password:</span> <span className="font-mono">{account.password}</span></div>
          ) : (
            <p className="text-muted-foreground">This email already had an account; the application was added to it.</p>
          )}
        </div>
        {account?.password && (
          <p className="text-xs text-muted-foreground">Give these details to the applicant now. The password is not shown again; they should change it after signing in.</p>
        )}
        <div className="flex justify-end"><Button onClick={() => setAccount(null)}>Done</Button></div>
      </DialogContent>
    </Dialog>
    </>
  );
};