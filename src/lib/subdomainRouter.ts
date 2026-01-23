import { supabase } from "@/integrations/supabase/client";

export interface SubdomainInfo {
  subdomain: string | null;
  isSubdomain: boolean;
  organizationId: string | null;
  organizationName: string | null;
}

const RESERVED_SUBDOMAINS = [
  'www', 'api', 'admin', 'dashboard', 'app',
  'mail', 'ftp', 'localhost', 'staging',
  'dev', 'test', 'demo', 'beta', 'docs',
  'support', 'help', 'blog', 'cdn', 'static',
];

/**
 * Detects if current request is on a subdomain and fetches organization
 */
export async function getSubdomainInfo(): Promise<SubdomainInfo> {
  const hostname = window.location.hostname;
  
  // Development environments
  if (hostname === 'localhost' || hostname.includes('127.0.0.1') || hostname.includes('192.168')) {
    return { subdomain: null, isSubdomain: false, organizationId: null, organizationName: null };
  }
  
  // Lovable preview environments
  if (hostname.includes('lovable.app') || hostname.includes('lovable.dev')) {
    return { subdomain: null, isSubdomain: false, organizationId: null, organizationName: null };
  }
  
  // Parse hostname parts
  const parts = hostname.split('.');
  
  // Root domain (nvtc.app or example.com)
  if (parts.length === 2) {
    return { subdomain: null, isSubdomain: false, organizationId: null, organizationName: null };
  }
  
  // Subdomain detected (org.nvtc.app)
  if (parts.length >= 3) {
    const subdomain = parts[0];
    
    // Check if reserved
    if (RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase())) {
      return { subdomain, isSubdomain: false, organizationId: null, organizationName: null };
    }
    
    try {
      // Fetch organization by subdomain - using type assertion to avoid TS inference issues
      const result = await supabase
        .from('organizations')
        .select('id, name, active')
        .eq('subdomain', subdomain)
        .maybeSingle() as { data: { id: string; name: string; active: boolean } | null; error: any };
      
      if (result.error || !result.data || !result.data.active) {
        console.warn(`Organization not found or inactive for subdomain: ${subdomain}`);
        return { subdomain, isSubdomain: true, organizationId: null, organizationName: null };
      }
      
      return {
        subdomain,
        isSubdomain: true,
        organizationId: result.data.id,
        organizationName: result.data.name,
      };
    } catch (error) {
      console.error('Error fetching subdomain organization:', error);
      return { subdomain, isSubdomain: true, organizationId: null, organizationName: null };
    }
  }
  
  return { subdomain: null, isSubdomain: false, organizationId: null, organizationName: null };
}

/**
 * Validates subdomain format
 */
export function isValidSubdomain(subdomain: string): boolean {
  // RFC 1123 hostname rules
  const pattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
  
  if (subdomain.length < 3 || subdomain.length > 63) {
    return false;
  }
  
  if (RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase())) {
    return false;
  }
  
  return pattern.test(subdomain);
}

/**
 * Generates subdomain from organization name
 */
export function generateSubdomain(organizationName: string): string {
  return organizationName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Remove consecutive hyphens
    .replace(/^-+|-+$/g, '') // Trim hyphens
    .substring(0, 63); // Limit to 63 chars
}

/**
 * Check if subdomain is available
 */
export async function checkSubdomainAvailability(subdomain: string): Promise<{
  available: boolean;
  reason?: string;
}> {
  if (!isValidSubdomain(subdomain)) {
    return {
      available: false,
      reason: 'Invalid subdomain format. Use only lowercase letters, numbers, and hyphens.',
    };
  }
  
  const { data } = await supabase
    .from('organizations')
    .select('id')
    .eq('subdomain', subdomain)
    .maybeSingle();
  
  if (data) {
    return {
      available: false,
      reason: 'This subdomain is already taken.',
    };
  }
  
  return { available: true };
}
