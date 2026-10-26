// 가격구조 선택 + 업체에게 보여줄 표 형태로 변환

export const OPTION_FIELDS = [
  ['name', '제품명', 'text'],
  ['configuration', '구성', 'text'],
  ['consumerPrice', '소비자가', 'won'],
  ['groupPurchasePrice', '공동구매가', 'won'],
  ['shippingCost', '배송비', 'won'],
  ['freeShippingCondition', '무료배송 조건', 'won'],
  ['returnShippingCost', '단순변심 반품비(왕복)', 'won'],
  ['jejuAdditionalCost', '제주 추가', 'won'],
  ['remoteAreaAdditionalCost', '도서산간 추가', 'won'],
  ['commissionRate', '수수료율(%)', 'num'],
];

function usable(p) {
  return p && Array.isArray(p.options) && p.options.length > 0;
}

// 자동 선택: 가장 최근에 만든 가격구조 (셀러 전용 사본 '[셀러명] …'과 '기본 가격 구조'는 다른 게 없을 때만)
export function autoPolicy(policies = []) {
  const list = policies.filter(usable);
  if (!list.length) return null;
  const rank = (p) => {
    let r = 0;
    if (!/^\s*\[/.test(p.name || '')) r += 2;
    if ((p.name || '').trim() !== '기본 가격 구조') r += 1;
    return r;
  };
  return [...list].sort((a, b) => rank(b) - rank(a) || String(b.createdAt).localeCompare(String(a.createdAt)))[0];
}

export function selectedPolicy(product, edit) {
  const pols = product.policies || [];
  if (edit?.policy_id) {
    const p = pols.find((x) => x.id === edit.policy_id);
    if (usable(p)) return p;
  }
  return autoPolicy(pols);
}

// 원본 옵션 → 편집 가능한 기본값 (수수료율 = 총마진율 - 5)
export function baseOptions(policy) {
  if (!policy) return [];
  return policy.options.map((o) => ({
    name: (o.name || '').trim(),
    configuration: o.configuration || '',
    consumerPrice: num(o.consumerPrice),
    groupPurchasePrice: num(o.groupPurchasePrice),
    shippingCost: num(o.shippingCost),
    freeShippingCondition: num(o.freeShippingCondition),
    returnShippingCost: num(o.returnShippingCost),
    jejuAdditionalCost: o.isJejuShipping === false ? null : num(o.jejuAdditionalCost),
    remoteAreaAdditionalCost: o.isRemoteAreaShipping === false ? null : num(o.remoteAreaAdditionalCost),
    commissionRate: o.totalMarginRate == null ? null : round1(Number(o.totalMarginRate) - 5),
  }));
}

// 업체별 회사 몫(기본 5%) 적용: 기본 수수료는 '총 마진율 - 5'로 계산돼 있으므로 차이만큼 보정
export const DEFAULT_COMPANY_MARGIN = 5;
export function withCompanyMargin(opts, margin) {
  const m = Number(margin);
  if (margin == null || isNaN(m) || m === DEFAULT_COMPANY_MARGIN) return opts;
  return opts.map((o) =>
    o.commissionRate == null || o.commissionRate === '' ? o : { ...o, commissionRate: round1(Number(o.commissionRate) + DEFAULT_COMPANY_MARGIN - m) }
  );
}

export function effectiveOptions(product, edit) {
  if (Array.isArray(edit?.options) && edit.options.length) return edit.options;
  return baseOptions(selectedPolicy(product, edit));
}

const won = (n) => `${Math.round(Number(n)).toLocaleString('ko-KR')}원`;

// 업체 화면용 문자열
export function presentOption(o) {
  const gp = Number(o.groupPurchasePrice) || 0;
  const rate = o.commissionRate == null || o.commissionRate === '' ? null : Number(o.commissionRate);
  return {
    name: o.name || '-',
    configuration: o.configuration || '-',
    consumerPrice: o.consumerPrice ? won(o.consumerPrice) : '-',
    groupPurchasePrice: gp ? won(gp) : '-',
    shipping: !Number(o.shippingCost) ? '무료배송' : won(o.shippingCost),
    // 배송비 자체가 0이면 '무료배송', 배송비가 있는데 조건이 0이면 조건 없음
    freeShippingCondition: !Number(o.shippingCost) ? '무료배송' : !Number(o.freeShippingCondition) ? '조건 없음' : `${won(o.freeShippingCondition)} 이상 무료`,
    returnCost: o.returnShippingCost == null || o.returnShippingCost === '' ? '-' : /^9{4,}$/.test(String(o.returnShippingCost)) ? '반품 불가' : won(o.returnShippingCost),
    jeju: o.jejuAdditionalCost == null || o.jejuAdditionalCost === '' ? '배송 불가' : Number(o.jejuAdditionalCost) ? `+${won(o.jejuAdditionalCost)}` : '추가비용 없음',
    remote: o.remoteAreaAdditionalCost == null || o.remoteAreaAdditionalCost === '' ? '배송 불가' : Number(o.remoteAreaAdditionalCost) ? `+${won(o.remoteAreaAdditionalCost)}` : '추가비용 없음',
    commission: rate == null || isNaN(rate) ? '-' : `${round1(rate)}%${gp ? ` (${won((gp * rate) / 100)})` : ''}`,
    commissionPct: rate == null || isNaN(rate) ? '-' : `${round1(rate)}%`,
    commissionWon: rate == null || isNaN(rate) || !gp ? '' : won((gp * rate) / 100),
  };
}

function num(v) {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}
function round1(n) {
  return Math.round(n * 10) / 10;
}

export function plainText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
