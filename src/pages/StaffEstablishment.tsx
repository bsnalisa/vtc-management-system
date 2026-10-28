import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ButtonSpinner, LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { withRoleAccess } from "@/components/withRoleAccess";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// The approved posts of the centre. The Centre Manager's dashboard compares them with the people who hold each role.
function StaffEstablishment() {
  const { navItems, groupLabel } = useRoleNavigation();
  const { organizationId } = useOrganizationContext();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [role, setRole] = useState("");
  const [title, setTitle] = useState("");
  const [posts, setPosts] = useState("1");
  const roles = useQuery({ queryKey: ["establishment-roles"], queryFn: async () => { const { data, error } = await db.from("custom_roles").select("role_code, role_name").eq("active", true).order("role_name"); if (error) throw error; return data as { role_code: string; role_name: string }[]; } });
  const list = useQuery({ queryKey: ["establishment", organizationId], enabled: !!organizationId, queryFn: async () => { const { data, error } = await db.from("staff_establishment").select("role, post_title, approved_posts").eq("organization_id", organizationId).order("post_title"); if (error) throw error; return data as { role: string; post_title: string; approved_posts: number }[]; } });
  const save = useMutation({
    mutationFn: async () => { const { error } = await db.rpc("save_staff_establishment", { _org: organizationId, _role: role, _post_title: title, _approved: Number(posts), _notes: null }); if (error) throw error; },
    onSuccess: () => { toast({ title: "Post saved" }); setTitle(""); qc.invalidateQueries({ queryKey: ["establishment"] }); },
    onError: (e: Error) => toast({ title: "Not saved", description: e.message, variant: "destructive" }),
  });
  return (
    <DashboardLayout title="Staff establishment" subtitle="Approved posts at this centre" navItems={navItems} groupLabel={groupLabel}>
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader><CardTitle>Add or change a post</CardTitle><CardDescription>Saving a role again replaces its post title and number of approved posts.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-[1fr_1fr_6rem_auto] sm:items-end">
            <div className="space-y-1"><Label htmlFor="er">Role</Label>
              <select id="er" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={role} onChange={(e) => setRole(e.target.value)}><option value="">Choose a role</option>{(roles.data ?? []).map((r) => <option key={r.role_code} value={r.role_code}>{r.role_name}</option>)}</select></div>
            <div className="space-y-1"><Label htmlFor="et">Post title</Label><Input id="et" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></div>
            <div className="space-y-1"><Label htmlFor="ep">Posts</Label><Input id="ep" inputMode="numeric" value={posts} onChange={(e) => setPosts(e.target.value)} /></div>
            <Button disabled={!role || !title.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending && <ButtonSpinner />}Save</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Approved posts</CardTitle></CardHeader>
          <CardContent>
            {list.isLoading ? <LoadingSpinner text="Loading..." /> : (list.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No posts have been entered yet.</p> : (
              <Table><TableHeader><TableRow><TableHead>Post</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Approved posts</TableHead></TableRow></TableHeader>
                <TableBody>{(list.data ?? []).map((e) => <TableRow key={e.role}><TableCell>{e.post_title}</TableCell><TableCell className="capitalize">{e.role.replace(/_/g, " ")}</TableCell><TableCell className="text-right">{e.approved_posts}</TableCell></TableRow>)}</TableBody></Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
export default withRoleAccess(StaffEstablishment, { requiredRoles: ["hr_officer"] });
