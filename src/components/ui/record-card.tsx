import { ReactNode } from "react";

export function RecordCard({ title, subtitle, status, fields, actions }: {
  title: string;
  subtitle: string;
  status?: ReactNode;
  fields: { label: string; value: ReactNode }[];
  actions?: ReactNode;
}) {
  return <article className="min-w-0 rounded-lg border bg-card p-4 text-card-foreground">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0"><h3 className="break-words font-semibold">{title}</h3><p className="mt-1 break-words text-xs text-muted-foreground">{subtitle}</p></div>
      {status}
    </div>
    <dl className="mt-4 grid gap-3 text-sm">
      {fields.map(field => <div key={field.label} className="min-w-0"><dt className="text-xs text-muted-foreground">{field.label}</dt><dd className="mt-1 whitespace-normal break-words">{field.value ?? "—"}</dd></div>)}
    </dl>
    {actions && <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">{actions}</div>}
  </article>;
}