import JSZip from 'jszip';
import { TEMPLATE_B64 } from './proposalTemplate';

// 제안서 양식(xlsx)의 Sheet1 셀에 값만 채워 넣음 — 서식·병합·두 번째 시트 이미지는 원본 그대로 유지
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

function setCell(xml, ref, value) {
  const re = new RegExp(`<c r="${ref}"([^>]*?)(/>|>[\\s\\S]*?</c>)`);
  const m = xml.match(re);
  if (!m) return xml;
  const style = (m[1].match(/\ss="(\d+)"/) || [])[1];
  const s = style ? ` s="${style}"` : '';
  let cell;
  if (value == null || value === '') cell = `<c r="${ref}"${s}/>`;
  else if (typeof value === 'number' && isFinite(value)) cell = `<c r="${ref}"${s}><v>${value}</v></c>`;
  else cell = `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
  return xml.replace(m[0], cell);
}

// 옵션이 9개를 넘으면 옵션9 줄(24행)을 복제해 행을 추가하고, 아래 행들은 그만큼 밀어냄
function insertOptionRows(x, extra) {
  if (extra <= 0) return x;
  const shift = (n) => (n >= 25 ? n + extra : n);
  x = x.replace(/<row r="(\d+)"/g, (m, n) => `<row r="${shift(+n)}"`);
  x = x.replace(/<c r="([A-Z]+)(\d+)"/g, (m, c, n) => `<c r="${c}${shift(+n)}"`);
  x = x.replace(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g, (m, c1, n1, c2, n2) => `<mergeCell ref="${c1}${shift(+n1)}:${c2}${shift(+n2)}"/>`);
  const row24 = x.match(/<row r="24"[\s\S]*?<\/row>/)[0];
  let added = '';
  let merges = '';
  for (let k = 1; k <= extra; k++) {
    const r = 24 + k;
    let row = row24.replace('<row r="24"', `<row r="${r}"`).replace(/<c r="([A-Z]+)24"/g, `<c r="$1${r}"`);
    row = row.replace(new RegExp(`<c r="A${r}"([^>]*?) t="s"><v>\\d+</v></c>`), (m, attrs) => `<c r="A${r}"${attrs} t="inlineStr"><is><t>옵션${9 + k}</t></is></c>`);
    added += row;
    merges += `<mergeCell ref="B${r}:F${r}"/>`;
  }
  x = x.replace(row24, row24 + added);
  x = x.replace(/<mergeCells count="(\d+)">/, (m, n) => `<mergeCells count="${+n + extra}">${merges}`);
  x = x.replace(/<dimension ref="A1:([A-Z]+)(\d+)"\/>/, (m, c, n) => `<dimension ref="A1:${c}${+n + extra}"/>`);
  return x;
}

const won = (n) => `${Math.round(Number(n)).toLocaleString('ko-KR')}원`;

/**
 * @param product { name, brand, salesUrl }
 * @param options 옵션 원시값 [{ name, configuration, consumerPrice, groupPurchasePrice, shippingCost, commissionRate|null }]
 * @param ship    { deliveryCompany, cutoff, shipping, freeCondition, jeju, remote, returnCost, combined }
 * @param manager { name, phone } | null  (영업담당자 덮어쓰기)
 */
export async function buildProposalXlsx({ product, options, ship, manager, showCommission }) {
  const zip = await JSZip.loadAsync(Buffer.from(TEMPLATE_B64, 'base64'));
  const path = 'xl/worksheets/sheet1.xml';
  let x = await zip.file(path).async('string');

  x = setCell(x, 'A12', `제안 상품 : ${product.name}${product.brand ? ` (${product.brand})` : ''}`);
  if (manager?.name) {
    x = setCell(x, 'B8', manager.name);
    x = setCell(x, 'B10', manager.phone || '');
    x = setCell(x, 'B11', manager.email || '');
  }

  const rows = options.slice(0, 60);
  const extra = Math.max(0, rows.length - 9);
  x = insertOptionRows(x, extra);
  rows.forEach((o, i) => {
    const r = 16 + i;
    const conf = String(o.configuration || '').trim();
    const name = [o.name, conf && conf !== '-' && conf !== o.name ? conf : ''].filter(Boolean).join(' / ');
    const gp = Number(o.groupPurchasePrice) || 0;
    const rate = o.commissionRate == null || o.commissionRate === '' ? null : Number(o.commissionRate);
    const visible = showCommission && rate != null && !isNaN(rate);
    x = setCell(x, `B${r}`, name);
    x = setCell(x, `G${r}`, Number(o.consumerPrice) || '');
    x = setCell(x, `H${r}`, gp || '');
    x = setCell(x, `I${r}`, Number(o.shippingCost) ? Number(o.shippingCost) : '무료배송');
    x = setCell(x, `J${r}`, visible && gp ? Math.round(gp * (1 - rate / 100)) : '');
    let note = visible ? `수수료 ${Math.round(rate * 10) / 10}% (${won((gp * rate) / 100)})` : '';
    if (i === rows.length - 1 && options.length > rows.length) note = [note, `외 ${options.length - rows.length}개 옵션은 카탈로그 참고`].filter(Boolean).join(' · ');
    x = setCell(x, `K${r}`, note);
  });
  if (product.salesUrl) x = setCell(x, `B${25 + extra}`, product.salesUrl);

  const sr = 29 + extra;
  x = setCell(x, `A${sr}`, ship.deliveryCompany || '');
  x = setCell(x, `C${sr}`, ship.cutoff || '');
  x = setCell(x, `E${sr}`, ship.shipping || '');
  x = setCell(x, `F${sr}`, ship.freeCondition || '');
  x = setCell(x, `G${sr}`, [ship.jeju, ship.remote].filter(Boolean).join(' / '));
  x = setCell(x, `I${sr}`, ship.returnCost || '');
  x = setCell(x, `K${sr}`, ship.combined || '');

  zip.file(path, x);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
