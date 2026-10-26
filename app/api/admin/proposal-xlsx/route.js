import { NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { exportProposal } from '@/lib/proposalExport';

export const dynamic = 'force-dynamic';

// 총괄 전용: /api/admin/proposal-xlsx?partner=<업체 id 또는 slug>&product=<상품 id>
export async function GET(req) {
  await ensureSchema();
  const sp = req.nextUrl.searchParams;
  const key = String(sp.get('partner') || '');
  const productId = parseInt(sp.get('product'), 10);
  if (!key || !Number.isFinite(productId)) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const [partner] = /^\d+$/.test(key)
    ? await sql`select * from partners where id = ${parseInt(key, 10)}`
    : await sql`select * from partners where slug = ${key}`;
  if (!partner) return NextResponse.json({ error: 'partner not found' }, { status: 404 });

  const out = await exportProposal({ partner, productId, origin: req.nextUrl.origin });
  if (!out) return NextResponse.json({ error: 'product not found' }, { status: 404 });

  // 전달 기록 (업체별 히스토리)
  await sql`insert into events (partner_id, session_id, type, product_id) values (${partner.id}, 'admin', 'download', ${productId})`;

  return new NextResponse(out.buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="proposal.xlsx"; filename*=UTF-8''${encodeURIComponent(out.fname)}`,
      'Cache-Control': 'no-store',
    },
  });
}
