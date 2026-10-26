'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PartnerEdit({ partner, origin }) {
  const router = useRouter();
  const [f, setF] = useState(partner);
  const [msg, setMsg] = useState('');
  const url = `${origin}/p/${partner.slug}`;

  const save = async (patch) => {
    const r = await fetch('/api/admin/partners', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: partner.id, ...patch }) });
    setMsg(r.ok ? '저장됐어요.' : '저장 실패');
    if (r.ok) router.refresh();
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="panel">
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="desc" style={{ margin: 0 }}>전용 링크</span>
        <code className="mono" style={{ background: '#f3f4f6', padding: '6px 10px', borderRadius: 6 }}>{url}</code>
        <button className="btn small" onClick={() => navigator.clipboard.writeText(url).then(() => setMsg('링크 복사됨'))}>복사</button>
        <a className="btn small" href={`${url}?preview=1`} target="_blank" rel="noreferrer">미리보기</a>
      </div>
      <div className="row">
        <input className="input" style={{ flex: '2 1 160px' }} value={f.name} onChange={set('name')} placeholder="업체명" />
        <input className="input" style={{ flex: '1 1 110px' }} value={f.our_manager} onChange={set('our_manager')} placeholder="우리 담당자" />
        <input className="input" style={{ flex: '1 1 140px' }} value={f.manager_contact} onChange={set('manager_contact')} placeholder="담당자 연락처" />
        <input className="input" style={{ flex: '2 1 180px' }} value={f.memo} onChange={set('memo')} placeholder="메모" />
        <button className="btn primary small" onClick={() => save({ name: f.name, our_manager: f.our_manager, manager_contact: f.manager_contact, memo: f.memo })}>저장</button>
        <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} title="총 수수료에서 회사가 가져갈 몫. 업체 수수료 = 총 수수료 - 이 값">
          회사 몫
          <input className="input" style={{ width: 64 }} inputMode="decimal" value={f.company_margin} onChange={set('company_margin')} onBlur={() => save({ company_margin: f.company_margin })} />%
        </label>
        <label className="toggle" title="이 업체 링크에서 수수료를 보여줄지">
          <input type="checkbox" checked={partner.show_commission !== false} onChange={(e) => save({ show_commission: e.target.checked })} />
          <span className="toggle-ui" /> 수수료 공개
        </label>
        <button className="btn small danger" onClick={() => save({ archived: !partner.archived })}>{partner.archived ? '보관 해제' : '보관(링크 차단)'}</button>
      </div>
      {msg && <div className="ok" style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  );
}
