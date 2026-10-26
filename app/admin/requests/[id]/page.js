import { notFound } from 'next/navigation';
import AdminNav from '@/components/AdminNav';
import { ensureSchema, sql } from '@/lib/db';
import { effectiveOptions, selectedPolicy } from '@/lib/display';
import { fmtDate } from '@/lib/stats';
import RequestEditor from './RequestEditor';

export const dynamic = 'force-dynamic';

export default async function RequestPage({ params }) {
  await ensureSchema();
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) notFound();
  const [r] = await sql`
    select r.*, pa.name as partner_name, pa.slug, pa.our_manager, pa.company_margin
    from proposal_requests r join partners pa on pa.id = r.partner_id where r.id = ${id}`;
  if (!r) notFound();
  const [p] = await sql`
    select p.*, e.policy_id, e.options, e.display_name
    from products p left join product_edits e on e.product_id = p.id where p.id = ${r.product_id}`;
  if (!p) notFound();
  // 총 수수료(총 마진율): 와이어드민 가격구조 원본 값. 직접 수정한 가격이면 기본 수수료 + 5로 추정
  const raw = selectedPolicy(p, p)?.options || [];
  const margin = r.company_margin != null ? Number(r.company_margin) : 5;
  const opts = effectiveOptions(p, p).map((o, i) => {
    const t = raw[i]?.totalMarginRate;
    const total = t != null && !isNaN(Number(t)) ? Number(t) : o.commissionRate != null ? Number(o.commissionRate) + 5 : null;
    return {
      name: o.name, configuration: o.configuration, consumerPrice: o.consumerPrice, groupPurchasePrice: o.groupPurchasePrice,
      defaultRate: total != null ? Math.round((total - margin) * 10) / 10 : o.commissionRate, totalRate: total, totalEstimated: !(t != null && !isNaN(Number(t))),
    };
  });
  return (
    <>
      <AdminNav on="requests" />
      <div className="adm">
        <h1>제안서 작성</h1>
        <p className="desc">{fmtDate(r.created_at)} · <b>{r.partner_name}</b>{r.our_manager ? ` (담당 ${r.our_manager})` : ''}님이 요청했어요.</p>
        <RequestEditor
          req={{ margin, id: r.id, status: r.status, rates: r.rates, note: r.note || '', slug: r.slug, partnerName: r.partner_name, productId: r.product_id }}
          product={{ name: p.display_name || p.name, brand: p.brand, image: p.image_url }}
          options={opts}
        />
      </div>
    </>
  );
}
