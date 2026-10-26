import { useEffect, useMemo, useRef, useState } from "react";
import { FileCheck, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logProofPrint, useProofData, useTraineeRegistrations } from "@/hooks/useProofOfRegistration";
import { printRawDocument } from "@/lib/printDocument";
import { proofDocumentHtml } from "@/lib/proofOfRegistration";

const PAGE_PX = 794; // 210 mm at 96 dpi

/** A4 preview of a document, scaled to the width available. The same HTML is what gets printed. */
export function ProofFrame({ html }: { html: string }) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(1123);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / PAGE_PX));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const measure = () => { const h = frame.current?.contentDocument?.documentElement.scrollHeight; if (h) setHeight(h); };
  return (
    <div ref={box} className="w-full overflow-hidden rounded-md border bg-muted/40" style={{ height: height * scale }}>
      <iframe ref={frame} title="Proof of registration preview" srcDoc={html} onLoad={measure} sandbox="allow-same-origin"
        style={{ width: PAGE_PX, height, border: 0, background: "#fff", transform: `scale(${scale})`, transformOrigin: "top left" }} />
    </div>
  );
}

function ProofDialogBody({ registrationId }: { registrationId: string }) {
  const { data, isLoading, error } = useProofData(registrationId);
  const html = useMemo(() => (data ? proofDocumentHtml(data) : ""), [data]);
  const act = (action: "print" | "download") => {
    try {
      printRawDocument(html);
      void logProofPrint(registrationId, action);
      if (action === "download") toast.info("In the print window, choose “Save as PDF” as the destination.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not open the print view"); }
  };
  if (error) return <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert>;
  if (isLoading || !data) return <Skeleton className="h-96 w-full" aria-busy="true" />;
  return (
    <div className="space-y-3">
      {!data.settings_complete && (
        <Alert><AlertDescription>Letterhead not configured for this centre. Ask your Organization Admin to complete the Proof of Registration settings. The document uses the centre name only until then.</AlertDescription></Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => act("print")}><Printer className="mr-2 h-4 w-4" />Print</Button>
        <Button variant="outline" onClick={() => act("download")}>Download PDF</Button>
      </div>
      <ProofFrame html={html} />
    </div>
  );
}

/**
 * The single entry point for proof of registration. Give it a registration, or a trainee (the user then picks which of
 * the trainee's registrations to open when there are several).
 */
export function ProofOfRegistration({ registrationId, traineeId, open, onClose }: { registrationId?: string; traineeId?: string; open: boolean; onClose: () => void }) {
  const { data: regs } = useTraineeRegistrations(registrationId ? null : traineeId);
  const [picked, setPicked] = useState<string>("");
  const options = regs ?? [];
  const current = registrationId ?? (picked || (options.length === 1 ? options[0].id : ""));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>Proof of Registration</DialogTitle><DialogDescription>Generated from the centre’s live records.</DialogDescription></DialogHeader>
        {!registrationId && options.length > 1 && (
          <Select value={picked} onValueChange={setPicked}>
            <SelectTrigger aria-label="Registration"><SelectValue placeholder="Choose the registration to print" /></SelectTrigger>
            <SelectContent>{options.map((r) => <SelectItem key={r.id} value={r.id}>{r.academic_year} · {r.registration_status.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {!registrationId && traineeId && regs && !options.length && <Alert><AlertDescription>This trainee has no registration yet.</AlertDescription></Alert>}
        {current && <ProofDialogBody key={current} registrationId={current} />}
      </DialogContent>
    </Dialog>
  );
}

/** The "Print Proof of Registration" button used on every page that shows a registration. */
export function PrintProofButton({ registrationId, traineeId, label = "Print Proof of Registration", variant = "outline", size = "sm", disabled }: {
  registrationId?: string; traineeId?: string; label?: string; variant?: "default" | "outline" | "secondary" | "ghost"; size?: "default" | "sm"; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} disabled={disabled || (!registrationId && !traineeId)} onClick={() => setOpen(true)}><FileCheck className="mr-2 h-4 w-4" />{label}</Button>
      {open && <ProofOfRegistration registrationId={registrationId} traineeId={traineeId} open onClose={() => setOpen(false)} />}
    </>
  );
}
