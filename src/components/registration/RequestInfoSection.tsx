import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquareWarning } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Props {
  application: { id: string; info_request_note?: string | null; info_requested_at?: string | null } | null;
}

/** Shows the outstanding information request (if any) and lets staff ask the applicant for more information. */
export const RequestInfoSection = ({ application }: Props) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  // The application prop is a snapshot, so remember what was just sent until the lists refresh.
  const [sent, setSent] = useState<{ note: string; at: string } | null>(null);

  const request = useMutation({
    mutationFn: async () => {
      const { error } = await db.rpc("request_application_info", { _application: application!.id, _note: note.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setSent({ note: note.trim(), at: new Date().toISOString() });
      queryClient.invalidateQueries({ queryKey: ["trainee_applications"] });
      queryClient.invalidateQueries({ queryKey: ["online_applications"] });
      toast.success("The applicant has been asked for more information");
      setOpen(false);
      setNote("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!application) return null;
  const shownNote = sent?.note ?? application.info_request_note;
  const shownAt = sent?.at ?? application.info_requested_at;

  return (
    <div className="space-y-3">
      {shownNote && (
        <Alert>
          <MessageSquareWarning className="h-4 w-4" />
          <AlertTitle>Information requested{shownAt ? ` on ${new Date(shownAt).toLocaleDateString()}` : ""}</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">{shownNote}</AlertDescription>
        </Alert>
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <MessageSquareWarning className="mr-2 h-4 w-4" />Request information
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request information</DialogTitle>
            <DialogDescription>The applicant is notified and sees this note on their application status page.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="info-note">What information is missing? *</Label>
            <Textarea id="info-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please provide a certified copy of your Grade 10 results." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" disabled={!note.trim() || request.isPending} onClick={() => request.mutate()}>
              {request.isPending ? "Sending..." : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
