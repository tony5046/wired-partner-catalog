import { NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { refreshPriceFrom } from '@/lib/products';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 목록용 '공구가 ~부터' 전체 재계산
export async function POST() {
  await ensureSchema();
  const ids = (await sql`select id from products where active`).map((r) => r.id);
  await refreshPriceFrom(ids);
  return NextResponse.json({ ok: true, count: ids.length });
}
