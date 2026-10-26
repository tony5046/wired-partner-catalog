import { ensureSchema, sql } from '@/lib/db';
import { syncKeyOk } from '@/lib/auth';
import { json, options } from '@/lib/cors';
import { reelsKeyword } from '@/lib/reels';

export const dynamic = 'force-dynamic';
export const OPTIONS = options;

// 관련 릴스를 새로 가져와야 하는 상품 목록 (키워드 변경 / 7일 경과 / 처음)
export async function GET(req) {
  if (!(await syncKeyOk(req.nextUrl.searchParams.get('k')))) return json({ error: 'invalid key' }, 401);
  await ensureSchema();
  const force = req.nextUrl.searchParams.get('force') === '1';
  const rows = await sql`
    select p.id, p.name, p.search_keyword, p.reels_keyword as fetched_kw, p.reels_at, e.reels_keyword
    from products p left join product_edits e on e.product_id = p.id
    where p.active and not coalesce(e.hidden, false)`;
  const weekAgo = Date.now() - 7 * 86400000;
  const todo = [];
  for (const r of rows) {
    const kw = reelsKeyword(r, r);
    if (!kw) continue;
    if (force || !r.reels_at || r.fetched_kw !== kw || new Date(r.reels_at).getTime() < weekAgo) todo.push({ id: r.id, keyword: kw });
  }
  return json({ todo });
}
