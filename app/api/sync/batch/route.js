import { ensureSchema, sql } from '@/lib/db';
import { syncKeyOk } from '@/lib/auth';
import { json, options } from '@/lib/cors';
import { normalizeProducts, normalizeReels } from '@/lib/ingest';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const OPTIONS = options;

// 와이어드민 북마크 → 검토 대기 목록(batch)에 쌓기. 실제 반영은 관리자 검토 후 업로드 때.
export async function POST(req) {
  if (!(await syncKeyOk(req.nextUrl.searchParams.get('k')))) return json({ error: 'invalid key' }, 401);
  let b;
  try {
    b = JSON.parse(await req.text());
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  await ensureSchema();

  if (b.action === 'start') {
    const [r] = await sql`insert into sync_batches (status) values ('collecting') returning id`;
    return json({ batchId: r.id });
  }

  const batchId = Number(b.batchId);
  const [batch] = await sql`select * from sync_batches where id = ${batchId}`;
  if (!batch || batch.status !== 'collecting') return json({ error: 'batch not open' }, 400);

  if (b.action === 'add') {
    const prods = normalizeProducts(b.products);
    if (prods.length) {
      const existing = new Set((await sql`select id from products where id = any(${prods.map((p) => p.id)}) and active`).map((r) => r.id));
      const rows = prods.map((p) => ({ product_id: p.id, kind: existing.has(p.id) ? 'changed' : 'new', payload: p }));
      await sql`
        insert into sync_items (batch_id, product_id, kind, payload)
        select ${batchId}, product_id, kind, payload from jsonb_to_recordset(${sql.json(rows)}) as x(product_id integer, kind text, payload jsonb)
        on conflict (batch_id, product_id) do update set kind = excluded.kind, payload = excluded.payload`;
    }
    const reels = normalizeReels(b.reels);
    if (reels.length) {
      const rows = reels.map((r) => ({ product_id: r.id, reels: { keyword: r.keyword, items: r.reels } }));
      await sql`
        insert into sync_items (batch_id, product_id, kind, reels)
        select ${batchId}, product_id, 'reels', reels from jsonb_to_recordset(${sql.json(rows)}) as x(product_id integer, reels jsonb)
        on conflict (batch_id, product_id) do update set reels = excluded.reels`;
    }
    return json({ ok: true });
  }

  if (b.action === 'finish') {
    const ids = (Array.isArray(b.activeIds) ? b.activeIds : []).filter(Number.isInteger);
    if (ids.length > 50) {
      await sql`
        insert into sync_items (batch_id, product_id, kind)
        select ${batchId}, id, 'removed' from products where active and not (id = any(${ids}))
        on conflict do nothing`;
    }
    await sql`update sync_batches set status = 'pending', active_ids = ${sql.json(ids)} where id = ${batchId}`;
    const counts = {};
    (await sql`select kind, count(*)::int as n from sync_items where batch_id = ${batchId} group by kind`).forEach((r) => (counts[r.kind] = r.n));
    return json({ batchId, counts, reviewPath: `/admin/sync/review/${batchId}` });
  }
  return json({ error: 'unknown action' }, 400);
}
