import { notFound } from 'next/navigation';
import AdminNav from '@/components/AdminNav';
import { ensureSchema, sql } from '@/lib/db';
import { autoPolicy, baseOptions, effectiveOptions } from '@/lib/display';
import { EXCLUDE_PATTERN } from '@/lib/exclude';
import { fmtDate } from '@/lib/stats';
import ReviewClient from './ReviewClient';

export const dynamic = 'force-dynamic';

function summarize(opts) {
  const prices = opts.map((o) => Number(o.groupPurchasePrice)).filter((n) => n > 0);
  const rates = [...new Set(opts.map((o) => o.commissionRate).filter((r) => r != null && r !== '').map(Number))].sort((a, b) => a - b);
  return {
    price: prices.length ? Math.min(...prices) : null,
    rate: !rates.length ? '' : rates.length === 1 ? `${rates[0]}` : `${rates[0]}~${rates[rates.length - 1]}`,
    optionCount: opts.length,
  };
}

export default async function ReviewPage({ params }) {
  await ensureSchema();
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id)) notFound();
  const [batch] = await sql`select * from sync_batches where id = ${id}`;
  if (!batch) notFound();
  const items = await sql`
    select i.product_id, i.kind, i.payload, (i.reels is not null) as has_reels,
      p.name as cur_name, p.image_url as cur_image, p.brand as cur_brand, p.vendor as cur_vendor, p.category as cur_category,
      p.price_from as cur_price, p.policies as cur_policies, p.wired_hurdle as cur_wired_hurdle,
      e.product_id as has_edit, e.display_name, e.hurdle, coalesce(e.hidden, false) as hidden, e.policy_id, e.options
    from sync_items i
    left join products p on p.id = i.product_id
    left join product_edits e on e.product_id = i.product_id
    where i.batch_id = ${id} and i.kind <> 'reels'
    order by case i.kind when 'new' then 0 when 'changed' then 1 else 2 end, i.product_id desc`;
  const [{ reels_only }] = await sql`select count(*)::int as reels_only from sync_items where batch_id = ${id} and kind = 'reels'`;
  const re = new RegExp(EXCLUDE_PATTERN, 'i');

  const rows = items.map((r) => {
    const pl = r.payload || {};
    const name = pl.name || r.cur_name || `#${r.product_id}`;
    const cur = r.cur_policies ? summarize(effectiveOptions({ policies: r.cur_policies }, r)) : null;
    // 새 가격구조 기준 (관리자가 수정한 가격이 있으면 그게 유지됨)
    const nextOpts = r.options?.length ? r.options : baseOptions(r.policy_id ? (pl.policies || []).find((p) => p.id === r.policy_id) || autoPolicy(pl.policies) : autoPolicy(pl.policies));
    const nxt = r.kind === 'removed' ? null : summarize(nextOpts);
    return {
      id: r.product_id,
      kind: r.kind,
      name,
      displayName: r.display_name || '',
      image: pl.image_url || r.cur_image || null,
      brand: [pl.vendor || r.cur_vendor, pl.brand || r.cur_brand].filter(Boolean).join(' | '),
      category: pl.category || r.cur_category || '',
      curPrice: r.cur_price ?? null,
      curRate: cur?.rate || '',
      newPrice: nxt?.price ?? null,
      newRate: nxt?.rate || '',
      optionCount: nxt?.optionCount ?? 0,
      customPrice: !!r.options?.length,
      hurdle: r.hurdle || '',
      wiredHurdle: (pl.wired_hurdle || r.cur_wired_hurdle || '').replace(/^NULL$/, ''),
      hidden: r.hidden,
      hasEdit: !!r.has_edit,
      keyword: re.test(name),
      hasReels: r.has_reels,
      priceChanged: r.kind === 'changed' && (cur?.price ?? null) !== (nxt?.price ?? null),
      rateChanged: r.kind === 'changed' && (cur?.rate || '') !== (nxt?.rate || ''),
      // 관리자가 가격을 직접 수정해둔 상품인데 와이어드민 가격이 바뀐 경우
      wiredChanged: r.kind === 'changed' && !!r.options?.length && JSON.stringify(baseOptions(autoPolicy(pl.policies))) !== JSON.stringify(baseOptions(autoPolicy(r.cur_policies || []))),
      wiredNewPrice: summarize(baseOptions(autoPolicy(pl.policies))).price,
      wiredNewRate: summarize(baseOptions(autoPolicy(pl.policies))).rate,
    };
  });

  return (
    <>
      <AdminNav on="sync" />
      <div className="adm" style={{ paddingBottom: 120 }}>
        <h1>동기화 검토 #{batch.id}</h1>
        <p className="desc">
          {fmtDate(batch.created_at)} 와이어드민에서 가져온 변경 목록이에요. 체크한 상품만 업로드되고, 체크 안 한 상품은 다음 동기화 때 다시 목록에 나와요.
          {reels_only ? ` 기존 상품 ${reels_only}개의 관련 릴스도 함께 갱신돼요.` : ''}
        </p>
        {batch.status !== 'pending' ? (
          <div className="panel">{batch.status === 'committed' ? `이미 업로드된 동기화예요 (${fmtDate(batch.committed_at)}).` : batch.status === 'discarded' ? '취소된 동기화예요.' : '아직 와이어드민에서 가져오는 중이에요. 잠시 후 새로고침해 주세요.'}</div>
        ) : (
          <ReviewClient batchId={batch.id} rows={rows} />
        )}
      </div>
    </>
  );
}
