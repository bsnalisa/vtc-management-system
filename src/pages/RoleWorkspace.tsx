import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingIndicator } from "@/components/ui/loading-spinner";
import { useRoleNavigation } from "@/hooks/useRoleNavigation";
import { useOrganizationContext } from "@/hooks/useOrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Briefcase, Search, ArrowRight, Info } from "lucide-react";

type Workspace = { title: string; description: string; source?: "employers" | "library_items" | "library_borrowing" | "public_rpl_applications"; limitation?: string };
export const roleWorkspaces: Record<string, Workspace> = {
  "/projects": { title: "Projects", description: "Centre project register and delivery overview.", limitation: "A persistent project register is not configured yet. Project creation, budgets and tracking require a dedicated records module." },
  "/projects/milestones": { title: "Milestones", description: "Project delivery checkpoints and due dates.", limitation: "Milestone tracking requires a persistent project register. No live milestone records are available in this system yet." },
  "/hr/employees": { title: "Employees", description: "Centre staff directory and employment information.", limitation: "A dedicated employee register is not configured. User accounts are not employment records; staff contracts and employment details require an HR records module." },
  "/hr/leave": { title: "Leave Management", description: "Staff leave requests, balances and approvals.", limitation: "Leave requests and balances do not yet have a persistent records module. Leave cannot be submitted or approved here yet." },
  "/hr/recruitment": { title: "Recruitment", description: "Centre staff vacancies and applicant tracking.", limitation: "Staff recruitment records are not configured. Existing placement vacancies are for trainees, not staff recruitment." },
  "/hr/performance": { title: "Performance", description: "Staff appraisal periods and review records.", limitation: "Staff performance reviews require a dedicated HR records module. Academic results and supplier ratings are not staff appraisals." },
  "/bdl/courses": { title: "Blended Courses", description: "Blended and distance-learning course delivery.", limitation: "BDL course delivery records are not configured. The existing academic course catalogue does not identify blended delivery courses." },
  "/bdl/materials": { title: "Learning Materials", description: "Browse centre library resources available to support learning.", source: "library_items", limitation: "These are library resources, not BDL course assignments. Course-to-material linking is not configured yet." },
  "/bdl/sessions": { title: "Virtual Sessions", description: "Online teaching sessions and meeting details.", limitation: "Virtual session records and meeting links are not configured. Staff login sessions are not teaching sessions." },
  "/bdl/progress": { title: "Trainee Progress", description: "Progress through blended and distance-learning courses.", limitation: "BDL trainee progress tracking is not configured. Staff onboarding completions are not trainee course progress." },
  "/rpl/applications": { title: "Applications", description: "Review prior-learning applications submitted to your centre.", source: "public_rpl_applications" },
  "/rpl/portfolio": { title: "Portfolio Assessment", description: "Prior-learning evidence and portfolio assessment.", limitation: "A linked RPL evidence and portfolio assessment register is not configured. No portfolio assessment decisions can be recorded here yet." },
  "/rpl/schedule": { title: "Assessment Schedule", description: "RPL assessment appointments and assessor allocation.", limitation: "RPL appointment scheduling is not configured. General training timetables are not RPL assessment appointments." },
  "/rpl/credits": { title: "Credit Mapping", description: "Map recognised prior learning to qualification credits.", limitation: "RPL credit decisions and evidence mapping are not configured. Grading symbols do not represent recognised credit awards." },
  "/liaison/partners": { title: "Industry Partners", description: "Browse employer contacts registered with your centre.", source: "employers" },
  "/resource-center/catalogue": { title: "Resource Catalogue", description: "Browse learning resources held by your centre.", source: "library_items" },
  "/resource-center/loans": { title: "Resource Loans", description: "Review the centre’s recorded resource borrowing and return dates.", source: "library_borrowing" },
};

type RecordCard = { id: string; title: string; details: string; status: string; date?: string; notes?: string };

export default function RoleWorkspace() {
  const { pathname } = useLocation();
  const config = roleWorkspaces[pathname];
  const { navItems, groupLabel, role, dashboardPath } = useRoleNavigation();
  const { organizationId, loading: organizationLoading } = useOrganizationContext();
  const [search, setSearch] = useState("");
  const records = useQuery({
    queryKey: ["role-workspace", config?.source, organizationId, role],
    enabled: !!organizationId && !!config?.source,
    queryFn: async (): Promise<RecordCard[]> => {
      if (!organizationId) return [];
      switch (config.source) {
        case "employers": {
          const { data, error } = await supabase.from("employers").select("id,name,industry,contact_person,contact_email,contact_phone,active").eq("organization_id", organizationId).order("name");
          if (error) throw error;
          return data.map(row => ({ id: row.id, title: row.name, details: [row.industry, row.contact_person, row.contact_email, row.contact_phone].filter(Boolean).join(" · "), status: row.active ? "Active" : "Inactive" }));
        }
        case "library_items": {
          const { data, error } = await supabase.from("library_items").select("id,title,author,item_type,available_copies,total_copies,active").eq("organization_id", organizationId).order("title");
          if (error) throw error;
          return data.map(row => ({ id: row.id, title: row.title, details: [row.author, row.item_type.replaceAll("_", " "), `${row.available_copies} of ${row.total_copies} copies available`].filter(Boolean).join(" · "), status: row.active ? "Active" : "Inactive" }));
        }
        case "library_borrowing": {
          const { data, error } = await supabase.from("library_borrowing").select("id,due_date,borrow_date,status,library_items(title)").eq("organization_id", organizationId).order("borrow_date", { ascending: false });
          if (error) throw error;
          return data.map(row => ({ id: row.id, title: row.library_items?.title || "Resource loan", details: `Borrowed ${row.borrow_date} · Due ${row.due_date}`, status: row.status.replaceAll("_", " ") }));
        }
        case "public_rpl_applications": {
          const { data, error } = await supabase.from("public_rpl_applications").select("id,reference_number,applicant_name,occupation,years_experience,status,created_at,motivation,staff_notes").eq("organization_id", organizationId).order("created_at", { ascending: false });
          if (error) throw error;
          return data.map(row => ({ id: row.id, title: `${row.reference_number} — ${row.applicant_name}`, details: [row.occupation, row.years_experience != null ? `${row.years_experience} years’ experience` : null].filter(Boolean).join(" · "), status: row.status, date: row.created_at, notes: row.motivation }));
        }
        default: return [];
      }
    },
  });
  if (!config) return null;
  const filtered = records.data?.filter(row => `${row.title} ${row.details} ${row.status}`.toLowerCase().includes(search.toLowerCase())) || [];
  return (
    <DashboardLayout title={config.title} subtitle={config.description} navItems={navItems} groupLabel={groupLabel}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant="secondary">{config.source ? "Centre records · Read only" : "Setup required"}</Badge>
          <Button variant="outline" asChild><Link to={dashboardPath}>Back to dashboard</Link></Button>
        </div>
        {config.limitation && <Card><CardContent className="flex items-start gap-3 p-5"><Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p className="text-sm text-muted-foreground">{config.limitation}</p></CardContent></Card>}
        {config.source ? <Card>
          <CardHeader className="gap-3"><CardTitle className="text-lg">{config.title}</CardTitle><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search records" aria-label={`Search ${config.title.toLowerCase()}`} className="pl-9" /></div></CardHeader>
          <CardContent className="space-y-3">
            {organizationLoading || (organizationId && records.isPending) ? <LoadingIndicator label="Loading centre records" /> : !organizationId ? <p className="text-sm text-muted-foreground">Select a centre context to view its records.</p> : records.isError ? <div role="alert" className="space-y-3"><p>Records could not be loaded. Your existing centre permissions still apply.</p><Button variant="outline" onClick={() => records.refetch()}>Retry</Button></div> : filtered.length === 0 ? <p className="py-6 text-center text-muted-foreground">{search ? "No matching records." : "No records are available to your account in this centre."}</p> : filtered.map(row => <article key={row.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><h2 className="min-w-0 break-words font-semibold">{row.title}</h2><Badge variant="outline" className="max-w-full whitespace-normal capitalize">{row.status}</Badge></div><p className="mt-2 break-words text-sm text-muted-foreground">{row.details}</p>{row.date && <p className="mt-1 text-xs text-muted-foreground">Submitted {new Date(row.date).toLocaleDateString()}</p>}{row.notes && <details className="mt-3 text-sm"><summary className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Application motivation</summary><p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{row.notes}</p></details>}</article>)}
          </CardContent>
        </Card> : <Card><CardHeader><CardTitle className="text-lg">This workspace needs live records</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">No demonstration records are shown. Contact your administrator to arrange the required module.</p><Button asChild><Link to="/support-tickets">Contact support<ArrowRight className="ml-2 h-4 w-4" /></Link></Button></CardContent></Card>}
      </div>
    </DashboardLayout>
  );
}

export function ServicesDashboard({ service }: { service: "liaison" | "resources" }) {
  const { navItems, groupLabel } = useRoleNavigation();
  const liaison = service === "liaison";
  return <DashboardLayout title={liaison ? "Liaison Officer Dashboard" : "Resource Centre Dashboard"} subtitle={liaison ? "Centre partnerships and staff communication." : "Centre learning resources and recorded borrowing."} navItems={navItems} groupLabel={groupLabel}>
    <div className="space-y-6"><Card className="border-primary/15 bg-primary/5"><CardContent className="p-6"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">{liaison ? <Briefcase /> : <BookOpen />}</div><h2 className="text-xl font-semibold">{liaison ? "Connect your centre" : "Support access to learning"}</h2><p className="mt-2 text-sm text-muted-foreground">{liaison ? "View registered industry contacts and use messages to coordinate with staff." : "Browse the centre catalogue and review existing resource loans."} Records remain subject to your centre’s existing access permissions.</p></CardContent></Card><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{navItems.filter(item => !item.url.endsWith("-dashboard")).map(item => <Link key={item.url} to={item.url} className="group min-w-0 rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><item.icon className="mb-3 h-5 w-5 text-primary" /><h2 className="break-words font-semibold">{item.title}</h2><span className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">Open workspace<ArrowRight className="h-4 w-4" /></span></Link>)}</div></div>
  </DashboardLayout>;
}