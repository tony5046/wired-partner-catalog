import { headers } from 'next/headers';
import AdminNav from '@/components/AdminNav';
import { ensureSchema, sql } from '@/lib/db';
import { partnerStats, fmtDate, fmtDwell } from '@/lib/stats';
import PartnerManager from './PartnerManager';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  await ensureSchema();
  const h = headers();
  const origin = `${h.get('x-forwarded-proto') || 'https'}://${h.get('x-forwarded-host') || h.get('host')}`;
  const partners = await partnerStats();
  const [tot] = await sql`
    select
      count(*) filter (where type = 'visit' and created_at > now() - interval '7 days') as visits7,
      count(distinct partner_id) filter (where type = 'visit' and created_at > now() - interval '7 days') as partners7,
      count(*) filter (where type = 'view' and created_at > now() - interval '7 days') as views7,
      count(*) filter (where type = 'link' and created_at > now() - interval '7 days') as links7,
      count(*) filter (where type = 'download' and created_at > now() - interval '7 days') as downloads7
    from events`;
  const top = await sql`
    select p.id, p.name, p.brand, p.image_url, count(*) as views, count(distinct e.partner_id) as partners
    from events e join products p on p.id = e.product_id
    where e.type = 'view' and e.created_at > now() - interval '30 days'
    group by p.id order by partners desc, views desc limit 10`;

  const downloads = await sql`
    select e.created_at, e.product_id, pa.id as partner_id, pa.name as partner_name, pr.name as product_name, pr.brand
    from events e join partners pa on pa.id = e.partner_id left join products pr on pr.id = e.product_id
    where e.type = 'download'
    order by e.created_at desc limit 50`;

  const rows = partners
    .map((p) => ({
      ...p,
      lastVisitText: fmtDate(p.last_visit),
      dwellText: fmtDwell(p.dwell_sec),
      created: fmtDate(p.created_at),
      visits: Number(p.visits), visits7: Number(p.visits7), days: Number(p.days), views: Number(p.views),
      products_viewed: Number(p.products_viewed), links: Number(p.links), downloads: Number(p.downloads || 0),
      last_visit: p.last_visit ? new Date(p.last_visit).toISOString() : null,
      created_at: new Date(p.created_at).toISOString(),
    }));

  return (
    <>
      <AdminNav on="stats" />
      <div className="adm">
        <h1>업체 · 통계</h1>
        <p className="desc">업체를 등록하면 전용 링크가 생겨요. 링크로 들어온 방문·상품 조회·제품 링크 클릭·체류시간을 업체별로 집계합니다.</p>
        <div className="kpis">
          <div className="kpi"><div className="l">최근 7일 방문</div><div className="v">{Number(tot.visits7).toLocaleString()}</div></div>
          <div className="kpi"><div className="l">최근 7일 방문 업체</div><div className="v">{Number(tot.partners7).toLocaleString()}</div></div>
          <div className="kpi"><div className="l">최근 7일 상품 조회</div><div className="v">{Number(tot.views7).toLocaleString()}</div></div>
          <div className="kpi"><div className="l">최근 7일 제품 링크 클릭</div><div className="v">{Number(tot.links7).toLocaleString()}</div></div>
          <div className="kpi"><div className="l">최근 7일 제안서 전달</div><div className="v">{Number(tot.downloads7).toLocaleString()}</div></div>
        </div>

        <PartnerManager origin={origin} initial={rows} />

        <div className="panel">
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>제안서 엑셀 전달 기록 <span className="desc" style={{ fontWeight: 400 }}>· 총괄에서 받은 기록</span></h3>
          {!downloads.length ? (
            <div className="desc" style={{ margin: 0 }}>아직 전달한 제안서가 없어요.</div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>일시</th><th>업체</th><th>상품</th></tr></thead>
                <tbody>
                  {downloads.map((d, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--sub)' }}>{fmtDate(d.created_at)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}><a href={`/admin/partners/${d.partner_id}`} style={{ fontWeight: 600 }}>{d.partner_name}</a></td>
                      <td>{d.product_name || `#${d.product_id}`}{d.brand ? <span className="desc" style={{ margin: '0 0 0 6px' }}>{d.brand}</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel">
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>최근 30일 많이 본 상품</h3>
          {!top.length ? (
            <div className="desc" style={{ margin: 0 }}>아직 조회 기록이 없어요.</div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>상품</th><th className="num">본 업체 수</th><th className="num">조회수</th></tr></thead>
                <tbody>
                  {top.map((t) => (
                    <tr key={t.id}>
                      <td><div className="row" style={{ flexWrap: 'nowrap' }}>{t.image_url ? <img className="small-thumb" src={t.image_url} alt="" /> : <div className="small-thumb" />}<div><div style={{ fontWeight: 600 }}>{t.name}</div><div className="desc" style={{ margin: 0 }}>{t.brand}</div></div></div></td>
                      <td className="num">{Number(t.partners)}</td>
                      <td className="num">{Number(t.views)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
