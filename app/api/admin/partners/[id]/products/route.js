import { NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
const SIZE = 100;

// 업체별 상품 노출 관리: 목록 조회
export async function GET(req, { params }) {
  await ensureSchema();
  const pid = parseInt(params.id, 10);
  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') || '').trim();
  const f = sp.get('f') || 'all';
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
  const like = `%${q.replace(/[%_]/g, '')}%`;
  const where = sql`
    p.active and not coalesce(e.hidden, false)
    ${q ? sql`and (p.name ilike ${like} or e.display_name ilike ${like} or p.brand ilike ${like} or p.vendor ilike ${like} or p.category ilike ${like} or p.id::text = ${q})` : sql``}
    ${f === 'excluded' ? sql`and x.product_id is not null` : f === 'shown' ? sql`and x.product_id is null` : sql``}`;
  const [{ count }] = await sql`
    select count(*) from products p left join product_edits e on e.product_id = p.id
    left join partner_exclusions x on x.partner_id = ${pid} and x.product_id = p.id where ${where}`;
  const [{ excluded }] = await sql`
    select count(*)::int as excluded from partner_exclusions x join products p on p.id = x.product_id where x.partner_id = ${pid} and p.active`;
  const rows = await sql`
    select p.id, coalesce(nullif(e.display_name, ''), p.name) as name, p.brand, p.vendor, p.category, p.image_url, p.price_from,
      (x.product_id is not null) as excluded
    from products p left join product_edits e on e.product_id = p.id
    left join partner_exclusions x on x.partner_id = ${pid} and x.product_id = p.id
    where ${where}
    order by (x.product_id is not null) desc, p.wired_updated_at desc nulls last, p.id desc
    limit ${SIZE} offset ${(page - 1) * SIZE}`;
  return NextResponse.json({ total: Number(count), excluded, page, size: SIZE, items: rows });
}

// 제외 / 다시 노출 { ids: [], excluded: true|false }
export async function POST(req, { params }) {
  await ensureSchema();
  const pid = parseInt(params.id, 10);
  const b = await req.json().catch(() => ({}));
  const ids = (Array.isArray(b.ids) ? b.ids : []).filter(Number.isInteger).slice(0, 5000);
  if (!ids.length) return NextResponse.json({ error: 'ids' }, { status: 400 });
  if (b.excluded) {
    await sql`insert into partner_exclusions (partner_id, product_id) select ${pid}, unnest(${ids}::int[]) on conflict do nothing`;
  } else {
    await sql`delete from partner_exclusions where partner_id = ${pid} and product_id = any(${ids})`;
  }
  return NextResponse.json({ ok: true, count: ids.length });
}
