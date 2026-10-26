import { NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { getPartnerBySlug } from '@/lib/products';

export const dynamic = 'force-dynamic';
const TYPES = new Set(['visit', 'link', 'ping', 'reel']);

export async function POST(req) {
  let body;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const { slug, sid, type, productId, value } = body || {};
  if (!TYPES.has(type) || typeof slug !== 'string') return new NextResponse(null, { status: 400 });
  await ensureSchema();
  const partner = await getPartnerBySlug(slug);
  if (!partner) return new NextResponse(null, { status: 404 });
  const pid = Number.isInteger(productId) ? productId : null;
  const val = Number.isInteger(value) ? Math.max(0, Math.min(value, 600)) : null;
  await sql`insert into events (partner_id, session_id, type, product_id, value)
            values (${partner.id}, ${String(sid || '').slice(0, 64)}, ${type}, ${pid}, ${val})`;
  return new NextResponse(null, { status: 204 });
}
