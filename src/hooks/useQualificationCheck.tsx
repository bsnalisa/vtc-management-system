import { useMemo } from "react";
import { useAdmissionRules, useCalculatePoints, AdmissionRule } from "./useEntryRequirements";
import { SchoolSubject, QualificationResult } from "@/types/application";

interface UseQualificationCheckProps {
  tradeId: string;
  level: number;
  subjects: SchoolSubject[];
  dateOfBirth: string;
  highestGradePassed: number;
  hasWorkExperience?: boolean;
  yearsOfExperience?: number;
  /** The centre being applied to (applicants have no centre of their own) */
  organizationId?: string;
}

// Lower is better: A* > A > B > C > D > E > F > G > U
const SYMBOL_ORDER = ["A*", "A", "B", "C", "D", "E", "F", "G", "U"];
const meets = (required: string, actual: string) => {
  const r = SYMBOL_ORDER.indexOf(required);
  const a = SYMBOL_ORDER.indexOf(actual);
  return r !== -1 && a !== -1 && a <= r;
};

const SUBJECT_NAMES = {
  English: ["english", "english language", "english first", "english second"],
  Mathematics: ["mathematics", "maths", "math", "core mathematics"],
  Science: ["physical science", "science", "physics", "chemistry", "biology"],
  "Pre-vocational": ["prevocational", "pre-vocational", "technical"],
} as const;

// Works out whether one rule is met. Returns what is missing (empty when the rule is met) and any notes.
const checkRule = (rule: AdmissionRule, subjects: SchoolSubject[], points: number, grade: number) => {
  const missing: string[] = [];
  const notes: string[] = [];

  const symbolOf = (names: readonly string[]) => {
    const found = subjects.find((s) => names.some((n) => s.subject_name.toLowerCase().includes(n.toLowerCase())));
    return found ? found.symbol : null;
  };

  if (rule.min_grade && grade < rule.min_grade) missing.push(`Minimum Grade ${rule.min_grade} required (you have Grade ${grade || "–"})`);
  if (rule.min_points && points < rule.min_points) missing.push(`Minimum ${rule.min_points} points required (you have ${points})`);

  const bySymbol: [string, string | null, readonly string[]][] = [
    ["English", rule.english_symbol, SUBJECT_NAMES.English],
    ["Mathematics", rule.maths_symbol, SUBJECT_NAMES.Mathematics],
    ["Science", rule.science_symbol, SUBJECT_NAMES.Science],
  ];
  for (const [label, required, names] of bySymbol) {
    if (!required) continue;
    const actual = symbolOf(names);
    if (!actual) missing.push(`${label} required with at least ${required}`);
    else if (!meets(required, actual)) missing.push(`${label}: ${required} or better required (you have ${actual})`);
  }
  if (rule.prevocational_symbol) {
    const actual = symbolOf(SUBJECT_NAMES["Pre-vocational"]);
    if (actual && !meets(rule.prevocational_symbol, actual)) missing.push(`Pre-vocational: ${rule.prevocational_symbol} or better required (you have ${actual})`);
  }
  for (const need of rule.required_subjects ?? []) {
    const found = subjects.find((s) => s.subject_name.toLowerCase().includes(need.subject.toLowerCase()));
    if (!found) missing.push(`${need.subject} required with at least ${need.symbol}`);
    else if (!meets(need.symbol, found.symbol)) missing.push(`${need.subject}: ${need.symbol} or better required (you have ${found.symbol})`);
  }
  if (rule.requires_previous_level && rule.previous_level_required) {
    notes.push(`Bring your Level ${rule.previous_level_required} trade certificate or relevant results; the registration officer will check them.`);
  }
  return { missing, notes };
};

export const useQualificationCheck = ({
  tradeId,
  level,
  subjects,
  dateOfBirth,
  highestGradePassed,
  hasWorkExperience = false,
  yearsOfExperience = 0,
  organizationId,
}: UseQualificationCheckProps): QualificationResult => {
  const { data: rules } = useAdmissionRules(tradeId, level, organizationId);
  const { calculatePoints } = useCalculatePoints(organizationId);

  return useMemo(() => {
    const result: QualificationResult = { qualified: false, calculated_points: 0, reasons: [], age_years: 0, is_mature_age: false };

    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
      result.age_years = age;
      result.is_mature_age = age >= 23;
    }
    result.calculated_points = calculatePoints(subjects);

    if (!rules || rules.length === 0) {
      result.reasons.push("No entry requirements found for this trade and level");
      return result;
    }

    // Mature age entry, where a rule allows it
    for (const rule of rules) {
      if (result.is_mature_age && rule.mature_age_entry && result.age_years >= (rule.mature_min_age || 23)) {
        const minExp = rule.mature_min_experience_years || 3;
        if (hasWorkExperience && yearsOfExperience >= minExp) {
          result.qualified = true;
          result.reasons.push(`Qualified via Mature Age Entry (${result.age_years} years old, ${yearsOfExperience} years experience)`);
          return result;
        }
      }
    }

    // Several rules are alternatives: meeting any one is enough
    const checked = rules.map((rule) => ({ rule, ...checkRule(rule, subjects, result.calculated_points, highestGradePassed) }));
    const met = checked.find((c) => c.missing.length === 0);
    if (met) {
      result.qualified = true;
      result.reasons.push(`Meets the entry requirements: ${met.rule.requirement_name}`);
      result.reasons.push(...met.notes);
      if (met.rule.requires_previous_level && met.rule.previous_level_required) result.previous_level_proof_needed = met.rule.previous_level_required;
      return result;
    }

    const closest = checked.reduce((a, b) => (b.missing.length < a.missing.length ? b : a));
    if (checked.length > 1) result.reasons.push(`Closest requirement: ${closest.rule.requirement_name}`);
    result.reasons.push(...closest.missing);
    if (result.is_mature_age && rules.some((r) => r.mature_age_entry)) {
      result.reasons.push("Mature age entry needs relevant work experience (see the Employment tab)");
    }
    return result;
  }, [rules, subjects, dateOfBirth, highestGradePassed, hasWorkExperience, yearsOfExperience, calculatePoints]);
};
