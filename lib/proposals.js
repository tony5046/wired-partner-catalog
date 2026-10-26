import { sql } from './db';

export async function getRequest(partnerId, productId) {
  const [r] = await sql`select * from proposal_requests where partner_id = ${partnerId} and product_id = ${productId}`;
  return r || null;
}

// 담당자가 작성한 수수료(옵션 순서대로)를 옵션에 적용
export function applyRates(opts, rates) {
  if (!Array.isArray(rates)) return opts;
  return opts.map((o, i) => (rates[i] == null || rates[i] === '' ? o : { ...o, commissionRate: Number(rates[i]) }));
}

export async function openedProductIds(partnerId) {
  const rows = await sql`select product_id from proposal_requests where partner_id = ${partnerId} and status = 'answered'`;
  return new Set(rows.map((r) => r.product_id));
}
