// 관련 릴스 검색 키워드: 관리자 지정 > 와이어드민 검색 키워드 > 상품명(괄호 내용 제거)
export function cleanName(name = '') {
  return String(name)
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(/전제품|전 제품|모음전?|기획전|신제품 추가|상시판매/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function reelsKeyword(p, e) {
  return String(e?.reels_keyword || p.search_keyword || cleanName(p.name) || '').trim();
}

export function visibleReels(p, e, n = 3) {
  const hidden = new Set(Array.isArray(e?.hidden_reels) ? e.hidden_reels : []);
  return (p.reels || []).filter((r) => r.code && !hidden.has(r.code)).slice(0, n);
}
