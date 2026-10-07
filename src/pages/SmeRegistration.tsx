import { useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { submitSmeApplication } from "@/hooks/useAssessmentDevelopment";

/** Public page: experts apply to become Subject Matter Experts for a training centre. */
export default function SmeRegistration() {
  const { slug = "" } = useParams();
  const [f, setF] = useState({ full_name: "", email: "", phone: "", national_id: "", expertise: "", experience: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      await submitSmeApplication({ slug, ...f });
      setDone(true);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not submit your application");
    } finally {
      setBusy(false);
    }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-xl mx-auto py-8">
        {done ? (
          <Card><CardHeader><CardTitle>Application received</CardTitle><CardDescription>The training centre will review your application and contact you at {f.email}.</CardDescription></CardHeader></Card>
        ) : (
          <Card>
            <CardHeader><CardTitle>Subject Matter Expert registration</CardTitle><CardDescription>Register to help develop and review assessment materials.</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1"><Label htmlFor="n">Full name</Label><Input id="n" required value={f.full_name} onChange={set("full_name")} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label htmlFor="e">Email</Label><Input id="e" type="email" required value={f.email} onChange={set("email")} /></div>
                  <div className="space-y-1"><Label htmlFor="p">Phone</Label><Input id="p" value={f.phone} onChange={set("phone")} /></div>
                </div>
                <div className="space-y-1"><Label htmlFor="i">National ID</Label><Input id="i" value={f.national_id} onChange={set("national_id")} /></div>
                <div className="space-y-1"><Label htmlFor="x">Area of expertise (trade / qualification)</Label><Input id="x" required value={f.expertise} onChange={set("expertise")} /></div>
                <div className="space-y-1"><Label htmlFor="ex">Experience and qualifications</Label><Textarea id="ex" required rows={5} value={f.experience} onChange={set("experience")} /></div>
                {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
                <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit application</Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
