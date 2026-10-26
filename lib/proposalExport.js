import { sql } from './db';
import { getRequest, applyRates } from './proposals';
import { effectiveOptions, withCompanyMargin, presentOption, selectedPolicy } from './display';
import { buildProposalXlsx } from './proposalXlsx';

// 총괄 페이지에서 업체별 제안서 엑셀 만들기 (수수료는 항상 표시: 열어준 제안서 수수료 → 없으면 기본값)
export async function exportProposal({ partner, productId, origin }) {
  const [r] = await sql`
    select p.*, e.policy_id, e.options, e.display_name
    from products p left join product_edits e on e.product_id = p.id
    where p.id = ${productId}`;
  if (!r) return null;

  const pr = await getRequest(partner.id, productId);
  const rates = pr?.status === 'answered' ? pr.rates : null;
  const opts = applyRates(withCompanyMargin(effectiveOptions(r, r), partner.company_margin), rates);
  const first = opts[0] ? presentOption(opts[0]) : null;
  const raw = selectedPolicy(r, r)?.options?.[0] || {};
  const combined = raw.combinedShippingType === 'IMPOSSIBLE' ? '불가' : Number(raw.combinedShippingCondition) ? `${raw.combinedShippingCondition}개까지` : raw.combinedShippingType ? '가능' : '';
  const name = r.display_name || r.name;

  const buf = await buildProposalXlsx({
    product: { name, brand: r.brand, salesUrl: r.sales_url || `${origin}/p/${partner.slug}?p=${productId}` },
    options: opts,
    showCommission: true,
    manager: partner.our_manager && partner.our_manager !== '정석호' ? { name: partner.our_manager, phone: partner.manager_contact || '' } : null,
    ship: first
      ? {
          deliveryCompany: raw.deliveryCompany || '',
          cutoff: raw.sameDayShippingCutoffTime ? `${raw.sameDayShippingCutoffTime}` : '',
          shipping: first.shipping,
          freeCondition: first.freeShippingCondition,
          jeju: first.jeju,
          remote: first.remote,
          returnCost: first.returnCost,
          combined,
        }
      : {},
  });
  const fname = `제안서_${name}_${partner.name}.xlsx`.replace(/[\\/:*?"<>|]/g, ' ');
  return { buf, fname };
}
