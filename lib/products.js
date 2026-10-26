import { sql } from './db';
import { effectiveOptions, withCompanyMargin, presentOption, plainText } from './display';
import { visibleReels } from './reels';
import { applyRates } from './proposals';

// 목록용 '공동구매가 ~부터' 값 재계산 (동기화/수정 후 호출)
export async function refreshPriceFrom(ids) {
  if (!ids?.length) return;
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300);
    const rows = await sql`
      select p.id, p.policies, e.policy_id, e.options
      from products p left join product_edits e on e.product_id = p.id
      where p.id = any(${chunk})`;
    const updates = rows.map((r) => {
      const opts = effectiveOptions(r, r);
      const prices = opts.map((o) => Number(o.groupPurchasePrice)).filter((n) => n > 0);
      return [r.id, prices.length ? Math.min(...prices) : null];
    });
    if (updates.length) {
      await sql`
        update products set price_from = v.price::integer
        from (values ${sql(updates)}) as v(id, price)
        where products.id = v.id::integer`;
    }
  }
}

export async function getPartnerBySlug(slug) {
  const [p] = await sql`select id, slug, name, our_manager, manager_contact, show_commission, company_margin from partners where slug = ${slug} and not archived`;
  return p || null;
}

// 인기상품: 최근 30일 여러 업체가 많이 본 상품 상위 20개(조회 3회 이상) + 관리자가 직접 지정한 상품
export const POPULAR_TOP = 20;
export const POPULAR_MIN_VIEWS = 3;

export async function popularIds() {
  const rows = await sql`
    with s as (
      select product_id, count(distinct partner_id) as partners, count(*) as hits
      from events
      where product_id is not null and type in ('view', 'link', 'reel') and created_at > now() - interval '30 days'
      group by product_id
    )
    select product_id as id from s where hits >= ${POPULAR_MIN_VIEWS}
    order by partners desc, hits desc limit ${POPULAR_TOP}`;
  const pins = await sql`select product_id as id from product_edits where popular_pin and not hidden`;
  return new Set([...rows, ...pins].map((r) => r.id));
}

export async function listForPartner(partnerId = 0) {
  const [rows, pop] = await Promise.all([
    sql`
      select p.id, coalesce(nullif(e.display_name, ''), p.name) as name, p.brand, p.category, p.image_url, p.price_from
      from products p left join product_edits e on e.product_id = p.id
      where p.active and not coalesce(e.hidden, false)
        and not exists (select 1 from partner_exclusions x where x.partner_id = ${partnerId} and x.product_id = p.id)
      order by p.wired_updated_at desc nulls last, p.id desc`,
    popularIds(),
  ]);
  return rows.map((r) => ({ ...r, popular: pop.has(r.id) }));
}

export async function getDetail(id, { showCommission = true, rates = null, partnerId = 0, margin = null } = {}) {
  const [r] = await sql`
    select p.*, e.hurdle, e.hidden, e.policy_id, e.options, e.hidden_reels, e.display_name
    from products p left join product_edits e on e.product_id = p.id
    where p.id = ${id} and p.active and not coalesce(e.hidden, false)
      and not exists (select 1 from partner_exclusions x where x.partner_id = ${partnerId} and x.product_id = p.id)`;
  if (!r) return null;
  const opts = applyRates(withCompanyMargin(effectiveOptions(r, r), margin), rates);
  return {
    id: r.id,
    name: r.display_name || r.name,
    brand: r.brand,
    category: r.category,
    image: r.image_url,
    salesUrl: r.sales_url,
    usp: plainText(r.usp).slice(0, 1500),
    hurdle: r.hurdle || '',
    // 수수료 비공개 업체에는 수수료 값 자체를 보내지 않음
    options: opts.map(presentOption).map((o) => {
      if (showCommission) return o;
      const { commission, commissionPct, commissionWon, ...rest } = o;
      return rest;
    }),
    showCommission,
    reels: visibleReels(r, r, 3).map((x) => ({ code: x.code, thumb: x.thumb, views: x.views, account: x.account })),
  };
}
