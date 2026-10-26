import { NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  await ensureSchema();
  const b = await req.json().catch(() => ({}));
  await sql`update sync_batches set status = 'discarded' where id = ${Number(b.batchId)} and status in ('pending', 'collecting')`;
  await sql`delete from sync_items where batch_id = ${Number(b.batchId)}`;
  return NextResponse.json({ ok: true });
}
