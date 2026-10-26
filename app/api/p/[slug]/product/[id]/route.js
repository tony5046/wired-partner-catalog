import { NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { getPartnerBySlug, getDetail } from '@/lib/products';
import { getRequest } from '@/lib/proposals';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  await ensureSchema();
  const partner = await getPartnerBySlug(params.slug);
  if (!partner) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // 수수료 비공개 업체: 담당자가 제안서를 열어준 상품만 수수료 공개
  let show = partner.show_commission !== false;
  let rates = null;
  let proposal = null;
  if (!show) {
    const pr = await getRequest(partner.id, id);
    if (pr?.status === 'answered') {
      show = true;
      rates = pr.rates;
      proposal = { status: 'answered', note: pr.note || '' };
    } else proposal = { status: pr ? 'requested' : 'none' };
  }
  const detail = await getDetail(id, { showCommission: show, rates, partnerId: partner.id, margin: partner.company_margin });
  if (!detail) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const sid = (req.nextUrl.searchParams.get('sid') || '').slice(0, 64);
  if (req.nextUrl.searchParams.get('preview') !== '1')
    await sql`insert into events (partner_id, session_id, type, product_id) values (${partner.id}, ${sid}, 'view', ${id})`;
  return NextResponse.json({ ...detail, proposal });
}
