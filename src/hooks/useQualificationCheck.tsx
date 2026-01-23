import { useMemo } from "react";
import { useEntryRequirements, useCalculatePoints } from "./useEntryRequirements";
import { SchoolSubject, QualificationResult } from "@/types/application";

interface UseQualificationCheckProps {
  tradeId: string;
  level: number;
  subjects: SchoolSubject[];
  dateOfBirth: string;
  highestGradePassed: number;
  hasWorkExperience?: boolean;
  yearsOfExperience?: number;
}

export const useQualificationCheck = ({
  tradeId,
  level,
  subjects,
  dateOfBirth,
  highestGradePassed,
  hasWorkExperience = false,
  yearsOfExperience = 0,
}: UseQualificationCheckProps): QualificationResult => {
  const { data: requirements } = useEntryRequirements(tradeId, level);
  const { calculatePoints, symbolPoints } = useCalculatePoints();

  return useMemo(() => {
    const result: QualificationResult = {
      qualified: false,
      calculated_points: 0,
      reasons: [],
      age_years: 0,
      is_mature_age: false,
    };

    // Calculate age
    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      result.age_years = age;
      result.is_mature_age = age >= 23;
    }

    // Calculate points
    result.calculated_points = calculatePoints(subjects);

    // If no requirements found, can't determine qualification
    if (!requirements || requirements.length === 0) {
      result.reasons.push("No entry requirements found for this trade and level");
      return result;
    }

    const requirement = requirements[0];

    // Check if mature age entry applies
    if (result.is_mature_age && requirement.mature_age_entry) {
      const matureMinAge = requirement.mature_min_age || 23;
      const matureMinExp = requirement.mature_min_experience_years || 3;

      if (result.age_years >= matureMinAge) {
        if (hasWorkExperience && yearsOfExperience >= matureMinExp) {
          result.qualified = true;
          result.reasons.push(`Qualified via Mature Age Entry (${result.age_years} years old, ${yearsOfExperience} years experience)`);
          return result;
        } else if (!hasWorkExperience || yearsOfExperience < matureMinExp) {
          result.reasons.push(`Mature age entry requires ${matureMinExp}+ years of relevant work experience`);
        }
      }
    }

    // Check previous level requirement
    if (requirement.requires_previous_level) {
      result.reasons.push(`Requires completion of Level ${requirement.previous_level_required}`);
      // This would need to check previous enrollment data
    }

    // Check grade requirement
    if (requirement.min_grade) {
      if (highestGradePassed < requirement.min_grade) {
        result.reasons.push(`Minimum Grade ${requirement.min_grade} required (you have Grade ${highestGradePassed})`);
      }
    }

    // Check points requirement
    if (requirement.min_points) {
      if (result.calculated_points < requirement.min_points) {
        result.reasons.push(`Minimum ${requirement.min_points} points required (you have ${result.calculated_points})`);
      }
    }

    // Helper function to compare symbols (lower is better: A* > A > B > C > D > E > F > G > U)
    const symbolOrder = ['A*', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'U'];
    const compareSymbols = (required: string, actual: string): boolean => {
      const reqIndex = symbolOrder.indexOf(required);
      const actIndex = symbolOrder.indexOf(actual);
      if (reqIndex === -1 || actIndex === -1) return false;
      return actIndex <= reqIndex; // Actual must be equal or better (lower index)
    };

    // Find subject symbols
    const getSubjectSymbol = (subjectNames: string[]): string | null => {
      for (const name of subjectNames) {
        const subject = subjects.find(s => 
          s.subject_name.toLowerCase().includes(name.toLowerCase())
        );
        if (subject) return subject.symbol;
      }
      return null;
    };

    // Check English symbol
    if (requirement.english_symbol) {
      const englishSymbol = getSubjectSymbol(['english', 'english language', 'english first', 'english second']);
      if (!englishSymbol) {
        result.reasons.push(`English subject required with minimum symbol ${requirement.english_symbol}`);
      } else if (!compareSymbols(requirement.english_symbol, englishSymbol)) {
        result.reasons.push(`English: ${requirement.english_symbol} or better required (you have ${englishSymbol})`);
      }
    }

    // Check Maths symbol
    if (requirement.maths_symbol) {
      const mathsSymbol = getSubjectSymbol(['mathematics', 'maths', 'math', 'core mathematics']);
      if (!mathsSymbol) {
        result.reasons.push(`Mathematics subject required with minimum symbol ${requirement.maths_symbol}`);
      } else if (!compareSymbols(requirement.maths_symbol, mathsSymbol)) {
        result.reasons.push(`Mathematics: ${requirement.maths_symbol} or better required (you have ${mathsSymbol})`);
      }
    }

    // Check Science symbol
    if (requirement.science_symbol) {
      const scienceSymbol = getSubjectSymbol(['physical science', 'science', 'physics', 'chemistry', 'biology']);
      if (!scienceSymbol) {
        result.reasons.push(`Science subject required with minimum symbol ${requirement.science_symbol}`);
      } else if (!compareSymbols(requirement.science_symbol, scienceSymbol)) {
        result.reasons.push(`Science: ${requirement.science_symbol} or better required (you have ${scienceSymbol})`);
      }
    }

    // Check Pre-vocational symbol
    if (requirement.prevocational_symbol) {
      const prevoSymbol = getSubjectSymbol(['prevocational', 'pre-vocational', 'technical']);
      if (prevoSymbol && !compareSymbols(requirement.prevocational_symbol, prevoSymbol)) {
        result.reasons.push(`Pre-vocational: ${requirement.prevocational_symbol} or better required (you have ${prevoSymbol})`);
      }
    }

    // Determine final qualification status
    if (result.reasons.length === 0) {
      result.qualified = true;
      result.reasons.push("Meets all entry requirements");
    }

    return result;
  }, [requirements, subjects, dateOfBirth, highestGradePassed, hasWorkExperience, yearsOfExperience, calculatePoints]);
};
