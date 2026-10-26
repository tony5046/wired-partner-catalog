import { NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

function slug() {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  const b = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(b, (x) => a[x % a.length]).join('');
}
// 회사 몫 %: 0~50, 비우면 기본 5
const margin = (v) => { const n = Number(v); return v === '' || v == null || isNaN(n) ? 5 : Math.min(50, Math.max(0, Math.round(n * 10) / 10)); };
const clean = (v, n = 200) => (v == null ? null : String(v).trim().slice(0, n) || null);

export async function POST(req) {
  await ensureSchema();
  const b = await req.json();
  const name = clean(b.name, 100);
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const [p] = await sql`
    insert into partners (slug, name, our_manager, manager_contact, memo, show_commission, company_margin)
    values (${slug()}, ${name}, ${clean(b.our_manager, 50)}, ${clean(b.manager_contact, 100)}, ${clean(b.memo, 500)}, ${b.show_commission !== false}, ${margin(b.company_margin)})
    returning id, slug, name`;
  return NextResponse.json(p);
}

export async function PATCH(req) {
  await ensureSchema();
  const b = await req.json();
  const id = Number(b.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'id' }, { status: 400 });
  const patch = {};
  if ('name' in b && clean(b.name, 100)) patch.name = clean(b.name, 100);
  if ('our_manager' in b) patch.our_manager = clean(b.our_manager, 50);
  if ('manager_contact' in b) patch.manager_contact = clean(b.manager_contact, 100);
  if ('memo' in b) patch.memo = clean(b.memo, 500);
  if ('archived' in b) patch.archived = !!b.archived;
  if ('show_commission' in b) patch.show_commission = !!b.show_commission;
  if ('company_margin' in b) patch.company_margin = margin(b.company_margin);
  if (!Object.keys(patch).length) return NextResponse.json({ ok: true });
  await sql`update partners set ${sql(patch)} where id = ${id}`;
  return NextResponse.json({ ok: true });
}
