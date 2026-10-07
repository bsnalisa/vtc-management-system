import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface DashboardStat {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: "primary" | "secondary" | "accent" | "destructive";
  loading?: boolean;
  progress?: number;
}

export interface DashboardAction {
  icon: LucideIcon;
  label: string;
  desc: string;
  url: string;
  badge?: number | string;
}

interface DashboardShellProps {
  greeting?: string;
  name?: string;
  heroIcon: LucideIcon;
  heroSubtitle: string;
  stats?: DashboardStat[];
  actions?: DashboardAction[];
  actionCols?: 3 | 4 | 5 | 6;
  children?: ReactNode;
}

const toneRing: Record<NonNullable<DashboardStat["tone"]>, string> = {
  primary: "bg-primary/10",
  secondary: "bg-secondary/20",
  accent: "bg-accent/30",
  destructive: "bg-destructive/10",
};

const toneIcon: Record<NonNullable<DashboardStat["tone"]>, string> = {
  primary: "text-primary",
  secondary: "text-muted-foreground",
  accent: "text-muted-foreground",
  destructive: "text-destructive",
};

function greetingText() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardShell({
  greeting,
  name,
  heroIcon: HeroIcon,
  heroSubtitle,
  stats = [],
  actions = [],
  actionCols = 5,
  children,
}: DashboardShellProps) {
  const navigate = useNavigate();
  const salutation = greeting ?? greetingText();

  const colClass =
    actionCols === 6 ? "lg:grid-cols-6" :
    actionCols === 5 ? "lg:grid-cols-5" :
    actionCols === 4 ? "lg:grid-cols-4" :
    "lg:grid-cols-3";

  const statColClass =
    stats.length >= 4 ? "lg:grid-cols-4" :
    stats.length === 3 ? "lg:grid-cols-3" :
    stats.length === 2 ? "lg:grid-cols-2" :
    "lg:grid-cols-1";

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="pb-2">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <HeroIcon className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">
              {salutation}{name ? `, ${name}` : ""}
            </h1>
            <p className="text-muted-foreground mt-0.5">{heroSubtitle}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats.length > 0 && (
        <div className={`grid gap-4 sm:grid-cols-2 ${statColClass}`}>
          {stats.map((s) => {
            const Icon = s.icon;
            const tone = s.tone ?? "primary";
            return (
              <Card key={s.label} className="relative overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                  <Icon className={`h-4 w-4 ${toneIcon[tone]}`} />
                </CardHeader>
                <CardContent>
                  {s.loading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <div className="text-3xl font-bold">{s.value}</div>
                  )}
                  {s.hint && <p className="text-xs text-muted-foreground mt-1">{s.hint}</p>}
                  {typeof s.progress === "number" && (
                    <Progress value={s.progress} className="h-1.5 mt-2" />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Quick Actions */}
      {actions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
          <div className={`grid gap-3 sm:grid-cols-2 ${colClass}`}>
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <Button
                  variant="workspace"
                  key={a.url + a.label}
                  onClick={() => navigate(a.url)}
                  className="gap-3 rounded-lg p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-sm">{a.label}</p>
                      {a.badge !== undefined && a.badge !== 0 && a.badge !== "" && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs">{a.badge}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{a.desc}</p>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
