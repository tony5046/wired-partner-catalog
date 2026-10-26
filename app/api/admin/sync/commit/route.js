import { NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { upsertProducts, applyReels } from '@/lib/ingest';
import { effectiveOptions } from '@/lib/display';
import { refreshPriceFrom } from '@/lib/products';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 검토한 동기화 목록 업로드
// items: [{ id, include, displayName?, hurdle?, commission?, hidden? }]  (undefined/null = 기존 값 유지)
export async function POST(req) {
  await ensureSchema();
  const b = await req.json().catch(() => ({}));
  const batchId = Number(b.batchId);
  const [batch] = await sql`select * from sync_batches where id = ${batchId}`;
  if (!batch || batch.status !== 'pending') return NextResponse.json({ error: '이미 처리됐거나 없는 동기화예요.' }, { status: 400 });

  const items = await sql`select * from sync_items where batch_id = ${batchId}`;
  const decisions = new Map((Array.isArray(b.items) ? b.items : []).filter((d) => Number.isInteger(d.id)).map((d) => [d.id, d]));

  const toUpsert = [];
  const toRemove = [];
  const reelRows = [];
  for (const it of items) {
    const d = decisions.get(it.product_id);
    const include = !!d?.include;
    if ((it.kind === 'new' || it.kind === 'changed') && include && it.payload) toUpsert.push(it.payload);
    if (it.kind === 'removed' && include) toRemove.push(it.product_id);
    // 릴스: 업로드하는 상품 + 기존 상품의 주기적 갱신분
    if (it.reels && (it.kind === 'reels' || include)) reelRows.push({ id: it.product_id, keyword: it.reels.keyword, reels: it.reels.items || [] });
  }

  await upsertProducts(toUpsert);
  if (toRemove.length) await sql`update products set active = false where id = any(${toRemove})`;
  await applyReels(reelRows);

  // 수정값 (상품명 / 허들 / 수수료 / 노출)
  const editIds = [];
  for (const [id, d] of decisions) {
    if (!d.include) continue;
    const touched = ['displayName', 'hurdle', 'commission', 'hidden', 'resetPrice'].some((k) => d[k] !== undefined && d[k] !== null);
    if (!touched) continue;
    const [p] = await sql`
      select p.*, e.hurdle, e.hidden, e.policy_id, e.options, e.display_name
      from products p left join product_edits e on e.product_id = p.id where p.id = ${id}`;
    if (!p) continue;
    const next = {
      display_name: d.displayName != null ? String(d.displayName).trim().slice(0, 300) || null : p.display_name ?? null,
      hurdle: d.hurdle != null ? String(d.hurdle).slice(0, 2000) : p.hurdle ?? null,
      hidden: d.hidden != null ? !!d.hidden : !!p.hidden,
      options: p.options ?? null,
      policy_id: p.policy_id ?? null,
    };
    // 직접 수정해둔 가격을 버리고 와이어드민 최신 가격구조로
    if (d.resetPrice) { next.options = null; next.policy_id = null; p.options = null; p.policy_id = null; }
    const rate = d.commission != null && d.commission !== '' ? Number(d.commission) : null;
    if (rate != null && !isNaN(rate)) {
      next.options = effectiveOptions(p, p).map((o) => ({ ...o, commissionRate: Math.round(rate * 10) / 10 }));
    }
    await sql`
      insert into product_edits (product_id, display_name, hurdle, hidden, options, policy_id, updated_at)
      values (${id}, ${next.display_name}, ${next.hurdle}, ${next.hidden}, ${next.options ? sql.json(next.options) : null}, ${next.policy_id}, now())
      on conflict (product_id) do update set display_name = excluded.display_name, hurdle = excluded.hurdle,
        hidden = excluded.hidden, options = excluded.options, policy_id = excluded.policy_id, updated_at = now()`;
    editIds.push(id);
  }
  // 가격 선택 규칙이 바뀌어도 목록 가격이 맞도록 전체 재계산
  const allActive = (await sql`select id from products where active`).map((r) => r.id);
  await refreshPriceFrom(allActive);

  const active = Array.isArray(batch.active_ids) ? batch.active_ids.length : 0;
  await sql`update sync_batches set status = 'committed', committed_at = now() where id = ${batchId}`;
  await sql`insert into sync_log (total, changed) values (${active}, ${toUpsert.length + toRemove.length})`;
  return NextResponse.json({ ok: true, upserted: toUpsert.length, removed: toRemove.length, edited: editIds.length, reels: reelRows.length });
}
