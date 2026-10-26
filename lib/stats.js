import { sql } from './db';

export function interest(s) {
  if (!Number(s.visits)) return { score: 0, label: '미방문', cls: 'none' };
  const dwellMin = Number(s.dwell_sec) / 60;
  let score = Number(s.visits7) * 3 + Number(s.days) * 2 + Number(s.products_viewed) + Number(s.links) * 3 + Number(s.requests || 0) * 5 + dwellMin * 0.5;
  const daysSince = (Date.now() - new Date(s.last_visit).getTime()) / 86400000;
  if (daysSince > 14) score *= 0.5;
  score = Math.round(score);
  if (score >= 30) return { score, label: '높음', cls: 'hot' };
  if (score >= 10) return { score, label: '보통', cls: 'warm' };
  return { score, label: '낮음', cls: 'cold' };
}

export async function partnerStats({ includeArchived = false } = {}) {
  const rows = await sql`
    select p.id, p.slug, p.name, p.our_manager, p.manager_contact, p.memo, p.archived, p.show_commission, p.company_margin, p.created_at,
      count(e.id) filter (where e.type = 'visit') as visits,
      count(e.id) filter (where e.type = 'visit' and e.created_at > now() - interval '7 days') as visits7,
      count(distinct (e.created_at at time zone 'Asia/Seoul')::date) filter (where e.type = 'visit') as days,
      max(e.created_at) filter (where e.type = 'visit') as last_visit,
      count(e.id) filter (where e.type = 'view') as views,
      count(distinct e.product_id) filter (where e.type = 'view') as products_viewed,
      count(e.id) filter (where e.type = 'link') as links,
      coalesce(sum(e.value) filter (where e.type = 'ping'), 0) as dwell_sec,
      count(e.id) filter (where e.type = 'request') as requests,
      count(e.id) filter (where e.type = 'download') as downloads
    from partners p left join events e on e.partner_id = p.id
    where ${includeArchived} or not p.archived
    group by p.id
    order by p.created_at desc`;
  return rows.map((r) => ({ ...r, interest: interest(r) }));
}

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '-';

export const fmtDwell = (sec) => {
  const m = Math.round(Number(sec) / 60);
  if (!m) return Number(sec) ? '1분 미만' : '-';
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`;
};
