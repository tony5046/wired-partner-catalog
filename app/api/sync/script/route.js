import { NextResponse } from 'next/server';
import { syncKeyOk } from '@/lib/auth';

export const dynamic = 'force-dynamic';
// 이 날짜 이전에 마지막으로 수정된 상품(2024·2025년)은 카탈로그에서 제외
const MIN_UPDATED = process.env.MIN_UPDATED_AT || '2026-01-01T00:00:00+09:00';

// 와이어드민(admin.wiredm.in) 화면에서 북마크로 실행되는 동기화 스크립트
export async function GET(req) {
  const k = req.nextUrl.searchParams.get('k');
  if (!(await syncKeyOk(k))) {
    return new NextResponse(`alert('동기화 키가 올바르지 않아요. 관리자 > 동기화 메뉴에서 북마크를 다시 만들어 주세요.')`, {
      headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
    });
  }
  const origin = `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('x-forwarded-host') || req.headers.get('host')}`;
  const force = req.nextUrl.searchParams.get('force') === '1';
  const js = SCRIPT.replace('__ORIGIN__', JSON.stringify(origin))
    .replace('__KEY__', JSON.stringify(k))
    .replace('__FORCE__', force ? 'true' : 'false')
    .replace('__MIN_UPDATED__', JSON.stringify(MIN_UPDATED));
  return new NextResponse(js, {
    headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

const SCRIPT = `(async function(){
  var ORIGIN = __ORIGIN__, KEY = __KEY__, FORCE = __FORCE__, MIN_UPDATED = new Date(__MIN_UPDATED__).getTime();
  if (window.__wcSyncRunning) return;
  if (location.host !== 'admin.wiredm.in') { alert('와이어드민(admin.wiredm.in) 화면에서 실행해 주세요.'); return; }
  window.__wcSyncRunning = true;

  var box = document.createElement('div');
  box.id = 'wc-sync-box';
  box.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;width:340px;background:#fff;border:1px solid #dfe3ea;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.18);padding:16px 18px;font:14px/1.5 -apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#16181d';
  box.innerHTML = '<div style="font-weight:700;margin-bottom:6px">상품 카탈로그 동기화' + (FORCE ? ' (전체)' : '') + '</div><div id="wc-sync-msg">준비 중…</div><div style="height:6px;background:#eef0f3;border-radius:3px;margin-top:10px;overflow:hidden"><div id="wc-sync-bar" style="height:100%;width:0;background:#2f5bff;transition:width .2s"></div></div><div id="wc-sync-done" style="margin-top:10px;display:none"><button id="wc-sync-close" style="height:32px;padding:0 14px;border-radius:8px;border:1px solid #dfe3ea;background:#fff;cursor:pointer">닫기</button></div>';
  document.body.appendChild(box);
  var msg = function(t){ document.getElementById('wc-sync-msg').textContent = t; };
  var bar = function(p){ document.getElementById('wc-sync-bar').style.width = Math.round(p*100) + '%'; };
  var finish = function(t, ok){
    msg(t); if (ok) bar(1);
    document.getElementById('wc-sync-msg').style.color = ok ? '#11a36a' : '#d64545';
    document.getElementById('wc-sync-done').style.display = 'block';
    document.getElementById('wc-sync-close').onclick = function(){ box.remove(); };
    window.__wcSyncRunning = false;
    window.__wcSyncResult = { ok: ok, message: t };
  };

  try {
    var tok = localStorage.getItem('wired_administration_token');
    try { var parsed = JSON.parse(tok); if (typeof parsed === 'string') tok = parsed; } catch (e) {}
    if (!tok) throw new Error('와이어드민 로그인이 필요해요.');
    var api = async function(path){
      for (var attempt = 0; attempt < 3; attempt++) {
        var r = await fetch('https://api.wiredm.in/admin/product' + path, { headers: { Authorization: 'Bearer ' + tok } });
        if (r.status === 401 || r.status === 403) throw new Error('와이어드민 로그인이 만료됐어요. 새로고침 후 다시 실행해 주세요.');
        if (r.ok) return (await r.json()).data;
        await new Promise(function(res){ setTimeout(res, 800 * (attempt + 1)); });
      }
      throw new Error('와이어드민 API 응답 오류 (' + path + ')');
    };
    var post = async function(body){
      var r = await fetch(ORIGIN + '/api/sync/batch?k=' + encodeURIComponent(KEY), { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error('카탈로그 서버 저장 실패 (' + r.status + ')');
      return r.json();
    };

    // 1) 거래중 상품 전체 목록
    msg('와이어드민 상품 목록 불러오는 중…');
    var all = [], offset = 0;
    while (true) {
      var rows = await api('/products?statuses=SELL&sortBy=updatedAt-DESC&size=200&offset=' + offset);
      all = all.concat(rows || []);
      msg('상품 목록 ' + all.length.toLocaleString() + '개 확인');
      if (!rows || rows.length < 200) break;
      offset += 200;
      if (offset > 20000) break;
    }
    var listed = all.length;
    all = all.filter(function(p){ return !p.isTemporarySave && !p.deletedAt && new Date(p.updatedAt).getTime() >= MIN_UPDATED; });
    msg('거래중 ' + listed.toLocaleString() + '개 중 2026년 이후 업데이트 ' + all.length.toLocaleString() + '개');
    if (all.length < 50) throw new Error('상품 목록이 비정상적으로 적어요 (' + all.length + '개). 중단합니다.');

    // 2) 변경된 상품만 골라내기
    var st = await (await fetch(ORIGIN + '/api/sync/state?k=' + encodeURIComponent(KEY))).json();
    if (st.error) throw new Error('동기화 키 오류');
    var known = st.items || {};
    var todo = all.filter(function(p){ return FORCE || known[p.id] !== new Date(p.updatedAt).toISOString(); });
    msg('전체 ' + all.length.toLocaleString() + '개 중 ' + todo.length.toLocaleString() + '개 업데이트 필요');

    // 3) 가격구조 가져와서 검토 목록에 올리기 (아직 사이트에는 반영 안 됨)
    var batchId = (await post({ action: 'start' })).batchId;
    var pick = function(d){ return {
      name: d.name, configuration: d.configuration, consumerPrice: d.consumerPrice, groupPurchasePrice: d.groupPurchasePrice,
      shippingCost: d.shippingCost, customerShippingCost: d.customerShippingCost, isFreeShipping: d.isFreeShipping,
      freeShippingCondition: d.freeShippingCondition, returnShippingCost: d.returnShippingCost, exchangeShippingCost: d.exchangeShippingCost,
      isJejuShipping: d.isJejuShipping, jejuAdditionalCost: d.jejuAdditionalCost, isRemoteAreaShipping: d.isRemoteAreaShipping,
      remoteAreaAdditionalCost: d.remoteAreaAdditionalCost, totalMarginRate: d.totalMarginRate,
      deliveryCompany: d.deliveryCompany, sameDayShippingCutoffTime: d.sameDayShippingCutoffTime, combinedShippingType: d.combinedShippingType, combinedShippingCondition: d.combinedShippingCondition }; };
    var build = async function(p){
      var pols = [];
      try { pols = await api('/products/product-id/' + p.id + '/price-policies') || []; } catch (e) { if (/로그인/.test(e.message)) throw e; }
      return {
        id: p.id, name: p.name, brand: p.brand && p.brand.name, vendor: p.brand && p.brand.vendor && p.brand.vendor.name,
        category: p.firstCategoryName, image: p.primaryProductMultimediaUrl || p.primaryImageUrl, salesUrl: p.salesChannelUrl,
        usp: p.usp, hurdle: p.progressHurdle, manager: p.manager && p.manager.name, updatedAt: p.updatedAt, searchKeyword: p.searchKeyword,
        policies: pols.filter(function(x){ return !x.deletedAt; }).map(function(x){ return {
          id: x.id, name: x.name, createdAt: x.createdAt, reviewStatus: x.reviewStatus,
          options: (x.productPricePolicyDetails || []).filter(function(d){ return !d.deletedAt; }).map(pick) }; })
      };
    };
    var done = 0, buf = [], idx = 0;
    var worker = async function(){
      while (idx < todo.length) {
        var p = todo[idx++];
        buf.push(await build(p));
        done++;
        if (done % 10 === 0 || done === todo.length) { msg('가격구조 가져오는 중 ' + done.toLocaleString() + ' / ' + todo.length.toLocaleString()); bar(done / Math.max(todo.length, 1) * 0.97); }
        if (buf.length >= 80) { var chunk = buf.splice(0, buf.length); await post({ action: 'add', batchId: batchId, products: chunk }); }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
    if (buf.length) await post({ action: 'add', batchId: batchId, products: buf.splice(0, buf.length) });

    // 4) 관련 릴스 (조회수 높은 순): 기존 상품 중 갱신 필요분 + 신규 상품
    var rt = await (await fetch(ORIGIN + '/api/sync/reels-todo?k=' + encodeURIComponent(KEY) + (FORCE ? '&force=1' : ''))).json();
    var cleanName = function(n){ return String(n || '').replace(/\\[[^\\]]*\\]|\\([^)]*\\)/g, ' ').replace(/전제품|전 제품|모음전?|기획전|신제품 추가|상시판매/g, ' ').replace(/\\s+/g, ' ').trim(); };
    var seen = {}, reelTodo = [];
    (rt.todo || []).forEach(function(t){ seen[t.id] = 1; reelTodo.push(t); });
    todo.forEach(function(p){ if (!(p.id in known) && !seen[p.id]) { var kw = (p.searchKeyword || cleanName(p.name)).trim(); if (kw) reelTodo.push({ id: p.id, keyword: kw }); } });
    var rdone = 0, rbuf = [], ridx = 0;
    var ireq = async function(path){
      var r = await fetch('https://api.wiredm.in/admin/influencer' + path, { headers: { Authorization: 'Bearer ' + tok } });
      if (!r.ok) return [];
      return (await r.json()).data || [];
    };
    var rworker = async function(){
      while (ridx < reelTodo.length) {
        var t = reelTodo[ridx++];
        var list = [];
        try { list = await ireq('/influencer-reels?includeKeywords%5B0%5D=' + encodeURIComponent(t.keyword) + '&sortBy=viewCount-DESC&offset=0&size=8'); } catch (e) {}
        rbuf.push({ id: t.id, keyword: t.keyword, items: list.map(function(x){
          var m = /-reel-([A-Za-z0-9_-]+)\\.[a-z]+$/.exec(x.contentThumbnailUrl || '');
          return { rid: x.id, code: m ? m[1] : '', thumb: x.contentThumbnailUrl, views: x.viewCount, likes: x.likeCount,
            account: x.influencer && x.influencer.accountId, name: x.influencer && x.influencer.name, postedAt: x.originCreatedAt };
        }).filter(function(x){ return x.code; }) });
        rdone++;
        if (rdone % 10 === 0 || rdone === reelTodo.length) { msg('관련 릴스 가져오는 중 ' + rdone.toLocaleString() + ' / ' + reelTodo.length.toLocaleString()); bar(0.97 + rdone / Math.max(reelTodo.length, 1) * 0.03); }
        if (rbuf.length >= 40) await post({ action: 'add', batchId: batchId, reels: rbuf.splice(0, rbuf.length) });
      }
    };
    await Promise.all([rworker(), rworker(), rworker(), rworker()]);
    if (rbuf.length) await post({ action: 'add', batchId: batchId, reels: rbuf.splice(0, rbuf.length) });

    // 5) 마무리 → 검토 페이지로
    var res = await post({ action: 'finish', batchId: batchId, activeIds: all.map(function(p){ return p.id; }) });
    var c = res.counts || {};
    var n = (c['new'] || 0) + (c.changed || 0) + (c.removed || 0);
    finish(n ? '검토 준비 완료! 신규 ' + (c['new'] || 0) + ' · 변경 ' + (c.changed || 0) + ' · 판매중단 ' + (c.removed || 0) + '개' : '변경된 상품이 없어요.' + (c.reels ? ' (릴스 갱신 ' + c.reels + '개)' : ''), true);
    var link = document.createElement('a');
    link.href = ORIGIN + res.reviewPath;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = n || c.reels ? '검토하고 업로드하기 →' : '열기';
    link.style.cssText = 'display:inline-flex;align-items:center;height:32px;padding:0 14px;border-radius:8px;background:#2f5bff;color:#fff;font-weight:700;text-decoration:none;margin-right:6px';
    var done2 = document.getElementById('wc-sync-done');
    done2.insertBefore(link, done2.firstChild);
  } catch (e) {
    finish('실패: ' + (e && e.message || e), false);
  }
})();`;
