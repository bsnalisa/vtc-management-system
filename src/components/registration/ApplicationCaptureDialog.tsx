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

  const handleSubmit = async (formData: ComprehensiveApplicationData) => {
    await createApplication.mutateAsync(formData);
    
    // Delete the draft after successful submission
    if (draftId) {
      await deleteDraft.mutateAsync(draftId);
      onDraftDeleted?.();
    }
  };

  return (
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
  );
};