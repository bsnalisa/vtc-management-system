// Who is calling an edge function, and which centres may they act on?
//
// Edge functions use the service key, which bypasses row-level security, so each one has to apply the centre boundary
// itself. This helper does the common part: identify the caller, then answer "may they act on this centre?".
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

export type Caller =
  | { kind: 'service' }
  | { kind: 'user'; userId: string; platform: boolean; orgIds: string[]; roles: { organization_id: string | null; role: string }[] };

const PLATFORM_ROLES = ['super_admin', 'vms_developer', 'vms_support'];

// Constant-time comparison so a secret cannot be probed byte by byte
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

// Returns null when the request carries no usable identity (for example only the public anon key).
// 'service' means the platform's own scheduler or another function: the service key, or the shared job secret.
export async function identifyCaller(req: Request, admin: SupabaseClient): Promise<Caller | null> {
  const secret = Deno.env.get('DISPATCH_SECRET');
  const sent = req.headers.get('x-dispatch-secret');
  if (secret && sent && safeEqual(sent, secret)) return { kind: 'service' };

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceKey && safeEqual(token, serviceKey)) return { kind: 'service' };

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: rows } = await admin.from('user_roles').select('organization_id, role').eq('user_id', data.user.id);
  const roles = (rows ?? []) as { organization_id: string | null; role: string }[];
  return {
    kind: 'user',
    userId: data.user.id,
    platform: roles.some((r) => PLATFORM_ROLES.includes(r.role)),
    orgIds: [...new Set(roles.map((r) => r.organization_id).filter((o): o is string => !!o))],
    roles,
  };
}

// May this caller act on the given centre? Server callers and platform staff may act on any.
export function canActOnCentre(caller: Caller, orgId: string | null | undefined): boolean {
  if (caller.kind === 'service' || caller.platform) return true;
  return !!orgId && caller.orgIds.includes(orgId);
}

// Does the caller hold one of these roles at the centre? (platform staff and server callers always pass)
export function hasRoleAt(caller: Caller, orgId: string | null | undefined, roles: string[]): boolean {
  if (caller.kind === 'service' || caller.platform) return true;
  return !!orgId && caller.roles.some((r) => r.organization_id === orgId && roles.includes(r.role));
}

export function onlyServerOrPlatform(caller: Caller | null): boolean {
  return !!caller && (caller.kind === 'service' || caller.platform);
}

// Finance-style actions: the named roles at the centre, or an Organization Admin who has started an override.
export async function hasRoleOrOverride(
  admin: SupabaseClient, caller: Caller, orgId: string | null | undefined, roles: string[],
): Promise<boolean> {
  if (caller.kind === 'service' || caller.platform) return true;
  if (!orgId) return false;
  if (hasRoleAt(caller, orgId, roles)) return true;
  if (hasRoleAt(caller, orgId, ['organization_admin', 'admin'])) {
    const { data } = await admin.rpc('has_active_admin_override', { _user_id: caller.userId });
    return data === true;
  }
  return false;
}

// Centres where the caller holds one of these roles; null means every centre (server callers and platform staff).
export function centresWithRole(caller: Caller, roles: string[], alsoAdmins = true): string[] | null {
  if (caller.kind === 'service' || caller.platform) return null;
  const all = alsoAdmins ? [...roles, 'organization_admin', 'admin'] : roles;
  return [...new Set(caller.roles.filter((r) => r.organization_id && all.includes(r.role)).map((r) => r.organization_id as string))];
}

export const jsonResponse = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
