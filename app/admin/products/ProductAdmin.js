'use client';
import { useEffect, useState } from 'react';
import { OPTION_FIELDS } from '@/lib/display';

const won = (n) => (n ? `${Number(n).toLocaleString('ko-KR')}원` : '-');
const FILTERS = [
  ['all', '전체'],
  ['nohurdle', '허들 미작성'],
  ['hurdle', '허들 작성됨'],
  ['edited', '가격 수정됨'],
  ['noprice', '가격구조 없음'],
  ['hidden', '제외됨'],
];

export default function ProductAdmin() {
  const [q, setQ] = useState('');
  const [qq, setQq] = useState('');
  const [f, setF] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null);
  const [tick, setTick] = useState(0);
  const [sel, setSel] = useState(new Set());
  const [bulkMsg, setBulkMsg] = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setQq(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setData(null);
    setSel(new Set());
    fetch(`/api/admin/products?q=${encodeURIComponent(qq)}&f=${f}&page=${page}`).then((r) => r.json()).then(setData);
  }, [qq, f, page, tick]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const pageIds = data?.items.map((p) => p.id) || [];
  const allOn = pageIds.length > 0 && pageIds.every((id) => sel.has(id));
  const toggle = (id) => {
    const n = new Set(sel);
    n.has(id) ? n.delete(id) : n.add(id);
    setSel(n);
  };
  const toggleAll = () => setSel(allOn ? new Set() : new Set(pageIds));
  const bulk = async (hidden) => {
    if (!sel.size) return;
    if (hidden && !window.confirm(`선택한 ${sel.size}개 상품을 제외할까요?\n업체 페이지에서 빠지고, '제외됨' 탭에서 언제든 다시 노출할 수 있어요.`)) return;
    const r = await fetch('/api/admin/products/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [...sel], hidden }) });
    setBulkMsg(r.ok ? `${sel.size}개 ${hidden ? '제외' : '다시 노출'}했어요.` : '처리에 실패했어요.');
    setTimeout(() => setBulkMsg(''), 3000);
    setTick((t) => t + 1);
  };

  return (
    <div className="panel">
      <div className="row" style={{ marginBottom: 12 }}>
        <input className="input" style={{ flex: '1 1 260px' }} placeholder="상품명 · 브랜드 · 공급사 · 상품ID" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips" style={{ width: 'auto' }}>
          {FILTERS.map(([k, l]) => (
            <button key={k} className={`chip ${f === k ? 'on' : ''}`} onClick={() => { setF(k); setPage(1); }}>{l}</button>
          ))}
        </div>
        <span className="count">{data ? `${data.total.toLocaleString()}개` : '…'}</span>
      </div>
      <div className="row" style={{ marginBottom: 10, minHeight: 32 }}>
        <span className="count">{sel.size ? `${sel.size}개 선택됨` : '체크박스로 여러 상품을 선택할 수 있어요'}</span>
        {f === 'hidden' ? (
          <button className="btn small" disabled={!sel.size} onClick={() => bulk(false)}>선택 상품 다시 노출</button>
        ) : (
          <button className="btn small danger" disabled={!sel.size} onClick={() => bulk(true)}>선택 상품 제외하기</button>
        )}
        {bulkMsg && <span className="ok">{bulkMsg}</span>}
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th style={{ width: 32 }}><input type="checkbox" checked={allOn} onChange={toggleAll} aria-label="이 페이지 전체 선택" /></th><th>상품</th><th>카테고리</th><th className="num">공구가~</th><th>진행 허들</th><th>상태</th><th></th></tr>
          </thead>
          <tbody>
            {!data && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>불러오는 중…</td></tr>}
            {data && !data.items.length && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>상품이 없어요. 먼저 와이어드민 동기화를 실행해 주세요.</td></tr>}
            {data?.items.map((p) => (
              <tr key={p.id} style={sel.has(p.id) ? { background: 'var(--accent-weak)' } : undefined}>
                <td><input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} /></td>
                <td>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    {p.image_url ? <img className="small-thumb" src={p.image_url} alt="" loading="lazy" /> : <div className="small-thumb" />}
                    <div>
                      <div style={{ fontWeight: 600 }}>{p.display_name || p.name}</div>
                      {p.display_name && <div className="desc" style={{ margin: 0 }}>원래 이름: {p.name}</div>}
                      <div className="desc" style={{ margin: 0 }}>{[p.vendor, p.brand].filter(Boolean).join(' | ')} · #{p.id} · {p.manager || '-'}</div>
                    </div>
                  </div>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>{p.category || '-'}</td>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>{won(p.price_from)}</td>
                <td style={{ maxWidth: 260 }}>
                  {p.hurdle ? <span style={{ whiteSpace: 'pre-line' }}>{p.hurdle.length > 60 ? p.hurdle.slice(0, 60) + '…' : p.hurdle}</span> : <span style={{ color: 'var(--muted)' }}>미작성{p.wired_hurdle && p.wired_hurdle !== 'NULL' ? ` (와이어드민: ${p.wired_hurdle})` : ''}</span>}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {p.hidden && <span className="badge none">제외됨</span>} {p.edited && <span className="badge edit">가격 수정</span>} {!p.price_from && !p.hidden && <span className="badge cold">가격없음</span>}
                </td>
                <td><button className="btn small" onClick={() => setEditing(p.id)}>편집</button></td>
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
      {editing && <EditModal id={editing} onClose={(saved) => { setEditing(null); if (saved) setTick((t) => t + 1); }} />}
    </div>
  );
}

function sameOptions(a, b) {
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}
function norm(list) {
  return (list || []).map((o) => OPTION_FIELDS.map(([k, , t]) => (t === 'text' ? String(o[k] ?? '') : o[k] === '' || o[k] == null ? null : Number(o[k]))));
}

function EditModal({ id, onClose }) {
  const [d, setD] = useState(null);
  const [hurdle, setHurdle] = useState('');
  const [hidden, setHidden] = useState(false);
  const [policyId, setPolicyId] = useState(null);
  const [opts, setOpts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [popularPin, setPopularPin] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [reelsKw, setReelsKw] = useState('');
  const [hiddenReels, setHiddenReels] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`/api/admin/products/${id}`).then((r) => r.json()).then((x) => {
      setD(x);
      setHurdle(x.hurdle);
      setHidden(x.hidden);
      setPolicyId(x.policyId);
      setOpts(x.effective.map((o) => ({ ...o })));
      setPopularPin(!!x.popularPin);
      setDisplayName(x.displayName || '');
      setReelsKw(x.reelsKeyword || '');
      setHiddenReels(x.hiddenReels || []);
    });
  }, [id]);

  const basePolicy = d && (d.policies.find((p) => p.id === (policyId || d.autoPolicyId)) || null);
  const base = basePolicy?.base || [];

  const changePolicy = (v) => {
    const pid = v ? Number(v) : null;
    setPolicyId(pid);
    const p = d.policies.find((x) => x.id === (pid || d.autoPolicyId));
    setOpts((p?.base || []).map((o) => ({ ...o })));
  };
  const setCell = (i, k, v) => setOpts(opts.map((o, j) => (j === i ? { ...o, [k]: v } : o)));
  const addRow = () => setOpts([...opts, Object.fromEntries(OPTION_FIELDS.map(([k, , t]) => [k, t === 'text' ? '' : 0]))]);
  const delRow = (i) => setOpts(opts.filter((_, j) => j !== i));
  const reset = () => setOpts(base.map((o) => ({ ...o })));

  const save = async () => {
    setSaving(true);
    setErr('');
    const custom = sameOptions(opts, base) ? null : opts;
    const r = await fetch(`/api/admin/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hurdle, hidden, policyId, options: custom, popularPin, reelsKeyword: reelsKw, hiddenReels, displayName }),
    });
    setSaving(false);
    if (r.ok) onClose(true);
    else setErr('저장에 실패했어요.');
  };

  const isChanged = (i, k) => {
    const b = base[i];
    if (!b) return true;
    return String(b[k] ?? '') !== String(opts[i][k] ?? '');
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose(false)}>
      <div className="modal" style={{ maxWidth: 1200 }}>
        <button className="close" onClick={() => onClose(false)}>×</button>
        {!d ? <div className="loading">불러오는 중…</div> : (
          <div style={{ padding: 24 }}>
            <div className="row" style={{ flexWrap: 'nowrap', marginBottom: 16 }}>
              {d.image ? <img className="small-thumb" style={{ width: 64, height: 64 }} src={d.image} alt="" /> : null}
              <div>
                <div className="desc" style={{ margin: 0 }}>{[d.vendor, d.brand].filter(Boolean).join(' | ')} · #{d.id} · 담당 {d.manager || '-'}</div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{d.name}</div>
                {d.salesUrl && <a className="desc" href={d.salesUrl} target="_blank" rel="noreferrer">{d.salesUrl}</a>}
              </div>
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              업체에 보일 상품명 (비워두면 와이어드민 상품명 그대로)
              <input className="input" value={displayName} placeholder={d.name} onChange={(e) => setDisplayName(e.target.value)} />
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              진행 허들 (업체에 그대로 보여요)
              <textarea className="input" value={hurdle} onChange={(e) => setHurdle(e.target.value)} placeholder={`예) 최소 발주 100개, 사전 품평 필요, 1천만원 이상 판매 가능 셀러${d.wiredHurdle && d.wiredHurdle !== 'NULL' ? `\n와이어드민 진행 허들: ${d.wiredHurdle}` : ''}`} />
            </div>

            <label className="row" style={{ marginBottom: 8, fontSize: 14 }}>
              <input type="checkbox" checked={popularPin} onChange={(e) => setPopularPin(e.target.checked)} /> 인기상품으로 고정 (조회수와 상관없이 인기상품 배지 표시)
            </label>

            <div className="panel" style={{ background: '#fafbfc', marginBottom: 16 }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <b style={{ fontSize: 14 }}>관련 컨텐츠 (릴스 조회수 상위)</b>
                <span className="desc" style={{ margin: 0 }}>현재 검색어: {d.reelsFetchedKeyword || '아직 가져오지 않음'}</span>
              </div>
              <div className="row" style={{ marginBottom: 10 }}>
                <input className="input" style={{ flex: '1 1 240px' }} value={reelsKw} onChange={(e) => setReelsKw(e.target.value)} placeholder={`검색 키워드 직접 지정 (기본: ${d.reelsKeywordAuto || '-'})`} />
                <span className="desc" style={{ margin: 0 }}>바꾸면 다음 동기화 때 새로 가져와요</span>
              </div>
              {d.reels.length ? (
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  {d.reels.map((r) => {
                    const off = hiddenReels.includes(r.code);
                    return (
                      <label key={r.code} style={{ width: 92, fontSize: 11, color: 'var(--sub)', opacity: off ? 0.4 : 1, cursor: 'pointer' }}>
                        <div style={{ aspectRatio: '9/16', borderRadius: 8, overflow: 'hidden', background: '#ddd', marginBottom: 4 }}>
                          {r.thumb && <img src={r.thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                        </div>
                        <input type="checkbox" checked={!off} onChange={() => setHiddenReels(off ? hiddenReels.filter((c) => c !== r.code) : [...hiddenReels, r.code])} /> {Number(r.views).toLocaleString()}회
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <a href={`https://www.instagram.com/reel/${r.code}/`} target="_blank" rel="noreferrer">@{r.account}</a>
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : <div className="desc" style={{ margin: 0 }}>가져온 릴스가 없어요.</div>}
              <div className="desc" style={{ margin: '8px 0 0' }}>체크 해제한 릴스는 업체 화면에 안 보여요. 체크된 것 중 위에서부터 3개가 노출돼요.</div>
            </div>

            <label className="row" style={{ marginBottom: 16, fontSize: 14 }}>
              <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} /> 업체 페이지에서 제외하기
            </label>

            <div className="row" style={{ marginBottom: 8, justifyContent: 'space-between' }}>
              <div className="field" style={{ flex: '1 1 300px' }}>
                가격 구조
                <select className="input" value={policyId || ''} onChange={(e) => changePolicy(e.target.value)}>
                  <option value="">자동 선택{d.autoPolicyId ? ` (${d.policies.find((p) => p.id === d.autoPolicyId)?.name})` : ' (없음)'}</option>
                  {d.policies.map((p) => (
                    <option key={p.id} value={p.id} disabled={!p.base.length}>
                      {p.name} · {String(p.createdAt).slice(0, 10)}{p.reviewStatus === 'APPROVED' ? ' · 승인' : ''}{!p.base.length ? ' (옵션 없음)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row">
                <button className="btn small" onClick={addRow}>+ 행 추가</button>
                <button className="btn small" onClick={reset}>와이어드민 값으로 되돌리기</button>
              </div>
            </div>

            <div className="tbl-wrap">
              <table className="edit-grid">
                <thead><tr>{OPTION_FIELDS.map(([k, l]) => <th key={k}>{l}</th>)}<th></th></tr></thead>
                <tbody>
                  {opts.map((o, i) => (
                    <tr key={i}>
                      {OPTION_FIELDS.map(([k, , t]) => (
                        <td key={k}>
                          <input className={isChanged(i, k) ? 'changed' : ''} value={o[k] ?? ''} placeholder={k.includes('Additional') ? '불가' : ''} inputMode={t === 'text' ? 'text' : 'decimal'} onChange={(e) => setCell(i, k, e.target.value)} style={t === 'text' ? { minWidth: 160 } : undefined} />
                        </td>
                      ))}
                      <td><button className="btn small danger" style={{ whiteSpace: 'nowrap' }} onClick={() => delRow(i)}>삭제</button></td>
                    </tr>
                  ))}
                  {!opts.length && <tr><td colSpan={OPTION_FIELDS.length + 1} className="desc" style={{ padding: 12 }}>가격 구조가 없어요. 행을 추가해서 직접 입력할 수 있어요.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="desc" style={{ marginTop: 8 }}>
              수수료율 기본값 = 와이어드민 총 마진율 − 5%. 배송비가 0이면 업체 화면에 &apos;무료배송&apos;, 배송비가 있는데 무료배송 조건이 0이면 &apos;조건 없음&apos;으로 표시돼요. 반품비가 9999·999999처럼 9로만 채워져 있으면 &apos;반품 불가&apos;로 표시돼요. 제주/도서산간 칸을 비우면 &apos;배송 불가&apos;로 표시돼요. 파란 칸은 와이어드민 값과 다른 칸이에요.
            </div>

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
              {err && <span className="err">{err}</span>}
              <button className="btn" onClick={() => onClose(false)}>취소</button>
              <button className="btn primary" onClick={save} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
