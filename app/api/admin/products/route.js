import { NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
const SIZE = 100;

export async function GET(req) {
  await ensureSchema();
  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') || '').trim();
  const f = sp.get('f') || 'all';
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
  const like = `%${q.replace(/[%_]/g, '')}%`;

  const where = sql`
    p.active
    ${q ? sql`and (p.name ilike ${like} or e.display_name ilike ${like} or p.brand ilike ${like} or p.vendor ilike ${like} or p.id::text = ${q})` : sql``}
    ${f === 'nohurdle' ? sql`and coalesce(e.hurdle, '') = '' and not coalesce(e.hidden, false)` : sql``}
    ${f === 'hurdle' ? sql`and coalesce(e.hurdle, '') <> ''` : sql``}
    ${f === 'edited' ? sql`and e.options is not null` : sql``}
    ${f === 'hidden' ? sql`and coalesce(e.hidden, false)` : sql``}
    ${f === 'noprice' ? sql`and p.price_from is null and not coalesce(e.hidden, false)` : sql``}`;

  const [{ count }] = await sql`select count(*) from products p left join product_edits e on e.product_id = p.id where ${where}`;
  const rows = await sql`
    select p.id, p.name, e.display_name, p.brand, p.vendor, p.category, p.image_url, p.price_from, p.manager, p.wired_hurdle,
      e.hurdle, coalesce(e.hidden, false) as hidden, (e.options is not null) as edited, e.policy_id
    from products p left join product_edits e on e.product_id = p.id
    where ${where}
    order by p.wired_updated_at desc nulls last, p.id desc
    limit ${SIZE} offset ${(page - 1) * SIZE}`;
  return NextResponse.json({ total: Number(count), page, size: SIZE, items: rows });
}
