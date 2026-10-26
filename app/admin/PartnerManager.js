'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function PartnerManager({ origin, initial }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', our_manager: '', manager_contact: '', memo: '', show_commission: true, company_margin: '5' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [sort, setSort] = useState('score');
  const [q, setQ] = useState('');
  const [copied, setCopied] = useState(null);
  const [comm, setComm] = useState({});
  const commOn = (r) => (r.id in comm ? comm[r.id] : r.show_commission !== false);
  const toggleComm = async (id, on) => {
    setComm((c) => ({ ...c, [id]: on }));
    const res = await fetch('/api/admin/partners', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, show_commission: on }) });
    if (!res.ok) { setComm((c) => ({ ...c, [id]: !on })); alert('저장에 실패했어요.'); }
  };

  const rows = useMemo(() => {
    const k = q.trim();
    const list = initial.filter((r) => !k || r.name.includes(k) || (r.our_manager || '').includes(k));
    const by = {
      score: (a, b) => b.interest.score - a.interest.score,
      recent: (a, b) => String(b.last_visit || '').localeCompare(String(a.last_visit || '')),
      created: (a, b) => b.created_at.localeCompare(a.created_at),
    }[sort];
    return [...list].sort(by);
  }, [initial, sort, q]);

  const create = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    setMsg('');
    const r = await fetch('/api/admin/partners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setBusy(false);
    if (r.ok) {
      const p = await r.json();
      setForm({ name: '', our_manager: form.our_manager, manager_contact: form.manager_contact, memo: '', show_commission: form.show_commission, company_margin: form.company_margin });
      copy(p.slug);
      setMsg(`${p.name} 링크가 만들어졌고 클립보드에 복사됐어요.`);
      router.refresh();
    } else setMsg('등록에 실패했어요.');
  };

  const copy = async (slug) => {
    const url = `${origin}/p/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('링크를 복사하세요', url);
    }
    setCopied(slug);
    setTimeout(() => setCopied(null), 1500);
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <form className="panel" onSubmit={create}>
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>업체 링크 만들기</h3>
        <div className="row">
          <input className="input" style={{ flex: '2 1 200px' }} placeholder="업체명 (필수)" value={form.name} onChange={set('name')} />
          <input className="input" style={{ flex: '1 1 120px' }} placeholder="우리 담당자" value={form.our_manager} onChange={set('our_manager')} />
          <input className="input" style={{ flex: '1 1 150px' }} placeholder="담당자 연락처 (업체에 표시)" value={form.manager_contact} onChange={set('manager_contact')} />
          <input className="input" style={{ flex: '2 1 200px' }} placeholder="메모 (내부용)" value={form.memo} onChange={set('memo')} />
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} title="총 수수료에서 회사가 가져갈 몫 (기본 5%)">
            회사 몫
            <input className="input" style={{ width: 60 }} inputMode="decimal" value={form.company_margin} onChange={set('company_margin')} />%
          </label>
          <label className="toggle">
            <input type="checkbox" checked={form.show_commission} onChange={(e) => setForm({ ...form, show_commission: e.target.checked })} />
            <span className="toggle-ui" /> 수수료 공개
          </label>
          <button className="btn primary" disabled={busy || !form.name.trim()}>링크 생성</button>
        </div>
        {msg && <div className="ok" style={{ marginTop: 8 }}>{msg}</div>}
      </form>

      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>업체별 관심도 ({initial.length})</h3>
          <div className="row">
            <input className="input" placeholder="업체/담당자 검색" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="score">관심도순</option>
              <option value="recent">최근 방문순</option>
              <option value="created">등록순</option>
            </select>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>업체</th><th>관심도</th><th>마지막 방문</th>
                <th className="num">방문</th><th className="num">7일 방문</th><th className="num">방문일수</th>
                <th className="num">본 상품</th><th className="num">링크 클릭</th><th className="num">제안서 전달</th><th className="num">체류</th>
                <th>수수료 공개</th>
                <th>링크</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length && (
                <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--muted)', padding: 30 }}>등록된 업체가 없어요.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/admin/partners/${r.id}`} style={{ fontWeight: 600 }}>{r.name}</Link>
                    <div className="desc" style={{ margin: 0 }}>{[r.our_manager, Number(r.company_margin) !== 5 ? `회사 몫 ${Number(r.company_margin)}%` : '', r.memo].filter(Boolean).join(' · ') || ' '}</div>
                  </td>
                  <td><span className={`badge ${r.interest.cls}`}>{r.interest.label}{r.interest.score ? ` ${r.interest.score}` : ''}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.lastVisitText}</td>
                  <td className="num">{r.visits}</td>
                  <td className="num">{r.visits7}</td>
                  <td className="num">{r.days}</td>
                  <td className="num">{r.products_viewed}</td>
                  <td className="num">{r.links}</td>
                  <td className="num">{Number(r.downloads || 0)}</td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>{r.dwellText}</td>
                  <td>
                    <label className="toggle" title={commOn(r) ? '업체 링크에 수수료가 보여요' : '업체 링크에서 수수료가 숨겨져요'}>
                      <input type="checkbox" checked={commOn(r)} onChange={(e) => toggleComm(r.id, e.target.checked)} />
                      <span className="toggle-ui" /> {commOn(r) ? 'ON' : 'OFF'}
                    </label>
                  </td>
                  <td>
                    <div className="linkbox">
                      <a className="btn small" href={`/admin/partners/${r.id}`} title="이 업체에 보여줄 상품 관리">상품 관리</a>
                      <button className="btn small" onClick={() => copy(r.slug)}>{copied === r.slug ? '복사됨' : '링크 복사'}</button>
                      <a className="btn small" href={`/p/${r.slug}?preview=1`} target="_blank" rel="noreferrer" title="통계·요청이 기록되지 않는 관리자 미리보기">미리보기</a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="desc" style={{ margin: '10px 0 0' }}>
          관심도 = 최근 7일 방문×3 + 방문일수×2 + 본 상품 수 + 링크 클릭×3 + 체류(분)×0.5 · 마지막 방문이 14일 넘으면 절반. 30 이상 높음, 10 이상 보통.
        </div>
      </div>
    </>
  );
}
