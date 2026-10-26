export const COOKIE = 'wc_admin';

export async function adminToken() {
  const pw = process.env.ADMIN_PASSWORD || '';
  const data = new TextEncoder().encode('partner-catalog:' + pw);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function isAdminRequest(req) {
  if (!process.env.ADMIN_PASSWORD) return false;
  const c = req.cookies.get(COOKIE)?.value;
  return !!c && c === (await adminToken());
}

// 동기화 키: SYNC_KEY가 없으면 관리자 비밀번호로부터 자동 생성
export async function syncKey() {
  if (process.env.SYNC_KEY) return process.env.SYNC_KEY;
  if (!process.env.ADMIN_PASSWORD) return '';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('sync:' + process.env.ADMIN_PASSWORD));
  return Array.from(new Uint8Array(buf)).slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function syncKeyOk(k) {
  const key = await syncKey();
  return !!key && k === key;
}
