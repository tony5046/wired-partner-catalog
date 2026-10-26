import { NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  await ensureSchema();
  const id = parseInt(params.id, 10);
  const b = await req.json().catch(() => ({}));
  if (b.action === 'open') {
    const rates = (Array.isArray(b.rates) ? b.rates : []).slice(0, 50).map((v) => (v == null || v === '' || isNaN(Number(v)) ? null : Math.round(Number(v) * 10) / 10));
    const note = b.note ? String(b.note).slice(0, 1000) : null;
    const r = await sql`update proposal_requests set status = 'answered', rates = ${sql.json(rates)}, note = ${note}, answered_at = now() where id = ${id}`;
    return r.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  if (b.action === 'revoke') {
    await sql`update proposal_requests set status = 'revoked' where id = ${id}`;
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
