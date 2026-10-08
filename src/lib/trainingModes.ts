// Single source of truth for training modes (database enum `training_mode`).
// fulltime is the conventional mode; the label keeps the spec's wording.
export const TRAINING_MODES = ["fulltime", "bdl", "shortcourse", "apprenticeship", "rpl"] as const;
export type TrainingMode = (typeof TRAINING_MODES)[number];

export const TRAINING_MODE_LABELS: Record<TrainingMode, string> = {
  fulltime: "Conventional (Full-time)",
  bdl: "Blended / Distance Learning",
  shortcourse: "Short Course",
  apprenticeship: "Apprenticeship",
  rpl: "Recognition of Prior Learning",
};

export const trainingModeLabel = (mode: string): string =>
  TRAINING_MODE_LABELS[mode as TrainingMode] ?? mode.replace(/_/g, " ");
