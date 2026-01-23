/**
 * Utility functions for organization-scoped operations
 * Auto-injects organization_id into CRUD operations
 */

export const withOrganizationId = <T extends Record<string, any>>(
  data: T,
  organizationId: string | null
): T & { organization_id: string } => {
  if (!organizationId) {
    throw new Error("Organization ID is required for this operation");
  }
  
  return {
    ...data,
    organization_id: organizationId,
  };
};

export const withOrganizationIdArray = <T extends Record<string, any>>(
  dataArray: T[],
  organizationId: string | null
): (T & { organization_id: string })[] => {
  if (!organizationId) {
    throw new Error("Organization ID is required for this operation");
  }
  
  return dataArray.map(data => ({
    ...data,
    organization_id: organizationId,
  }));
};

export const buildOrganizationFilter = (organizationId: string | null) => {
  if (!organizationId) {
    throw new Error("Organization ID is required for filtering");
  }
  
  return { organization_id: organizationId };
};
