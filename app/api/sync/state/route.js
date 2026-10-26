import { ensureSchema, sql } from '@/lib/db';
import { syncKeyOk } from '@/lib/auth';
import { json, options } from '@/lib/cors';

export const dynamic = 'force-dynamic';
export const OPTIONS = options;

export async function GET(req) {
  if (!(await syncKeyOk(req.nextUrl.searchParams.get('k')))) return json({ error: 'invalid key' }, 401);
  await ensureSchema();
  const rows = await sql`select id, wired_updated_at from products where active`;
  const items = {};
  rows.forEach((r) => (items[r.id] = r.wired_updated_at ? new Date(r.wired_updated_at).toISOString() : null));
  return json({ items });
}
