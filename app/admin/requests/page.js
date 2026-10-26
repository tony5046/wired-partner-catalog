import AdminNav from '@/components/AdminNav';
import { ensureSchema, sql } from '@/lib/db';
import { fmtDate } from '@/lib/stats';

export const dynamic = 'force-dynamic';
const LABEL = { requested: ['작성 대기', 'warm'], answered: ['제안서 오픈', 'edit'], revoked: ['닫음', 'none'] };

export default async function Requests({ searchParams }) {
  await ensureSchema();
  const s = ['requested', 'answered', 'all'].includes(searchParams?.s) ? searchParams.s : 'requested';
  const rows = await sql`
    select r.*, pa.name as partner_name, pa.slug, pa.our_manager,
      coalesce(nullif(e.display_name, ''), p.name) as product_name, p.image_url, p.brand
    from proposal_requests r
    join partners pa on pa.id = r.partner_id
    left join products p on p.id = r.product_id
    left join product_edits e on e.product_id = r.product_id
    where ${s === 'all' ? sql`true` : sql`r.status = ${s}`}
    order by r.created_at desc limit 300`;
  const counts = {};
  (await sql`select status, count(*)::int as n from proposal_requests group by status`).forEach((r) => (counts[r.status] = r.n));
  return (
    <>
      <AdminNav on="requests" />
      <div className="adm">
        <h1>제안서 요청</h1>
        <p className="desc">수수료 비공개 업체가 &apos;제안서 요청하기&apos;를 누른 상품이에요. 수수료를 작성하고 &apos;제안서 열기&apos;를 누르면 그 업체 페이지에서 해당 상품의 수수료가 보여요.</p>
        <div className="chips" style={{ marginBottom: 12 }}>
          {[['requested', `작성 대기 ${counts.requested || 0}`], ['answered', `제안서 오픈 ${counts.answered || 0}`], ['all', '전체']].map(([k, l]) => (
            <a key={k} href={`/admin/requests?s=${k}`} className={`chip ${s === k ? 'on' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>{l}</a>
          ))}
        </div>
        <div className="panel">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>요청 시각</th><th>업체</th><th>상품</th><th>상태</th><th></th></tr></thead>
              <tbody>
                {!rows.length && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>요청이 없어요.</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                    <td><b>{r.partner_name}</b><div className="desc" style={{ margin: 0 }}>{r.our_manager || '-'}</div></td>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        {r.image_url ? <img className="small-thumb" src={r.image_url} alt="" /> : <div className="small-thumb" />}
                        <div><div style={{ fontWeight: 600 }}>{r.product_name || `#${r.product_id}`}</div><div className="desc" style={{ margin: 0 }}>{r.brand || ''}</div></div>
                      </div>
                    </td>
                    <td><span className={`badge ${LABEL[r.status]?.[1] || 'none'}`}>{LABEL[r.status]?.[0] || r.status}</span>{r.answered_at && <div className="desc" style={{ margin: 0 }}>{fmtDate(r.answered_at)}</div>}</td>
                    <td><a className={`btn small ${r.status === 'requested' ? 'primary' : ''}`} href={`/admin/requests/${r.id}`}>{r.status === 'requested' ? '수수료 작성' : '보기 · 수정'}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
