'use client';
import { useEffect, useState } from 'react';

const won = (n) => (n ? `${Number(n).toLocaleString('ko-KR')}원` : '-');

// 이 업체 링크에서만 뺄 상품 고르기
export default function PartnerProducts({ partnerId, partnerName }) {
  const [q, setQ] = useState('');
  const [qq, setQq] = useState('');
  const [f, setF] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [tick, setTick] = useState(0);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setQq(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    setSel(new Set());
    fetch(`/api/admin/partners/${partnerId}/products?q=${encodeURIComponent(qq)}&f=${f}&page=${page}`, { cache: 'no-store' })
      .then((r) => r.json()).then(setData);
  }, [partnerId, qq, f, page, tick]);

  const ids = data?.items.map((i) => i.id) || [];
  const allOn = ids.length > 0 && ids.every((id) => sel.has(id));
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const toggle = (id) => { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n); };

  const apply = async (excluded, list = [...sel]) => {
    if (!list.length) return;
    const r = await fetch(`/api/admin/partners/${partnerId}/products`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: list, excluded }) });
    setMsg(r.ok ? `${list.length}개 ${excluded ? '제외' : '다시 노출'}했어요.` : '저장에 실패했어요.');
    setTimeout(() => setMsg(''), 3000);
    setTick((t) => t + 1);
  };

  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>이 업체 상품 관리 · 제안서 엑셀</h3>
        <span className="desc" style={{ margin: 0 }}>{partnerName}님 링크에서만 빠지고, 다른 업체·전체 상품에는 영향 없어요.</span>
      </div>
      <div className="row" style={{ marginBottom: 10 }}>
        <input className="input" style={{ flex: '1 1 240px' }} placeholder="상품명 · 브랜드 · 공급사 · 카테고리 · ID" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips" style={{ width: 'auto' }}>
          {[['all', '전체'], ['shown', '노출 중'], ['excluded', `제외됨 ${data ? data.excluded : ''}`]].map(([k, l]) => (
            <button key={k} className={`chip ${f === k ? 'on' : ''}`} onClick={() => { setF(k); setPage(1); }}>{l}</button>
          ))}
        </div>
      </div>
      <div className="row" style={{ marginBottom: 10, minHeight: 32 }}>
        <span className="count">{sel.size ? `${sel.size}개 선택됨` : `${data ? data.total.toLocaleString() : '…'}개 상품`}</span>
        <button className="btn small danger" disabled={!sel.size} onClick={() => apply(true)}>선택 상품 이 업체에서 제외</button>
        <button className="btn small" disabled={!sel.size} onClick={() => apply(false)}>선택 상품 다시 노출</button>
        {msg && <span className="ok">{msg}</span>}
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr>
            <th style={{ width: 32 }}><input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(ids))} aria-label="이 페이지 전체 선택" /></th>
            <th>상품</th><th>카테고리</th><th className="num">공구가~</th><th>이 업체 노출</th><th>제안서</th>
          </tr></thead>
          <tbody>
            {!data && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>불러오는 중…</td></tr>}
            {data && !data.items.length && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>상품이 없어요.</td></tr>}
            {data?.items.map((p) => (
              <tr key={p.id} style={p.excluded ? { opacity: 0.55 } : undefined}>
                <td><input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} /></td>
                <td>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    {p.image_url ? <img className="small-thumb" src={p.image_url} alt="" loading="lazy" /> : <div className="small-thumb" />}
                    <div><div style={{ fontWeight: 600 }}>{p.name}</div><div className="desc" style={{ margin: 0 }}>{[p.vendor, p.brand].filter(Boolean).join(' | ')} · #{p.id}</div></div>
                  </div>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>{p.category || '-'}</td>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>{won(p.price_from)}</td>
                <td>
                  <label className="toggle">
                    <input type="checkbox" checked={!p.excluded} onChange={(e) => apply(!e.target.checked, [p.id])} />
                    <span className="toggle-ui" /> {p.excluded ? '제외' : '노출'}
                  </label>
                </td>
                <td><a className="btn small" href={`/api/admin/proposal-xlsx?partner=${partnerId}&product=${p.id}`} download style={{ whiteSpace: 'nowrap' }}>엑셀 받기</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>이전</button>
        <span>{page} / {pages}</span>
        <button className="btn small" disabled={page >= pages} onClick={() => setPage(page + 1)}>다음</button>
      </div>
    </div>
  );
}
