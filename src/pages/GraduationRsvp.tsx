import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { fetchInvitationByToken, respondToInvitation } from "@/hooks/useGraduation";

export default function GraduationRsvp() {
  const { token = "" } = useParams();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["public-invitation", token], queryFn: () => fetchInvitationByToken(token), retry: false });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const reply = async (code: 1 | 2) => {
    setBusy(true);
    setProblem(null);
    try {
      await respondToInvitation(token, code);
      await refetch();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not record your reply");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-lg mx-auto py-8">
        {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto" /> : error || !data ? (
          <Card><CardHeader><CardTitle>Invitation not found</CardTitle><CardDescription>This link is invalid or has expired.</CardDescription></CardHeader></Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{data.title}</CardTitle>
              <CardDescription>Dear {data.graduate_name}, you are invited on {new Date(data.ceremony_date).toLocaleString()}{data.venue ? ` at ${data.venue}` : ""}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.response_code && (
                <p className="font-medium" role="status">{data.response_code === 1 ? "You have confirmed that you will attend." : "You have declined this invitation."} You can change your reply below.</p>
              )}
              <div className="flex gap-3">
                <Button disabled={busy} onClick={() => reply(1)}>1 - Yes, I will attend</Button>
                <Button disabled={busy} variant="outline" onClick={() => reply(2)}>2 - No, I cannot attend</Button>
              </div>
              {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
