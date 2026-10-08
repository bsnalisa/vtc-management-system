import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PublishBarProps {
  academicYear: string;
  term: number;
  entries: object[];
}

const PublishBar = ({ academicYear, term, entries }: PublishBarProps) => {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const published = entries.filter((e) => (e as { published?: boolean | null }).published).length;
  const drafts = entries.length - published;

  const setPublished = useMutation({
    mutationFn: async (publish: boolean) => {
      // Newer than the generated Supabase types, so access untyped.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data, error } = await db.rpc("publish_timetable", {
        _academic_year: academicYear,
        _term: term,
        _publish: publish,
      });
      if (error) throw error;
      return { publish, changed: data as number };
    },
    onSuccess: ({ publish, changed }) => {
      queryClient.invalidateQueries({ queryKey: ["timetable_entries"] });
      toast.success(
        publish
          ? `Timetable published (${changed} entries). Trainees have been notified.`
          : `Timetable withdrawn (${changed} entries are now drafts).`,
      );
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <Card>
      <CardContent className="py-4 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">
            Visibility for {academicYear}, term {term}
          </span>
          <Badge variant="outline">{drafts} draft</Badge>
          <Badge variant="secondary">{published} published</Badge>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              disabled={setPublished.isPending || published === 0}
              onClick={() => setPublished.mutate(false)}
            >
              <EyeOff className="h-4 w-4 mr-2" /> Withdraw
            </Button>
            <Button
              disabled={setPublished.isPending || drafts === 0}
              onClick={() => setConfirmOpen(true)}
            >
              <Send className="h-4 w-4 mr-2" /> Publish timetable
            </Button>
          </div>
        </div>
        {drafts > 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Eye className="h-3 w-3" /> Trainees only see published entries. Regenerated or edited entries need publishing again.
          </p>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish the timetable?</AlertDialogTitle>
            <AlertDialogDescription>
              This makes the {academicYear} term {term} timetable visible to trainees, and trainees in the
              affected classes will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setPublished.mutate(true)}>Publish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default PublishBar;
