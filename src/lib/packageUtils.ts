/**
 * Utility functions for package and module access management
 */

export interface PackageLimits {
  max_trainees: number | null;
  max_trainers: number | null;
  max_classes: number | null;
  max_storage_mb: number | null;
}

/**
 * Check if a module is accessible based on package module_access array
 */
export const hasModuleAccess = (
  moduleAccess: string[] | null,
  moduleCode: string
): boolean => {
  if (!moduleAccess) return false;
  return moduleAccess.includes(moduleCode);
};

/**
 * Check if current count is within package limits
 * Returns true if within limits or if limit is unlimited (null)
 */
export const isWithinLimit = (
  limits: PackageLimits | null,
  limitType: keyof PackageLimits,
  currentCount: number
): boolean => {
  if (!limits) return true;
  
  const limit = limits[limitType];
  
  // null means unlimited
  if (limit === null) return true;
  
  return currentCount < limit;
};

/**
 * Get remaining capacity for a specific limit
 */
export const getRemainingCapacity = (
  limits: PackageLimits | null,
  limitType: keyof PackageLimits,
  currentCount: number
): number | null => {
  if (!limits) return null;
  
  const limit = limits[limitType];
  
  // null means unlimited
  if (limit === null) return null;
  
  return Math.max(0, limit - currentCount);
};

/**
 * Calculate days remaining in trial/subscription
 */
export const getDaysRemaining = (endDate: string | null): number | null => {
  if (!endDate) return null;
  
  const end = new Date(endDate);
  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
};

/**
 * Check if package is expired
 */
export const isPackageExpired = (endDate: string | null): boolean => {
  if (!endDate) return false;
  
  const end = new Date(endDate);
  const now = new Date();
  
  return now > end;
};

/**
 * Format package price for display
 */
export const formatPackagePrice = (
  price: number,
  currency: string = "USD",
  billingCycle: string = "monthly"
): string => {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(price);
  
  if (price === 0) return "Free";
  
  return `${formatted}/${billingCycle}`;
};

/**
 * Get upgrade path recommendation
 */
export const getUpgradeRecommendation = (
  currentPackage: string,
  reason: "trainee_limit" | "trainer_limit" | "class_limit" | "feature_access"
): string => {
  const recommendations: Record<string, Record<string, string>> = {
    Basic: {
      trainee_limit: "Upgrade to Extended for 200 trainees",
      trainer_limit: "Upgrade to Extended for 20 trainers",
      class_limit: "Upgrade to Extended for 50 classes",
      feature_access: "Upgrade to Extended or Professional for advanced features",
    },
    Extended: {
      trainee_limit: "Upgrade to Professional for unlimited trainees",
      trainer_limit: "Upgrade to Professional for unlimited trainers",
      class_limit: "Upgrade to Professional for unlimited classes",
      feature_access: "Upgrade to Professional for all features",
    },
  };
  
  return recommendations[currentPackage]?.[reason] || "Consider upgrading your package";
};

/**
 * Module codes mapping for easy reference
 */
export const MODULE_CODES = {
  TRAINEE_MANAGEMENT: "trainee_management",
  TRAINER_MANAGEMENT: "trainer_management",
  CLASS_MANAGEMENT: "class_management",
  ATTENDANCE_TRACKING: "attendance_tracking",
  FEE_MANAGEMENT: "fee_management",
  ASSESSMENT_MANAGEMENT: "assessment_management",
  TIMETABLE_MANAGEMENT: "timetable_management",
  DOCUMENT_GENERATION: "document_generation",
  BASIC_REPORTING: "basic_reporting",
  ADVANCED_REPORTING: "advanced_reporting",
  API_ACCESS: "api_access",
} as const;
