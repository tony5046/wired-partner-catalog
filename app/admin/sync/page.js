import { headers } from 'next/headers';
import AdminNav from '@/components/AdminNav';
import { ensureSchema, sql } from '@/lib/db';
import { fmtDate } from '@/lib/stats';
import { syncKey } from '@/lib/auth';
import { EXCLUDE_KEYWORDS } from '@/lib/exclude';

export const dynamic = 'force-dynamic';

function bookmarklet(origin, force, key) {
  const src = `${origin}/api/sync/script?k=${encodeURIComponent(key)}${force ? '&force=1' : ''}&t=`;
  return `javascript:(function(){var s=document.createElement('script');s.src='${src}'+Date.now();document.body.appendChild(s);})();`;
}

export default async function SyncPage() {
  await ensureSchema();
  const h = headers();
  const origin = `${h.get('x-forwarded-proto') || 'https'}://${h.get('x-forwarded-host') || h.get('host')}`;
  const key = await syncKey();
  const pending = await sql`
    select b.id, b.created_at,
      count(*) filter (where i.kind = 'new')::int as n_new,
      count(*) filter (where i.kind = 'changed')::int as n_changed,
      count(*) filter (where i.kind = 'removed')::int as n_removed
    from sync_batches b left join sync_items i on i.batch_id = b.id
    where b.status = 'pending' group by b.id order by b.id desc limit 5`;
  const logs = await sql`select * from sync_log order by at desc limit 10`;
  const [c] = await sql`
    select count(*) filter (where active) as active,
      count(*) filter (where active and price_from is not null) as priced,
      max(synced_at) as last
    from products`;
  const [e] = await sql`select count(*) filter (where coalesce(hurdle,'') <> '') as hurdles, count(*) filter (where options is not null) as edited, count(*) filter (where hidden) as hidden from product_edits`;
  const a = (href, label, primary) =>
    `<a href="${href.replace(/"/g, '&quot;')}" class="btn ${primary ? 'primary' : ''}" onclick="event.preventDefault();alert('이 버튼을 북마크바로 끌어다 놓으세요.')">${label}</a>`;

  return (
    <>
      <AdminNav on="sync" />
      <div className="adm">
        <h1>와이어드민 동기화</h1>
        <p className="desc">와이어드민 상품관리의 거래중 상품과 가격구조를 이 사이트로 복사해요. 직접 작성한 허들·수정한 가격은 덮어쓰지 않아요.</p>

        <div className="kpis">
          <div className="kpi"><div className="l">거래중 상품</div><div className="v">{Number(c.active).toLocaleString()}</div></div>
          <div className="kpi"><div className="l">가격구조 있는 상품</div><div className="v">{Number(c.priced).toLocaleString()}</div></div>
          <div className="kpi"><div className="l">허들 작성 / 가격 수정 / 숨김</div><div className="v" style={{ fontSize: 20 }}>{Number(e.hurdles)} / {Number(e.edited)} / {Number(e.hidden)}</div></div>
          <div className="kpi"><div className="l">마지막 동기화</div><div className="v" style={{ fontSize: 18 }}>{fmtDate(logs[0]?.at)}</div></div>
        </div>

        {pending.length > 0 && (
          <div className="panel" style={{ borderColor: '#bfd0ff', background: '#f5f8ff' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>검토 대기 중인 동기화</h3>
            {pending.map((b) => (
              <div key={b.id} className="row" style={{ justifyContent: 'space-between', padding: '6px 0' }}>
                <span>#{b.id} · {fmtDate(b.created_at)} · 신규 {b.n_new} · 변경 {b.n_changed} · 판매중단 {b.n_removed}</span>
                <a className="btn small primary" href={`/admin/sync/review/${b.id}`}>검토하고 업로드</a>
              </div>
            ))}
          </div>
        )}

        <div className="panel">
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>1. 북마크 설치 (처음 한 번)</h3>
          <p className="desc">아래 버튼을 브라우저 북마크바로 끌어다 놓으세요. (북마크바가 안 보이면 Ctrl+Shift+B)</p>
          <div className="row" dangerouslySetInnerHTML={{ __html: a(bookmarklet(origin, false, key), '카탈로그 동기화', true) + a(bookmarklet(origin, true, key), '카탈로그 전체 동기화', false) }} />
          <h3 style={{ margin: '18px 0 8px', fontSize: 15 }}>2. 실행</h3>
          <p className="desc" style={{ marginBottom: 0 }}>
            와이어드민(admin.wiredm.in)에 로그인한 상태에서 북마크를 누르면 바뀐 상품만 모아서 <b>검토 목록</b>으로 올려요. 이때는 아직 업체 페이지에 반영되지 않아요.
            <br />오른쪽 아래 &apos;검토하고 업로드하기&apos;를 눌러 상품별로 반영 여부 · 상품명 · 수수료 · 허들 · 노출을 확인하고 &apos;업로드&apos;를 눌러야 반영돼요.
            <br />· <b>카탈로그 동기화</b>: 수정일이 바뀐 상품만 가져와요 (보통 1분 이내).
            <br />· <b>전체 동기화</b>: 모든 상품을 다시 가져와요 (약 5~10분). 가격이 이상하게 보일 때만 사용하세요.
          </p>
        </div>

        <div className="panel">
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>자동 제외 키워드</h3>
          <p className="desc" style={{ margin: 0 }}>
            상품명에 아래 단어가 들어간 상품은 동기화 검토 화면에서 &apos;제외&apos;로 미리 선택돼 있어요. 필요한 상품은 상품 관리 &gt; 제외됨 탭에서 다시 노출할 수 있어요.
          </p>
          <div className="row" style={{ marginTop: 10 }}>
            {EXCLUDE_KEYWORDS.map((k) => <span key={k} className="badge cold">{k}</span>)}
          </div>
        </div>

        <div className="panel">
          <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>동기화 기록</h3>
          {!logs.length ? <div className="desc" style={{ margin: 0 }}>아직 동기화한 적이 없어요.</div> : (
            <table className="tbl">
              <thead><tr><th>일시</th><th className="num">거래중 상품</th><th className="num">업데이트</th></tr></thead>
              <tbody>{logs.map((l) => <tr key={l.id}><td>{fmtDate(l.at)}</td><td className="num">{Number(l.total).toLocaleString()}</td><td className="num">{Number(l.changed).toLocaleString()}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
