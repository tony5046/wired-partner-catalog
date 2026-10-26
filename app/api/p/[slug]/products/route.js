import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { getPartnerBySlug, listForPartner } from '@/lib/products';
import { openedProductIds } from '@/lib/proposals';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  await ensureSchema();
  const partner = await getPartnerBySlug(params.slug);
  if (!partner) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const rows = await listForPartner(partner.id);
  const opened = partner.show_commission === false ? await openedProductIds(partner.id) : new Set();
  // 간결한 배열 형태로 전송 [id, name, brand, category, image, priceFrom, popular, proposalOpened]
  return NextResponse.json(
    { items: rows.map((r) => [r.id, r.name, r.brand, r.category, r.image_url, r.price_from, r.popular ? 1 : 0, opened.has(r.id) ? 1 : 0]) },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
