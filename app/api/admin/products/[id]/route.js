import { NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { autoPolicy, baseOptions, effectiveOptions, OPTION_FIELDS } from '@/lib/display';
import { refreshPriceFrom } from '@/lib/products';
import { reelsKeyword } from '@/lib/reels';

export const dynamic = 'force-dynamic';

async function load(id) {
  const [r] = await sql`
    select p.*, e.hurdle, coalesce(e.hidden, false) as hidden, e.policy_id, e.options,
      e.display_name, e.reels_keyword as reels_kw_override, e.hidden_reels, coalesce(e.popular_pin, false) as popular_pin
    from products p left join product_edits e on e.product_id = p.id where p.id = ${id}`;
  return r;
}

export async function GET(_req, { params }) {
  await ensureSchema();
  const r = await load(parseInt(params.id, 10));
  if (!r) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const auto = autoPolicy(r.policies);
  return NextResponse.json({
    id: r.id, name: r.name, brand: r.brand, vendor: r.vendor, image: r.image_url, salesUrl: r.sales_url,
    wiredHurdle: r.wired_hurdle, manager: r.manager,
    hurdle: r.hurdle || '', hidden: r.hidden, policyId: r.policy_id, customOptions: r.options,
    autoPolicyId: auto?.id || null,
    policies: (r.policies || []).map((p) => ({ id: p.id, name: p.name, createdAt: p.createdAt, reviewStatus: p.reviewStatus, base: baseOptions(p) })),
    effective: effectiveOptions(r, r),
    popularPin: r.popular_pin,
    displayName: r.display_name || '',
    reelsKeyword: r.reels_kw_override || '',
    reelsKeywordAuto: reelsKeyword(r, null),
    reelsFetchedKeyword: r.reels_keyword || '',
    reels: (r.reels || []).map((x) => ({ code: x.code, thumb: x.thumb, views: x.views, account: x.account })),
    hiddenReels: Array.isArray(r.hidden_reels) ? r.hidden_reels : [],
  });
}

const NUMERIC = new Set(OPTION_FIELDS.filter((f) => f[2] !== 'text').map((f) => f[0]));
function cleanOptions(opts) {
  if (!Array.isArray(opts)) return null;
  return opts.slice(0, 50).map((o) => {
    const out = {};
    for (const [k] of OPTION_FIELDS) {
      const v = o?.[k];
      if (NUMERIC.has(k)) out[k] = v === '' || v == null ? null : Number(String(v).replace(/[^0-9.\-]/g, '')) || 0;
      else out[k] = v == null ? '' : String(v).slice(0, 200);
    }
    return out;
  });
}

export async function PUT(req, { params }) {
  await ensureSchema();
  const id = parseInt(params.id, 10);
  const r = await load(id);
  if (!r) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const b = await req.json();
  const hurdle = b.hurdle == null ? null : String(b.hurdle).slice(0, 2000);
  const hidden = !!b.hidden;
  const policyId = Number.isInteger(b.policyId) ? b.policyId : null;
  const options = b.options ? cleanOptions(b.options) : null;
  const popularPin = !!b.popularPin;
  const displayName = b.displayName ? String(b.displayName).trim().slice(0, 300) || null : null;
  const reelsKw = b.reelsKeyword ? String(b.reelsKeyword).trim().slice(0, 100) || null : null;
  const hiddenReels = Array.isArray(b.hiddenReels) ? b.hiddenReels.map(String).slice(0, 50) : [];
  await sql`
    insert into product_edits (product_id, hurdle, hidden, policy_id, options, popular_pin, reels_keyword, hidden_reels, display_name, updated_at)
    values (${id}, ${hurdle}, ${hidden}, ${policyId}, ${options ? sql.json(options) : null}, ${popularPin}, ${reelsKw}, ${sql.json(hiddenReels)}, ${displayName}, now())
    on conflict (product_id) do update set hurdle = excluded.hurdle, hidden = excluded.hidden,
      policy_id = excluded.policy_id, options = excluded.options, popular_pin = excluded.popular_pin,
      reels_keyword = excluded.reels_keyword, hidden_reels = excluded.hidden_reels, display_name = excluded.display_name, updated_at = now()`;
  await refreshPriceFrom([id]);
  return NextResponse.json({ ok: true });
}
