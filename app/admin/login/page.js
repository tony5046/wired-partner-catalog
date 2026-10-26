'use client';
import { useState } from 'react';

export default function Login() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    if (r.ok) location.href = '/admin';
    else setErr((await r.json()).error || '로그인 실패');
  };
  return (
    <form className="login" onSubmit={submit}>
      <b style={{ fontSize: 18 }}>상품 카탈로그 관리자</b>
      <input className="input" type="password" placeholder="비밀번호" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
      <button className="btn primary">로그인</button>
      {err && <div className="err">{err}</div>}
    </form>
  );
}
