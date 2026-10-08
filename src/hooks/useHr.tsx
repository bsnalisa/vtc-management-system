// Single entry point for the HR hooks; the implementations are split by area to stay readable.
export * from "./useHrPeople";
export * from "./useHrLeave";
export * from "./useHrRecruitment";

export const labelOf = (code: string | null | undefined) =>
  code ? code.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "-";

/** Format an ISO date or timestamp for display. */
export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString() : "-";
