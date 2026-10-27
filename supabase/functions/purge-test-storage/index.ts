// Removes the storage files queued by reset_test_data (files uploaded by test logins). Super Admin only.
import { identifyCaller, serviceClient } from '../_shared/caller.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const admin = serviceClient();
    const caller = await identifyCaller(req, admin);
    const allowed = caller && (caller.kind === 'service' || (caller.kind === 'user' && caller.roles.some((r) => r.role === 'super_admin')));
    if (!allowed) return json({ error: 'Only the Super Admin can remove test files' }, 403);

    const { data: queued, error } = await admin.from('test_storage_queue').select('bucket_id, name');
    if (error) return json({ error: error.message }, 500);

    const byBucket = new Map<string, string[]>();
    for (const q of queued ?? []) byBucket.set(q.bucket_id, [...(byBucket.get(q.bucket_id) ?? []), q.name]);

    let removed = 0;
    const failed: string[] = [];
    for (const [bucket, names] of byBucket) {
      for (let i = 0; i < names.length; i += 100) {
        const chunk = names.slice(i, i + 100);
        const { error: rmError } = await admin.storage.from(bucket).remove(chunk);
        if (rmError) { failed.push(...chunk.map((n) => `${bucket}/${n}`)); continue; }
        removed += chunk.length;
        await admin.from('test_storage_queue').delete().eq('bucket_id', bucket).in('name', chunk);
      }
    }
    return json({ removed, failed });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
