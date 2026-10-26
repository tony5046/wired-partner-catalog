import Link from 'next/link';
import { ensureSchema, sql } from '@/lib/db';

export default async function AdminNav({ on }) {
  let pending = 0;
  try {
    await ensureSchema();
    const [r] = await sql`select count(*)::int as n from proposal_requests where status = 'requested'`;
    pending = r.n;
  } catch {}
  const items = [
    ['/admin', '업체 · 통계', 'stats'],
    ['/admin/requests', '제안서 요청', 'requests', pending],
    ['/admin/products', '상품 관리', 'products'],
    ['/admin/sync', '와이어드민 동기화', 'sync'],
  ];
  return (
    <nav className="adm-nav">
      <div className="inner">
        <span className="logo">WIRED 상품 카탈로그</span>
        {items.map(([href, label, key, count]) => (
          <Link key={key} href={href} className={on === key ? 'on' : ''}>
            {label}
            {count ? <span className="nav-count">{count}</span> : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}
