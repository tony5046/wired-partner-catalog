import { NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// 여러 상품 한 번에 삭제(업체 페이지에서 숨김) / 복구
export async function POST(req) {
  await ensureSchema();
  const b = await req.json().catch(() => ({}));
  const ids = (Array.isArray(b.ids) ? b.ids : []).filter(Number.isInteger).slice(0, 5000);
  if (!ids.length) return NextResponse.json({ error: 'ids required' }, { status: 400 });
  const hidden = !!b.hidden;
  await sql`
    insert into product_edits (product_id, hidden, updated_at)
    select unnest(${ids}::int[]), ${hidden}, now()
    on conflict (product_id) do update set hidden = excluded.hidden, updated_at = now()`;
  return NextResponse.json({ ok: true, count: ids.length });
}
