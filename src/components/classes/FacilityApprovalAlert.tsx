import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";

// These functions are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface FacilitySummary { classes: number; buildings: number; rooms: number; rejected: number }

export const useFacilitySummary = (enabled = true) => {
  const { organizationId } = useOrganizationContext();
  return useQuery({
    queryKey: ["facility-summary", organizationId],
    enabled: enabled && !!organizationId,
    queryFn: async () => {
      const { data, error } = await db.rpc("facility_approval_summary", { _org: organizationId });
      if (error) throw error;
      return data as FacilitySummary;
    },
  });
};

// Shown to the Centre Manager (items to decide) and the Head of Training (items waiting or sent back)
export function FacilityApprovalAlert({ role, linkToClasses = false }: { role: "centre_manager" | "head_of_training"; linkToClasses?: boolean }) {
  const { data } = useFacilitySummary();
  if (!data) return null;
  const waiting = data.classes + data.buildings + data.rooms;
  if (!waiting && !(role === "head_of_training" && data.rejected)) return null;
  const parts = [data.classes && `${data.classes} class${data.classes === 1 ? "" : "es"}`, data.buildings && `${data.buildings} building${data.buildings === 1 ? "" : "s"} or workshop${data.buildings === 1 ? "" : "s"}`, data.rooms && `${data.rooms} room${data.rooms === 1 ? "" : "s"}`].filter(Boolean).join(", ");
  return (
    <Alert>
      <AlertDescription>
        {role === "centre_manager"
          ? <>Waiting for your approval: <strong>{parts}</strong>. {linkToClasses ? <Link to="/classes" className="underline">Open Classes</Link> : "Approve or reject them below."}</>
          : <>{waiting ? <>Waiting for the Centre Manager: <strong>{parts}</strong>. </> : null}{data.rejected ? <>{data.rejected} item{data.rejected === 1 ? " was" : "s were"} rejected; correct {data.rejected === 1 ? "it" : "them"} to send {data.rejected === 1 ? "it" : "them"} back for approval.</> : null}</>}
      </AlertDescription>
    </Alert>
  );
}
