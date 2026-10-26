'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

const PAGE = 60;
const POP = '인기상품';
const POP_ICON = <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M13.5 1.5s.9 3.2-1.6 6.1C9.7 10.2 8 11.6 8 14.6 8 18 10.6 21 14 21c3.6 0 6-2.9 6-6.6 0-4.6-3.6-6.4-3.6-6.4s.3 2.4-1.4 3.6c0 0 1-5-1.5-10.1zM9.6 21.3C6.9 20.4 5 17.9 5 15c0-2 .7-3.4 1.6-4.6.1 1.6.9 3 1.9 3.6-.1 2.8.4 5.2 1.1 7.3z" /></svg>;
const fmtViews = (n) => (n >= 10000 ? `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}만` : Number(n || 0).toLocaleString('ko-KR'));
const won = (n) => `${Number(n).toLocaleString('ko-KR')}원`;

function getSid() {
  try {
    let s = sessionStorage.getItem('wc_sid');
    if (!s) {
      s = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('wc_sid', s);
    }
    return s;
  } catch {
    return 'nosession';
  }
}

export default function Catalog({ partner }) {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('전체');
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState(null);
  const [preview, setPreview] = useState(false);
  const sidRef = useRef('');
  const previewRef = useRef(false);

  const track = (type, extra = {}) => {
    if (previewRef.current) return;
    const body = JSON.stringify({ slug: partner.slug, sid: sidRef.current, type, ...extra });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon('/api/track', new Blob([body], { type: 'text/plain' }))) return;
    } catch {}
    fetch('/api/track', { method: 'POST', body, keepalive: true }).catch(() => {});
  };

  useEffect(() => {
    sidRef.current = getSid();
    previewRef.current = new URLSearchParams(location.search).get('preview') === '1';
    if (previewRef.current) setPreview(true);
    track('visit');
    fetch(`/api/p/${partner.slug}/products`).then((r) => r.json()).then((d) => {
      const list = d.items || [];
      setItems(list);
      // ?p=상품ID 로 들어오면 그 상품 바로 열기
      const pid = Number(new URLSearchParams(location.search).get('p'));
      const hit = pid && list.find((i) => i[0] === pid);
      if (hit) setOpen(hit);
    }).catch(() => setItems([]));

    // 체류시간: 화면이 보이고 최근 2분 내 활동이 있을 때만 30초마다 기록
    let last = Date.now();
    const mark = () => (last = Date.now());
    const evs = ['scroll', 'mousemove', 'keydown', 'touchstart', 'click'];
    evs.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - last < 120000) track('ping', { value: 30 });
    }, 30000);
    return () => {
      clearInterval(t);
      evs.forEach((e) => window.removeEventListener(e, mark));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cats = useMemo(() => {
    if (!items) return [];
    const m = new Map();
    items.forEach((i) => i[3] && m.set(i[3], (m.get(i[3]) || 0) + 1));
    const hasPop = items.some((i) => i[6]);
    return ['전체', ...(hasPop ? [POP] : []), ...[...m.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)];
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const k = q.trim().toLowerCase().replace(/\s+/g, '');
    return items.filter((i) => {
      if (cat === POP) { if (!i[6]) return false; }
      else if (cat !== '전체' && i[3] !== cat) return false;
      if (!k) return true;
      return `${i[1]}${i[2] || ''}`.toLowerCase().replace(/\s+/g, '').includes(k);
    });
  }, [items, q, cat]);

  useEffect(() => setLimit(PAGE), [q, cat]);

  return (
    <>
      {preview && <div style={{ background: '#16181d', color: '#fff', fontSize: 13, textAlign: 'center', padding: '6px 12px' }}>관리자 미리보기 · 이 화면의 활동은 통계에 기록되지 않아요</div>}
      <header className="cat-header">
        <div className="inner">
          <div className="brandline">WIRED COMPANY</div>
          <h1>{partner.name}님을 위한 상품 제안</h1>
          <p>와이어드컴퍼니가 공급 중인 공동구매 상품입니다. 상품을 누르면 가격 구성과 진행 조건을 볼 수 있어요.</p>
          {(partner.manager || partner.contact) && (
            <div className="contact">
              담당자 <b>{partner.manager}</b> {partner.contact && <>· {partner.contact}</>}
            </div>
          )}
        </div>
      </header>

      <div className="toolbar">
        <div className="inner">
          <input className="search" placeholder="상품명, 브랜드 검색" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="count">{items ? `${filtered.length.toLocaleString()}개 상품` : ''}</span>
          <div className="chips">
            {cats.map((c) => (
              <button key={c} className={`chip ${c === cat ? 'on' : ''} ${c === POP ? 'pop' : ''}`} onClick={() => setCat(c)}>
                {c === POP ? <>{POP_ICON} {c}</> : c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid">
        {!items && <div className="empty-state">상품을 불러오는 중…</div>}
        {items && !filtered.length && <div className="empty-state">조건에 맞는 상품이 없어요.</div>}
        {filtered.slice(0, limit).map((i) => (
          <button key={i[0]} className="card" onClick={() => setOpen(i)}>
            <div className="thumb-wrap">
              {i[4] ? <img className="thumb" src={i[4]} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /> : <div className="thumb empty">이미지 준비중</div>}
              {i[6] ? <span className="pop-badge">{POP_ICON}{POP}</span> : null}
              {i[7] ? <span className="prop-badge">제안서 도착</span> : null}
            </div>
            <div className="body">
              <div className="brand">{i[2] || ' '}</div>
              <div className="name">{i[1]}</div>
              {i[5] ? <div className="price">공구가 {won(i[5])}~</div> : <div className="price none">가격 조율중</div>}
            </div>
          </button>
        ))}
      </div>
      {filtered.length > limit && (
        <button className="more" onClick={() => setLimit((l) => l + PAGE)}>
          더 보기 ({(filtered.length - limit).toLocaleString()}개 남음)
        </button>
      )}

      {open && <ProductModal item={open} slug={partner.slug} partnerName={partner.name} sid={sidRef.current} preview={preview} onClose={() => setOpen(null)} onLink={(id) => track('link', { productId: id })} onReel={(id) => track('reel', { productId: id })} />}
    </>
  );
}

function ProductModal({ item, slug, partnerName, sid, preview, onClose, onLink, onReel }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch(`/api/p/${slug}/product/${item[0]}?sid=${encodeURIComponent(sid)}${preview ? '&preview=1' : ''}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setD)
      .catch(() => setErr(true));
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <button className="close" onClick={onClose} aria-label="닫기">×</button>
        <div className="m-top">
          {item[4] ? <img className="m-img" src={item[4]} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /> : <div className="m-img thumb empty">이미지 준비중</div>}
          <div className="info">
            <div className="brand">{item[2]}</div>
            <h2>{item[1]}</h2>
            {item[6] ? <span className="pop-badge inline">{POP_ICON}{POP}</span> : null}
            {item[3] && <span className="tag">{item[3]}</span>}
            {d?.hurdle && (
              <div className="cond">
                <div className="cond-ic" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 16.8 6.1 20l1.3-6.5L2.5 8.9l6.6-.8z"/></svg>
                </div>
                <div>
                  <div className="cond-label">진행 조건</div>
                  <div className="cond-value">{d.hurdle}</div>
                </div>
              </div>
            )}
            {d?.usp && <div className="usp">{d.usp}</div>}
            {d?.salesUrl && (
              <div className="actions">
                <a className="btn primary" href={d.salesUrl} target="_blank" rel="noopener noreferrer" onClick={() => onLink(item[0])}>
                  제품 페이지 보기 ↗
                </a>
              </div>
            )}
            {d?.reels?.length > 0 && (
              <div className="reels">
                <div className="reels-h">관련 컨텐츠 보러가기</div>
                <div className="reels-grid">
                  {d.reels.map((r) => (
                    <a key={r.code} className="reel" href={`https://www.instagram.com/reel/${r.code}/`} target="_blank" rel="noopener noreferrer" onClick={() => onReel(item[0])}>
                      <div className="reel-thumb">
                        {r.thumb ? <img src={r.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /> : null}
                        <span className="reel-play" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>
                        <span className="reel-views">▶ {fmtViews(r.views)}</span>
                      </div>
                      {r.account && <div className="reel-acc">@{r.account}</div>}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {err && <div className="loading">상품 정보를 불러오지 못했어요.</div>}
        {!d && !err && <div className="loading">불러오는 중…</div>}
        {d && (
          <>
            <PriceSection options={d.options} />
            {d.proposal && <ProposalBox proposal={d.proposal} productId={item[0]} slug={slug} sid={sid} preview={preview} partnerName={partnerName} />}
            <div className="section" style={{ paddingTop: 0 }}>
              <div className="note">가격 및 조건은 진행 시점에 따라 변동될 수 있습니다.</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const svg = (d) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const ICONS = {
  shipping: svg(<><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="17.5" r="1.6" /><circle cx="17" cy="17.5" r="1.6" /></>),
  freeShippingCondition: svg(<><path d="M20 12v8H4v-8" /><path d="M2 7h20v5H2z" /><path d="M12 22V7" /><path d="M12 7c-2-3-6-3-6 0s4 0 6 0zM12 7c2-3 6-3 6 0s-4 0-6 0z" /></>),
  returnCost: svg(<><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 010 11H11" /></>),
  jeju: svg(<><path d="M2 18c2.5 0 2.5-1.5 5-1.5S9.5 18 12 18s2.5-1.5 5-1.5 2.5 1.5 5 1.5" /><path d="M7 14l5-9 5 9z" /></>),
  remote: svg(<><path d="M12 21s-7-6.1-7-11.5a7 7 0 0114 0C19 14.9 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>),
};

const SHIP_FIELDS = [
  ['shipping', '배송비'],
  ['freeShippingCondition', '무료배송 조건'],
  ['returnCost', '단순변심 반품비(왕복)'],
  ['jeju', '제주 추가비용'],
  ['remote', '도서산간 추가비용'],
];

// 배송 조건이 모든 옵션에서 같으면 상단에 한 번만, 다르면 옵션별로 표시
function PriceSection({ options }) {
  if (!options.length) {
    return (
      <div className="section">
        <h3>가격 구성</h3>
        <div className="hurdle" style={{ background: '#f6f7f9', borderColor: 'var(--line)' }}>가격 조율중이에요. 담당자에게 문의해 주세요.</div>
      </div>
    );
  }
  const common = SHIP_FIELDS.filter(([k]) => options.every((o) => o[k] === options[0][k]));
  const showComm = options.some((o) => o.commissionPct !== undefined);
  const varying = SHIP_FIELDS.filter(([k]) => !common.some(([c]) => c === k));
  return (
    <>
      {common.length > 0 && (
        <div className="section">
          <h3>배송 · 반품{options.length > 1 ? <span className="h3-sub">전 옵션 공통</span> : null}</h3>
          <div className="specs">
            {common.map(([k, l]) => {
              const v = options[0][k];
              const tone = /무료|추가비용 없음/.test(v) ? 'good' : /불가/.test(v) ? 'bad' : '';
              return (
                <div className="spec" key={k}>
                  <span className="spec-ic" aria-hidden="true">{ICONS[k]}</span>
                  <div className="spec-txt">
                    <span className="spec-l">{l}</span>
                    <span className={`spec-v ${tone}`}>{v}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="section">
        <h3>옵션별 가격 <span className="h3-sub">{options.length}개 옵션</span></h3>
        <div className="price-table" style={{ '--gtc': `minmax(180px, 2.2fr) repeat(${(showComm ? 3 : 2) + varying.length}, minmax(88px, 1fr))` }}>
          <div className="pt-head">
            <span>옵션</span><span>소비자가</span><span>공동구매가</span>{showComm && <span>수수료</span>}
            {varying.map(([k, l]) => <span key={k}>{l}</span>)}
          </div>
          {options.map((o, i) => (
            <div className="pt-row" key={i}>
              <div className="pt-name">
                <b>{o.name}</b>
                {o.configuration && o.configuration !== o.name && o.configuration !== '-' && <small>{o.configuration}</small>}
              </div>
              <div className="pt-cell"><em>소비자가</em><s className="strike">{o.consumerPrice}</s></div>
              <div className="pt-cell"><em>공동구매가</em><strong>{o.groupPurchasePrice}</strong></div>
              {showComm && <div className="pt-cell"><em>수수료</em><span className="comm-box"><strong className="comm">{o.commissionPct}</strong>{o.commissionWon && <small className="comm-won">({o.commissionWon})</small>}</span></div>}
              {varying.map(([k, l]) => (
                <div className="pt-cell" key={k}><em>{l}</em><span>{o[k]}</span></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// 수수료 비공개 업체용: 제안서 요청 / 요청 완료 / 제안서 도착
function ProposalBox({ proposal, productId, slug, sid, preview, partnerName }) {
  const [status, setStatus] = useState(proposal.status);
  const [busy, setBusy] = useState(false);
  const request = async () => {
    setBusy(true);
    const r = await fetch(`/api/p/${slug}/proposal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, sid, preview }) });
    setBusy(false);
    if (r.ok) setStatus((await r.json()).status || 'requested');
  };
  if (status === 'answered') {
    return (
      <div className="section">
        <div className="prop-box done">
          <div className="prop-ic" aria-hidden="true">✓</div>
          <div>
            <b>{partnerName}님 전용 제안서가 도착했어요</b>
            <p>위 옵션별 가격의 수수료가 {partnerName}님께 제안드리는 조건이에요.</p>
            {proposal.note && <p className="prop-note">{proposal.note}</p>}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="section">
      <div className={`prop-box ${status === 'requested' ? 'wait' : ''}`}>
        <div className="prop-ic" aria-hidden="true">{status === 'requested' ? '⏳' : '✉'}</div>
        <div style={{ flex: 1 }}>
          {status === 'requested' ? (
            <>
              <b>제안서 요청이 접수됐어요</b>
              <p>담당자가 수수료 조건을 정리해서 이 페이지에서 바로 열어드릴게요.</p>
              {preview && <p style={{ color: 'var(--bad)', fontWeight: 600 }}>관리자 미리보기라 실제 요청·슬랙 알림은 보내지 않았어요. 업체 링크(미리보기 아님)에서 눌러야 전송돼요.</p>}
            </>
          ) : (
            <>
              <b>수수료 조건이 궁금하신가요?</b>
              <p>요청하시면 담당자가 {partnerName}님께 맞춘 수수료로 제안서를 열어드려요.</p>
            </>
          )}
        </div>
        {status !== 'requested' && (
          <button className="btn primary" onClick={request} disabled={busy}>{busy ? '요청 중…' : '제안서 요청하기'}</button>
        )}
      </div>
    </div>
  );
}
