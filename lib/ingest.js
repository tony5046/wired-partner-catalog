import { sql } from './db';
import { refreshPriceFrom } from './products';

// 와이어드민에서 받은 상품 → DB 행
export function normalizeProducts(list) {
  return (Array.isArray(list) ? list : [])
    .filter((p) => Number.isInteger(p.id) && p.name)
    .map((p) => ({
      id: p.id,
      name: String(p.name).slice(0, 300),
      brand: p.brand || null,
      vendor: p.vendor || null,
      category: p.category || null,
      image_url: p.image || null,
      sales_url: p.salesUrl || null,
      usp: p.usp ? String(p.usp).slice(0, 5000) : null,
      wired_hurdle: p.hurdle || null,
      manager: p.manager || null,
      search_keyword: p.searchKeyword ? String(p.searchKeyword).slice(0, 200) : null,
      policies: Array.isArray(p.policies) ? p.policies : [],
      wired_updated_at: p.updatedAt || null,
    }));
}

export async function upsertProducts(rows) {
  if (!rows.length) return;
  await sql`
    insert into products (id, name, brand, vendor, category, image_url, sales_url, usp, wired_hurdle, manager, search_keyword, policies, wired_updated_at, active, synced_at)
    select id, name, brand, vendor, category, image_url, sales_url, usp, wired_hurdle, manager, search_keyword, coalesce(policies, '[]'::jsonb), wired_updated_at, true, now()
    from jsonb_to_recordset(${sql.json(rows)}) as x(
      id integer, name text, brand text, vendor text, category text, image_url text, sales_url text, usp text,
      wired_hurdle text, manager text, search_keyword text, policies jsonb, wired_updated_at timestamptz)
    on conflict (id) do update set
      name = excluded.name, brand = excluded.brand, vendor = excluded.vendor, category = excluded.category,
      image_url = excluded.image_url, sales_url = excluded.sales_url, usp = excluded.usp,
      wired_hurdle = excluded.wired_hurdle, manager = excluded.manager, search_keyword = excluded.search_keyword, policies = excluded.policies,
      wired_updated_at = excluded.wired_updated_at, active = true, synced_at = now()`;
  await refreshPriceFrom(rows.map((r) => r.id));
}

// 릴스 [{id, keyword, items}] → 정리
export function normalizeReels(list) {
  return (Array.isArray(list) ? list : [])
    .filter((r) => Number.isInteger(r.id) && Array.isArray(r.items))
    .map((r) => ({
      id: r.id,
      keyword: String(r.keyword || '').slice(0, 200),
      reels: r.items
        .slice(0, 8)
        .map((x) => ({
          rid: Number(x.rid) || null,
          code: String(x.code || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40),
          thumb: typeof x.thumb === 'string' && /^https:\/\//.test(x.thumb) ? x.thumb.slice(0, 500) : null,
          views: Number(x.views) || 0,
          likes: Number(x.likes) || 0,
          account: String(x.account || '').slice(0, 60),
          name: String(x.name || '').slice(0, 60),
          postedAt: x.postedAt || null,
        }))
        .filter((x) => x.code),
    }));
}

export async function applyReels(rows) {
  if (!rows.length) return;
  await sql`
    update products p set reels = x.reels, reels_keyword = x.keyword, reels_at = now()
    from jsonb_to_recordset(${sql.json(rows)}) as x(id integer, keyword text, reels jsonb)
    where p.id = x.id`;
}
