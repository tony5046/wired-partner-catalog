import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import AdminNav from '@/components/AdminNav';
import { ensureSchema, sql } from '@/lib/db';
import { interest, fmtDate, fmtDwell } from '@/lib/stats';
import PartnerEdit from './PartnerEdit';
import PartnerProducts from './PartnerProducts';

export const dynamic = 'force-dynamic';
const TYPE_LABEL = { visit: '방문', view: '상품 조회', link: '제품 링크 클릭', reel: '관련 컨텐츠 클릭', request: '제안서 요청', download: '제안서 엑셀 전달' };

export default async function PartnerDetail({ params }) {
  await ensureSchema();
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) notFound();
  const [p] = await sql`select * from partners where id = ${id}`;
  if (!p) notFound();
  const h = headers();
  const origin = `${h.get('x-forwarded-proto') || 'https'}://${h.get('x-forwarded-host') || h.get('host')}`;

  const [s] = await sql`
    select
      count(*) filter (where type = 'visit') as visits,
      count(*) filter (where type = 'visit' and created_at > now() - interval '7 days') as visits7,
      count(distinct (created_at at time zone 'Asia/Seoul')::date) filter (where type = 'visit') as days,
      max(created_at) filter (where type = 'visit') as last_visit,
      min(created_at) filter (where type = 'visit') as first_visit,
      count(*) filter (where type = 'view') as views,
      count(distinct product_id) filter (where type = 'view') as products_viewed,
      count(*) filter (where type = 'link') as links,
      coalesce(sum(value) filter (where type = 'ping'), 0) as dwell_sec,
      count(distinct session_id) filter (where type = 'visit') as sessions,
      count(*) filter (where type = 'request') as requests,
      count(*) filter (where type = 'download') as downloads,
      count(distinct product_id) filter (where type = 'download') as downloaded_products
    from events where partner_id = ${id}`;
  const it = interest(s);

  const daily = await sql`
    select d::date as day,
      (select count(*) from events e where e.partner_id = ${id} and e.type = 'visit' and (e.created_at at time zone 'Asia/Seoul')::date = d::date) as visits,
      (select count(*) from events e where e.partner_id = ${id} and e.type = 'view' and (e.created_at at time zone 'Asia/Seoul')::date = d::date) as views
    from generate_series((now() at time zone 'Asia/Seoul')::date - 29, (now() at time zone 'Asia/Seoul')::date, interval '1 day') d
    order by d`;
  const maxDaily = Math.max(1, ...daily.map((d) => Number(d.visits) + Number(d.views)));

  const topProducts = await sql`
    select pr.id, pr.name, pr.brand, pr.image_url,
      count(*) filter (where e.type = 'view') as views,
      count(*) filter (where e.type = 'link') as links,
      count(*) filter (where e.type = 'reel') as reels,
      count(*) filter (where e.type = 'download') as downloads,
      max(e.created_at) as last_at
    from events e join products pr on pr.id = e.product_id
    where e.partner_id = ${id} and e.type in ('view', 'link', 'reel', 'download')
    group by pr.id order by downloads desc, views desc, links desc, last_at desc limit 30`;

  const recent = await sql`
    select e.type, e.created_at, e.product_id, pr.name as product_name
    from events e left join products pr on pr.id = e.product_id
    where e.partner_id = ${id} and e.type in ('visit', 'view', 'link', 'reel', 'request', 'download')
    order by e.created_at desc limit 60`;

  return (
    <>
      <AdminNav on="stats" />
      <div className="adm">
        <h1>
          {p.name} <span className={`badge ${it.cls}`} style={{ verticalAlign: 'middle' }}>관심도 {it.label}{it.score ? ` ${it.score}` : ''}</span>
          {p.archived && <span className="badge none" style={{ marginLeft: 6 }}>보관됨</span>}
        </h1>
        <p className="desc">첫 방문 {fmtDate(s.first_visit)} · 마지막 방문 {fmtDate(s.last_visit)}</p>

        <PartnerEdit partner={{ id: p.id, slug: p.slug, name: p.name, our_manager: p.our_manager || '', manager_contact: p.manager_contact || '', memo: p.memo || '', archived: p.archived, show_commission: p.show_commission, company_margin: Number(p.company_margin) }} origin={origin} />

        <PartnerProducts partnerId={p.id} partnerName={p.name} />

        <div className="kpis">
          <div className="kpi"><div className="l">총 방문</div><div className="v">{Number(s.visits)}</div></div>
          <div className="kpi"><div className="l">최근 7일 방문</div><div className="v">{Number(s.visits7)}</div></div>
          <div className="kpi"><div className="l">방문한 날</div><div className="v">{Number(s.days)}일</div></div>
          <div className="kpi"><div className="l">본 상품 (조회수)</div><div className="v">{Number(s.products_viewed)} <span style={{ fontSize: 14, color: 'var(--sub)' }}>({Number(s.views)})</span></div></div>
          <div className="kpi"><div className="l">제품 링크 클릭</div><div className="v">{Number(s.links)}</div></div>
          <div className="kpi"><div className="l">제안서 엑셀 전달</div><div className="v">{Number(s.downloads)} <span style={{ fontSize: 14, color: 'var(--sub)' }}>({Number(s.downloaded_products)}개 상품)</span></div></div>
          <div className="kpi"><div className="l">총 체류시간</div><div className="v" style={{ fontSize: 20 }}>{fmtDwell(s.dwell_sec)}</div></div>
        </div>

        <div className="panel">
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>최근 30일 활동 (방문 + 상품 조회)</h3>
          <div className="bars">
            {daily.map((d) => {
              const v = Number(d.visits) + Number(d.views);
              return <div key={String(d.day)} title={`${new Date(d.day).toLocaleDateString('ko-KR')} · 방문 ${d.visits} · 조회 ${d.views}`} style={{ height: `${(v / maxDaily) * 100}%`, opacity: v ? 0.85 : 0.15 }} />;
            })}
          </div>
          <div className="bars-x"><span>30일 전</span><span>오늘</span></div>
        </div>

        <div className="panel">
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>관심 상품</h3>
          {!topProducts.length ? (
            <div className="desc" style={{ margin: 0 }}>아직 조회한 상품이 없어요.</div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>상품</th><th className="num">조회</th><th className="num">링크 클릭</th><th className="num">컨텐츠 클릭</th><th className="num">제안서 전달</th><th>마지막</th></tr></thead>
                <tbody>
                  {topProducts.map((t) => (
                    <tr key={t.id}>
                      <td><div className="row" style={{ flexWrap: 'nowrap' }}>{t.image_url ? <img className="small-thumb" src={t.image_url} alt="" /> : <div className="small-thumb" />}<div><div style={{ fontWeight: 600 }}>{t.name}</div><div className="desc" style={{ margin: 0 }}>{t.brand}</div></div></div></td>
                      <td className="num">{Number(t.views)}</td>
                      <td className="num">{Number(t.links)}</td>
                      <td className="num">{Number(t.reels)}</td>
                      <td className="num" style={Number(t.downloads) ? { fontWeight: 700, color: 'var(--accent, #2563eb)' } : undefined}>{Number(t.downloads)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(t.last_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel">
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>최근 활동</h3>
          {!recent.length ? (
            <div className="desc" style={{ margin: 0 }}>기록이 없어요.</div>
          ) : (
            <table className="tbl">
              <tbody>
                {recent.map((r, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: 'nowrap', width: 130, color: 'var(--sub)' }}>{fmtDate(r.created_at)}</td>
                    <td style={{ whiteSpace: 'nowrap', width: 110 }}>{TYPE_LABEL[r.type]}</td>
                    <td>{r.product_name || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
