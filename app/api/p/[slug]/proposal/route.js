import { NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { getPartnerBySlug } from '@/lib/products';
import { notifySlack } from '@/lib/slack';

export const dynamic = 'force-dynamic';

// 업체가 '제안서 요청하기' 클릭
export async function POST(req, { params }) {
  await ensureSchema();
  const partner = await getPartnerBySlug(params.slug);
  if (!partner) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const productId = Number(b.productId);
  if (!Number.isInteger(productId)) return NextResponse.json({ error: 'productId' }, { status: 400 });
  const [p] = await sql`
    select p.id, coalesce(nullif(e.display_name, ''), p.name) as name
    from products p left join product_edits e on e.product_id = p.id
    where p.id = ${productId} and p.active and not coalesce(e.hidden, false)
      and not exists (select 1 from partner_exclusions x where x.partner_id = ${partner.id} and x.product_id = p.id)`;
  if (!p) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const preview = b.preview === true;
  const [existing] = await sql`select * from proposal_requests where partner_id = ${partner.id} and product_id = ${productId}`;
  if (existing && existing.status !== 'revoked') return NextResponse.json({ status: existing.status });
  if (preview) return NextResponse.json({ status: 'requested', preview: true });

  const [r] = await sql`
    insert into proposal_requests (partner_id, product_id, status) values (${partner.id}, ${productId}, 'requested')
    on conflict (partner_id, product_id) do update set status = 'requested', created_at = now(), answered_at = null
    returning id`;
  await sql`insert into events (partner_id, session_id, type, product_id) values (${partner.id}, ${String(b.sid || '').slice(0, 64)}, 'request', ${productId})`;

  const origin = `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('x-forwarded-host') || req.headers.get('host')}`;
  const when = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  await notifySlack(
    `:incoming_envelope: *제안서 요청* | *${partner.name}* → ${p.name}\n` +
      `담당: ${partner.our_manager || '-'} · ${when}\n` +
      `<${origin}/admin/requests/${r.id}|수수료 작성하고 제안서 열어주기 →>`
  );
  return NextResponse.json({ status: 'requested' });
}
