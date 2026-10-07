import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface PublicQualification { id: string; title: string; code: string | null; nqf_level: number | null }

const NONE = "none";

/** Public page: anyone can apply for Recognition of Prior Learning at a training centre (no account). */
export default function PublicRplApplication() {
  const { slug = "" } = useParams();
  const [f, setF] = useState({ name: "", national_id: "", phone: "", email: "", occupation: "", years: "", motivation: "", website: "" });
  const [qualification, setQualification] = useState(NONE);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const { data: qualifications } = useQuery({
    queryKey: ["public-qualifications", slug],
    retry: false,
    queryFn: async () => {
      const { data, error } = await db.rpc("list_public_qualifications", { _org_slug: slug });
      if (error) throw error;
      return data as PublicQualification[];
    },
  });

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.phone.trim() && !f.email.trim()) {
      setProblem("Give an email address or phone number so we can reach you");
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const { data, error } = await db.rpc("submit_public_rpl_application", {
        _org_slug: slug, _name: f.name, _national_id: f.national_id, _phone: f.phone, _email: f.email,
        _qualification: qualification === NONE ? null : qualification, _occupation: f.occupation,
        _years: f.years === "" ? null : Number(f.years), _motivation: f.motivation, _website: f.website,
      });
      if (error) throw error;
      setReference(data as string);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not submit your application");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-xl mx-auto py-8">
        {reference ? (
          <Card>
            <CardHeader>
              <CardTitle>Application received</CardTitle>
              <CardDescription>Your reference number is <span className="font-mono font-semibold text-foreground">{reference}</span>. Keep it safe. The training centre will contact you.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle>Recognition of Prior Learning application</CardTitle><CardDescription>Tell us about the skills and experience you have gained at work.</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={submit} className="relative space-y-4">
                <div className="space-y-1"><Label htmlFor="n">Full name *</Label><Input id="n" required maxLength={200} value={f.name} onChange={set("name")} /></div>
                <div className="space-y-1"><Label htmlFor="i">National ID</Label><Input id="i" value={f.national_id} onChange={set("national_id")} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label htmlFor="p">Phone</Label><Input id="p" type="tel" value={f.phone} onChange={set("phone")} /></div>
                  <div className="space-y-1"><Label htmlFor="e">Email</Label><Input id="e" type="email" value={f.email} onChange={set("email")} /></div>
                </div>
                <p className="text-xs text-muted-foreground">Give at least a phone number or an email address.</p>
                <div className="space-y-1">
                  <Label htmlFor="q">Qualification you want recognised</Label>
                  <Select value={qualification} onValueChange={setQualification}>
                    <SelectTrigger id="q"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not sure yet</SelectItem>
                      {qualifications?.map((q) => <SelectItem key={q.id} value={q.id}>{q.title}{q.code ? ` (${q.code})` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label htmlFor="o">Current occupation</Label><Input id="o" maxLength={200} value={f.occupation} onChange={set("occupation")} /></div>
                  <div className="space-y-1"><Label htmlFor="y">Years of experience</Label><Input id="y" type="number" min={0} max={70} value={f.years} onChange={set("years")} /></div>
                </div>
                <div className="space-y-1"><Label htmlFor="m">Why are you applying and what can you do? *</Label><Textarea id="m" required rows={6} maxLength={4000} value={f.motivation} onChange={set("motivation")} /></div>
                <input type="text" name="website" aria-hidden="true" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px]" value={f.website} onChange={set("website")} />
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
