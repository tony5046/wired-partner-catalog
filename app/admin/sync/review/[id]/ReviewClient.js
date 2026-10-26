'use client';
import { useMemo, useState } from 'react';

const won = (n) => (n ? `${Number(n).toLocaleString('ko-KR')}원` : '-');
const KIND = { new: ['신규', 'edit'], changed: ['변경', 'warm'], removed: ['판매중단', 'cold'] };
const TABS = [
  ['all', '전체'],
  ['new', '신규'],
  ['changed', '변경'],
  ['price', '가격·수수료 변동'],
  ['removed', '판매중단'],
  ['keyword', '제외 키워드'],
];
const STEP = 100;

export default function ReviewClient({ batchId, rows }) {
  const [state, setState] = useState(() => {
    const s = {};
    rows.forEach((r) => {
      const defaultHidden = r.kind === 'new' ? r.keyword : r.hasEdit ? r.hidden : r.keyword || r.hidden;
      s[r.id] = { include: true, displayName: r.displayName, hurdle: r.hurdle, commission: '', hidden: defaultHidden, resetPrice: !!r.wiredChanged };
    });
    return s;
  });
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(STEP);
  const [bulkHurdle, setBulkHurdle] = useState('');
  const [bulkRate, setBulkRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const counts = useMemo(() => {
    const c = { all: rows.length, new: 0, changed: 0, removed: 0, keyword: 0, price: 0 };
    rows.forEach((r) => { c[r.kind]++; if (r.keyword && r.kind !== 'removed') c.keyword++; if (r.priceChanged || r.rateChanged || r.wiredChanged) c.price++; });
    return c;
  }, [rows]);

  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === 'keyword') { if (!(r.keyword && r.kind !== 'removed')) return false; }
      else if (tab === 'price') { if (!(r.priceChanged || r.rateChanged || r.wiredChanged)) return false; }
      else if (tab !== 'all' && r.kind !== tab) return false;
      return !k || `${r.name} ${r.displayName} ${r.brand} ${r.id}`.toLowerCase().includes(k);
    });
  }, [rows, tab, q]);

  const set = (id, patch) => setState((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  const visible = list.slice(0, limit);
  const allOn = list.length > 0 && list.every((r) => state[r.id].include);
  const toggleAll = () => setState((s) => {
    const n = { ...s };
    list.forEach((r) => (n[r.id] = { ...n[r.id], include: !allOn }));
    return n;
  });
  const applyToSelected = (patch) => setState((s) => {
    const n = { ...s };
    list.forEach((r) => { if (n[r.id].include && r.kind !== 'removed') n[r.id] = { ...n[r.id], ...patch }; });
    return n;
  });
  const selectedCount = rows.filter((r) => state[r.id].include).length;

  const upload = async () => {
    if (!selectedCount && rows.length) return;
    if (rows.length && !window.confirm(`선택한 ${selectedCount}개를 업로드할까요?`)) return;
    setBusy(true);
    setMsg('');
    const items = rows.map((r) => {
      const st = state[r.id];
      const d = { id: r.id, include: st.include };
      if (st.displayName !== r.displayName) d.displayName = st.displayName;
      if (st.hurdle !== r.hurdle) d.hurdle = st.hurdle;
      if (String(st.commission).trim() !== '') d.commission = Number(String(st.commission).replace(/[^0-9.]/g, ''));
      if (r.kind === 'new' || st.hidden !== r.hidden) d.hidden = st.hidden;
      if (r.wiredChanged && st.resetPrice) d.resetPrice = true;
      return d;
    });
    const res = await fetch('/api/admin/sync/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batchId, items }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      alert(`업로드 완료! 반영 ${j.upserted}개 · 판매중단 ${j.removed}개 · 수정 ${j.edited}개 · 관련 릴스 갱신 ${j.reels}개`);
      location.href = '/admin/sync';
    } else setMsg(j.error || '업로드에 실패했어요.');
  };

  const discard = async () => {
    if (!window.confirm('이번 동기화를 취소할까요? 아무것도 반영되지 않아요.')) return;
    await fetch('/api/admin/sync/discard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batchId }) });
    location.href = '/admin/sync';
  };

  if (!rows.length) {
    return (
      <div className="panel">
        변경된 상품이 없어요.
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={upload} disabled={busy}>릴스만 갱신하고 닫기</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="kpis">
        <div className="kpi"><div className="l">신규 상품</div><div className="v">{counts.new}</div></div>
        <div className="kpi"><div className="l">변경된 상품</div><div className="v">{counts.changed}</div></div>
        <div className="kpi"><div className="l">판매중단</div><div className="v">{counts.removed}</div></div>
        <div className="kpi"><div className="l">제외 키워드 포함</div><div className="v">{counts.keyword}</div></div>
      </div>

      <div className="panel">
        <div className="row" style={{ marginBottom: 12 }}>
          <div className="chips" style={{ width: 'auto' }}>
            {TABS.map(([k, l]) => (
              <button key={k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => { setTab(k); setLimit(STEP); }}>{l} {counts[k]}</button>
            ))}
          </div>
          <input className="input" style={{ flex: '1 1 200px' }} placeholder="상품명 · 브랜드 · ID 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="row bulk-bar">
          <b style={{ fontSize: 13 }}>체크한 상품에 일괄 적용</b>
          <input className="input" style={{ width: 220 }} placeholder="진행 허들 (예: 3백만원 이상)" value={bulkHurdle} onChange={(e) => setBulkHurdle(e.target.value)} />
          <button className="btn small" disabled={!bulkHurdle.trim()} onClick={() => applyToSelected({ hurdle: bulkHurdle })}>허들 적용</button>
          <input className="input" style={{ width: 110 }} placeholder="수수료 %" inputMode="decimal" value={bulkRate} onChange={(e) => setBulkRate(e.target.value)} />
          <button className="btn small" disabled={!bulkRate.trim()} onClick={() => applyToSelected({ commission: bulkRate })}>수수료 적용</button>
          <button className="btn small" onClick={() => applyToSelected({ hidden: false })}>노출</button>
          <button className="btn small danger" onClick={() => applyToSelected({ hidden: true })}>제외</button>
        </div>

        <div className="tbl-wrap">
          <table className="tbl review-tbl">
            <thead>
              <tr>
                <th style={{ width: 32 }}><input type="checkbox" checked={allOn} onChange={toggleAll} aria-label="전체 선택" /></th>
                <th>상품 / 업체에 보일 상품명</th>
                <th className="num">공동구매가</th>
                <th style={{ width: 120 }}>수수료 (%)</th>
                <th style={{ width: 240 }}>진행 허들</th>
                <th style={{ width: 96 }}>업체 노출</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const st = state[r.id];
                const [kl, kc] = KIND[r.kind];
                const priceChanged = r.kind === 'changed' && r.curPrice !== r.newPrice;
                return (
                  <tr key={r.id} className={st.include ? '' : 'off'}>
                    <td><input type="checkbox" checked={st.include} onChange={(e) => set(r.id, { include: e.target.checked })} /></td>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                        {r.image ? <img className="small-thumb" src={r.image} alt="" loading="lazy" /> : <div className="small-thumb" />}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="row" style={{ gap: 4, marginBottom: 4 }}>
                            <span className={`badge ${kc}`}>{kl}</span>
                            {r.keyword && r.kind !== 'removed' && <span className="badge hot">제외 키워드</span>}
                            {(r.priceChanged || r.wiredChanged) && <span className="badge hot">가격 변동</span>}
                            {r.rateChanged && <span className="badge hot">수수료 변동</span>}
                            {r.customPrice && <span className="badge edit">가격 직접 수정됨</span>}
                            <span className="desc" style={{ margin: 0 }}>#{r.id} · {r.brand || '-'}</span>
                          </div>
                          {r.kind === 'removed' ? (
                            <div style={{ fontWeight: 600 }}>{r.displayName || r.name}</div>
                          ) : (
                            <input className="input name-input" value={st.displayName} placeholder={r.name} onChange={(e) => set(r.id, { displayName: e.target.value })} title="비워두면 와이어드민 상품명 그대로 사용" />
                          )}
                        </div>
                      </div>
                    </td>
                    {r.kind === 'removed' ? (
                      <td colSpan={4} className="desc">와이어드민에서 거래중이 아니에요. 체크하면 업체 페이지에서 내려가요.</td>
                    ) : (
                      <>
                        <td className="num" style={{ whiteSpace: 'nowrap' }}>
                          {priceChanged ? <><s style={{ color: 'var(--muted)' }}>{won(r.curPrice)}</s><br /><b style={{ color: 'var(--accent)' }}>{won(r.newPrice)}</b></> : won(r.newPrice)}
                          <div className="desc" style={{ margin: 0 }}>{r.optionCount ? `${r.optionCount}개 옵션` : '가격 조율중'}</div>
                          {r.rateChanged && <div className="desc" style={{ margin: 0, color: 'var(--bad)' }}>수수료 {r.curRate || '-'}% → {r.newRate || '-'}%</div>}
                          {r.wiredChanged && (
                            <label className="reset-price">
                              <input type="checkbox" checked={st.resetPrice} onChange={(e) => set(r.id, { resetPrice: e.target.checked })} />
                              와이어드민 최신 가격으로 덮어쓰기<br /><span>({won(r.wiredNewPrice)}~ · 수수료 {r.wiredNewRate || '-'}%)</span>
                            </label>
                          )}
                        </td>
                        <td>
                          <input className={`input ${st.commission !== '' ? 'changed-input' : ''}`} style={{ width: '100%' }} inputMode="decimal" value={st.commission} placeholder={r.newRate ? `${r.newRate}%` : '-'} onChange={(e) => set(r.id, { commission: e.target.value })} title="비워두면 와이어드민 기준(총 마진율-5%) 유지. 입력하면 전 옵션에 적용" />
                        </td>
                        <td>
                          <input className={`input ${st.hurdle !== r.hurdle ? 'changed-input' : ''}`} style={{ width: '100%' }} value={st.hurdle} placeholder={r.wiredHurdle ? `와이어드민: ${r.wiredHurdle}` : '진행 허들 입력'} onChange={(e) => set(r.id, { hurdle: e.target.value })} />
                          {!st.hurdle && r.wiredHurdle && (
                            <button className="link-btn" onClick={() => set(r.id, { hurdle: r.wiredHurdle })}>와이어드민 값 쓰기</button>
                          )}
                        </td>
                        <td>
                          <select className={`input ${st.hidden ? 'hidden-sel' : ''}`} value={st.hidden ? '1' : '0'} onChange={(e) => set(r.id, { hidden: e.target.value === '1' })}>
                            <option value="0">노출</option>
                            <option value="1">제외</option>
                          </select>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {list.length > limit && <button className="more" style={{ marginTop: 14, marginBottom: 0 }} onClick={() => setLimit(limit + STEP)}>더 보기 ({list.length - limit}개 남음)</button>}
      </div>

      <div className="commit-bar">
        <div className="inner">
          <span><b>{selectedCount}</b> / {rows.length}개 선택</span>
          {msg && <span className="err">{msg}</span>}
          <div className="row">
            <button className="btn" onClick={discard} disabled={busy}>이번 동기화 취소</button>
            <button className="btn primary" onClick={upload} disabled={busy || !selectedCount}>{busy ? '업로드 중…' : `선택한 ${selectedCount}개 업로드`}</button>
          </div>
        </div>
      </div>
    </>
  );
}
