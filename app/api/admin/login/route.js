import { NextResponse } from 'next/server';
import { COOKIE, adminToken } from '@/lib/auth';

export async function POST(req) {
  const { password } = await req.json().catch(() => ({}));
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: '비밀번호가 맞지 않아요.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await adminToken(), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return res;
}
