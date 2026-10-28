import { Navigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
import { LoadingSpinner } from "@/components/ui/loading-spinner";

// Approval tasks and requests point at a workflow instance; this finds the requisition it belongs to
export default function RequisitionByInstance() {
  const { instanceId } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["requisition-by-instance", instanceId],
    enabled: !!instanceId,
    queryFn: async () => {
      const { data: row } = await db.from("purchase_requisitions").select("id").eq("workflow_instance_id", instanceId).maybeSingle();
      return row?.id as string | undefined;
    },
  });
  if (isLoading) return <LoadingSpinner text="Opening the requisition..." className="py-8" />;
  return <Navigate to={data ? `/requisitions/${data}` : "/requisitions"} replace />;
}
