import { CheckCircle2, Circle, CornerUpLeft, Clock, XCircle } from "lucide-react";
import { DECISION_LABEL, STAGE_LABEL, type ReqStage, type RequisitionView } from "./status";

const when = (d: string) => new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const NEGATIVE = new Set(["not_recommend", "fund_not_available", "not_approve"]);

function StageIcon({ stage }: { stage: ReqStage }) {
  if (stage.state === "decided") return NEGATIVE.has(stage.decision?.decision ?? "") ? <XCircle className="h-5 w-5 text-destructive" /> : <CheckCircle2 className="h-5 w-5 text-success" />;
  if (stage.state === "returned") return <CornerUpLeft className="h-5 w-5 text-warning" />;
  if (stage.state === "current") return <Clock className="h-5 w-5 text-primary" />;
  return <Circle className="h-5 w-5 text-muted-foreground" />;
}

// The four stages in their fixed order, with who is (or was) responsible for each
export function RequisitionStages({ view }: { view: RequisitionView }) {
  return (
    <ol className="space-y-3">
      {view.stages.map((st) => (
        <li key={st.stage_key} className="flex gap-3">
          <div className="pt-0.5"><StageIcon stage={st} /></div>
          <div className="min-w-0 flex-1">
            <div className="font-medium">{st.stage_no}. {STAGE_LABEL[st.stage_key]}</div>
            <div className="text-sm text-muted-foreground">
              {st.people.length ? st.people.map((p) => `${p.name}${p.role ? ` (${p.role.replace(/_/g, " ")})` : ""}`).join(", ") : "Nobody is assigned yet"}
              {st.state === "current" && " — waiting for a decision"}
            </div>
            {st.decision && (
              <div className="mt-1 rounded border bg-muted/30 p-2 text-sm">
                <div><strong>{DECISION_LABEL[st.decision.decision] ?? st.decision.decision}</strong>{st.decision.gl_code && <> · GL <strong>{st.decision.gl_code}</strong></>} · {st.decision.by} · {when(st.decision.at)}</div>
                {st.decision.comments && <div className="mt-1 whitespace-pre-wrap">{st.decision.comments}</div>}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

// Everything that has happened, including earlier rounds
export function RequisitionHistory({ view }: { view: RequisitionView }) {
  const decisions = view.decisions.filter((d) => d.round < view.round);
  return (
    <div className="space-y-4">
      <ol className="space-y-2 text-sm">
        {view.history.map((h, i) => (
          <li key={i} className="flex flex-wrap gap-x-3 border-b pb-2 last:border-0">
            <span className="text-muted-foreground">{when(h.at)}</span>
            <span className="font-medium">{h.to.replace(/_/g, " ")}</span>
            {h.by && <span className="text-muted-foreground">by {h.by}</span>}
            {h.reason && <span className="w-full whitespace-pre-wrap">{h.reason}</span>}
          </li>
        ))}
      </ol>
      {decisions.length > 0 && (
        <div>
          <div className="mb-1 text-sm font-medium">Decisions in earlier rounds</div>
          <ul className="space-y-1 text-sm">
            {decisions.map((d, i) => (
              <li key={i} className="rounded border p-2"><strong>Round {d.round} · {STAGE_LABEL[d.stage_key]}</strong>: {DECISION_LABEL[d.decision] ?? d.decision}{d.gl_code ? ` (GL ${d.gl_code})` : ""} · {d.by} · {when(d.at)}{d.comments && <div className="whitespace-pre-wrap">{d.comments}</div>}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
