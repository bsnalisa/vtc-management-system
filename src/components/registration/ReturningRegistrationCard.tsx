import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RegistrationWindow, todayIso } from "@/hooks/useRegistrationWindows";

// Newer than the generated Supabase types, so access untyped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Result { registration_id: string; status: string; outstanding: number }

const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });

/** Lets an active trainee register themselves for a new academic year while a registration window is open. */
export const ReturningRegistrationCard = ({ organizationId }: { organizationId: string | null | undefined }) => {
  const queryClient = useQueryClient();
  const [year, setYear] = useState("");
  const [hostel, setHostel] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: windows, isLoading, error } = useQuery({
    queryKey: ["open-registration-windows", organizationId], enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.from("registration_windows").select("*")
        .eq("organization_id", organizationId).eq("window_type", "registration").order("opens_on");
      if (error) throw error;
      return data as RegistrationWindow[];
    },
  });

  const register = useMutation({
    mutationFn: async (academicYear: string) => {
      const { data, error } = await db.rpc("self_register_returning", { _academic_year: academicYear, _hostel_required: hostel });
      if (error) throw error;
      return data as Result;
    },
    onMutate: () => setServerError(null),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["my-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["registrations"] });
      toast.success("Registration request sent");
    },
    onError: (e: Error) => { setServerError(e.message); toast.error(e.message); },
  });

  if (!organizationId || isLoading) return null;
  if (error) return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Could not check registration windows: {(error as Error).message}</AlertDescription></Alert>;

  const today = todayIso();
  const openNow = (windows ?? []).filter((w) => w.opens_on <= today && today <= w.closes_on);
  const next = (windows ?? []).find((w) => w.opens_on > today);

  if (!openNow.length && !result) {
    return next ? (
      <Alert><AlertDescription>Registration for {next.academic_year} opens on {fmtDate(next.opens_on)}.</AlertDescription></Alert>
    ) : null;
  }

  const years = Array.from(new Set(openNow.map((w) => w.academic_year)));
  const selected = year || (years.length === 1 ? years[0] : "");

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle>Register for a new academic year</CardTitle>
        <CardDescription>
          {openNow.length ? `Registration is open until ${fmtDate(openNow[0].closes_on)}.` : "Your registration request has been received."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {result ? (
          result.status === "fee_pending" ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your request was received, but you have outstanding fees of <strong>{Number(result.outstanding).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</strong>.
                Please settle them so your registration can be completed.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>Your registration request was received and is waiting for confirmation by the registration office.</AlertDescription>
            </Alert>
          )
        ) : (
          <>
            <div className="space-y-2">
              <Label>Academic year</Label>
              <Select value={selected} onValueChange={setYear}>
                <SelectTrigger><SelectValue placeholder="Select the academic year" /></SelectTrigger>
                <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="rr-hostel" checked={hostel} onCheckedChange={(c) => setHostel(c === true)} />
              <Label htmlFor="rr-hostel" className="cursor-pointer">I need hostel accommodation</Label>
            </div>
            {serverError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{serverError}</AlertDescription></Alert>}
            <Button disabled={!selected || register.isPending} onClick={() => register.mutate(selected)}>
              {register.isPending ? "Submitting..." : "Register"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
