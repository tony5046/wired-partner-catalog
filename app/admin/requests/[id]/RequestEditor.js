'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const won = (n) => (n ? `${Math.round(Number(n)).toLocaleString('ko-KR')}원` : '-');

export default function RequestEditor({ req, product, options }) {
  const [rates, setRates] = useState(() => options.map((o, i) => {
    const v = Array.isArray(req.rates) && req.rates[i] != null ? req.rates[i] : o.defaultRate;
    return v == null ? '' : String(v);
  }));
  const [bulk, setBulk] = useState('');
  const [note, setNote] = useState(req.note);
  const [status, setStatus] = useState(req.status);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [done, setDone] = useState(null);
  const router = useRouter();

  const send = async (action) => {
    if (action === 'revoke' && !window.confirm('제안서를 닫을까요? 업체 페이지에서 수수료가 다시 숨겨져요.')) return;
    if (action === 'open') {
      const loss = options.filter((o, i) => o.totalRate != null && rates[i] !== '' && Number(rates[i]) > o.totalRate).length;
      if (loss && !window.confirm(`${loss}개 옵션은 업체 수수료가 총 수수료보다 높아 회사 몫이 마이너스예요. 그래도 열까요?`)) return;
    }
    setBusy(true);
    setMsg('');
    const r = await fetch(`/api/admin/requests/${req.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, rates: rates.map((v) => (v === '' ? null : Number(v))), note }),
    });
    setBusy(false);
    if (r.ok) {
      setStatus(action === 'open' ? 'answered' : 'revoked');
      setDone(action);
      router.refresh();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const j = await r.json().catch(() => ({}));
      setMsg(`저장에 실패했어요. ${j.error || r.status}`);
    }
  };

  const previewUrl = `/p/${req.slug}?preview=1&p=${req.productId}`;

  return (
    <>
      {done && (
        <div className="done-banner">
          <b>{done === 'open' ? `등록 완료! ${req.partnerName}님 페이지에 제안서가 열렸어요.` : '제안서를 닫았어요. 업체 페이지에서 수수료가 다시 숨겨져요.'}</b>
          <div className="row">
            <a className="btn small" href={previewUrl} target="_blank" rel="noreferrer">업체 화면 확인 ↗</a>
            <a className="btn small primary" href="/admin/requests">요청 목록으로</a>
          </div>
        </div>
      )}
      <div className="panel">
        <div className="row" style={{ flexWrap: 'nowrap', marginBottom: 14 }}>
          {product.image ? <img className="small-thumb" style={{ width: 64, height: 64 }} src={product.image} alt="" /> : null}
          <div>
            <div className="desc" style={{ margin: 0 }}>{product.brand || ''}</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{product.name}</div>
            <span className={`badge ${status === 'answered' ? 'edit' : status === 'revoked' ? 'none' : 'warm'}`}>{status === 'answered' ? '제안서 오픈됨' : status === 'revoked' ? '닫음' : '작성 대기'}</span>
          </div>
        </div>

        <div className="row bulk-bar">
          <b style={{ fontSize: 13 }}>전 옵션 일괄</b>
          <input className="input" style={{ width: 110 }} inputMode="decimal" placeholder="수수료 %" value={bulk} onChange={(e) => setBulk(e.target.value)} />
          <button className="btn small" disabled={!bulk.trim()} onClick={() => setRates(rates.map(() => bulk.trim()))}>적용</button>
          <span className="desc" style={{ margin: 0 }}>기본값은 총 수수료 − {req.partnerName}님 회사 몫 {req.margin}%예요. 회사 몫 = 총 수수료 − 업체 수수료 (5% 미만 주황, 마이너스 빨강)</span>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>옵션</th><th className="num">소비자가</th><th className="num">공동구매가</th><th className="num">총 수수료</th><th style={{ width: 130 }}>{req.partnerName}님 수수료 (%)</th><th className="num">업체 수수료 금액</th><th className="num">회사 몫</th></tr></thead>
            <tbody>
              {options.map((o, i) => {
                const rate = Number(rates[i]);
                const changed = rates[i] !== '' && String(o.defaultRate ?? '') !== rates[i];
                return (
                  <tr key={i}>
                    <td><b>{o.name}</b>{o.configuration && o.configuration !== o.name && <div className="desc" style={{ margin: 0 }}>{o.configuration}</div>}</td>
                    <td className="num">{won(o.consumerPrice)}</td>
                    <td className="num" style={{ color: 'var(--accent)', fontWeight: 700 }}>{won(o.groupPurchasePrice)}</td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                      {o.totalRate != null ? <><b>{o.totalRate}%</b><div className="desc" style={{ margin: 0 }}>{won((o.groupPurchasePrice * o.totalRate) / 100)}{o.totalEstimated ? ' (추정)' : ''}</div></> : '-'}
                    </td>
                    <td>
                      <input className={`input ${changed ? 'changed-input' : ''}`} style={{ width: '100%' }} inputMode="decimal" value={rates[i]} placeholder={o.defaultRate != null ? String(o.defaultRate) : '-'}
                        onChange={(e) => setRates(rates.map((v, j) => (j === i ? e.target.value.replace(/[^0-9.]/g, '') : v)))} />
                      {o.defaultRate != null && <div className="desc" style={{ margin: 0 }}>기본 {o.defaultRate}%</div>}
                    </td>
                    <td className="num" style={{ color: 'var(--good)', fontWeight: 700 }}>{rates[i] !== '' && !isNaN(rate) && o.groupPurchasePrice ? won((o.groupPurchasePrice * rate) / 100) : '-'}</td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                      {o.totalRate != null && rates[i] !== '' && !isNaN(rate) ? (() => {
                        const left = Math.round((o.totalRate - rate) * 10) / 10;
                        const color = left < 0 ? 'var(--bad)' : left < 5 ? 'var(--warn)' : 'var(--text)';
                        return <span style={{ color, fontWeight: 700 }}>{left}%<div className="desc" style={{ margin: 0, color }}>{won((o.groupPurchasePrice * left) / 100)}{left < 0 ? ' 손해' : ''}</div></span>;
                      })() : '-'}
                    </td>
                  </tr>
                );
              })}
              {!options.length && <tr><td colSpan={7} className="desc" style={{ padding: 14 }}>이 상품은 가격구조가 없어요. 상품 관리에서 가격을 먼저 입력해 주세요.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          업체에게 남길 메모 (선택, 제안서 아래에 보여요)
          <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="예) 11월 첫째 주 진행 시 위 수수료 적용 가능합니다." />
        </div>

        <div className="row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
          <a className="btn" href={previewUrl} target="_blank" rel="noreferrer">업체 화면 미리보기 ↗</a>
          <a className="btn" href={`/api/admin/proposal-xlsx?partner=${encodeURIComponent(req.slug)}&product=${req.productId}`} download>제안서 엑셀 받기</a>
          <div className="row">
            {msg && <span className="ok">{msg}</span>}
            {status === 'answered' && <button className="btn danger" disabled={busy} onClick={() => send('revoke')}>제안서 닫기</button>}
            <button className="btn primary" disabled={busy || !options.length} onClick={() => send('open')}>{status === 'answered' ? '수정 내용 저장' : '제안서 열기'}</button>
          </div>
        </div>
      </div>
    </>
  );
}
