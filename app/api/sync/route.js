import { ensureSchema, sql } from '@/lib/db';
import { syncKeyOk } from '@/lib/auth';
import { json, options } from '@/lib/cors';
import { normalizeProducts, upsertProducts, normalizeReels, applyReels } from '@/lib/ingest';
import { EXCLUDE_PATTERN } from '@/lib/exclude';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const OPTIONS = options;

export async function POST(req) {
  if (!(await syncKeyOk(req.nextUrl.searchParams.get('k')))) return json({ error: 'invalid key' }, 401);
  let body;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  await ensureSchema();

  await upsertProducts(normalizeProducts(body.products));
  await applyReels(normalizeReels(body.reels));

  if (body.finish && Array.isArray(body.activeIds)) {
    const ids = body.activeIds.filter(Number.isInteger);
    let deactivated = 0;
    // 안전장치: 목록이 비정상적으로 적으면 비활성화하지 않음
    if (ids.length > 50) {
      const r = await sql`update products set active = false where active and not (id = any(${ids}))`;
      deactivated = r.count;
    }
    // 제외 키워드가 들어간 상품 자동 제외 (관리자가 한 번이라도 손댄 상품은 건드리지 않음)
    const ex = await sql`
      insert into product_edits (product_id, hidden, updated_at)
      select id, true, now() from products where active and name ~* ${EXCLUDE_PATTERN}
      on conflict (product_id) do nothing`;
    await sql`insert into sync_log (total, changed) values (${ids.length}, ${Number(body.changed) || 0})`;
    return json({ ok: true, deactivated, autoExcluded: ex.count });
  }
  return json({ ok: true });
}
