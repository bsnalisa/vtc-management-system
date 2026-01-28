import { supabase } from "@/integrations/supabase/client";
import { clearRoleCache } from "@/hooks/useUserRole";
import { clearProfileCache } from "@/hooks/useProfile";
import { QueryClient } from "@tanstack/react-query";

/**
 * Sign out the user and clear all caches
 * This ensures no data from the previous user persists
 */
export const signOutAndClearCaches = async (queryClient: QueryClient) => {
  // Clear all role and profile caches
  clearRoleCache();
  clearProfileCache();
  
  // Clear all React Query caches to prevent stale data
  queryClient.clear();
  
  // Sign out from Supabase
  await supabase.auth.signOut();
};
