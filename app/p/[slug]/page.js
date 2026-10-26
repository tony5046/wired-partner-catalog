import { notFound } from 'next/navigation';
import { ensureSchema } from '@/lib/db';
import { getPartnerBySlug } from '@/lib/products';
import Catalog from './Catalog';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  await ensureSchema();
  const p = await getPartnerBySlug(params.slug);
  return { title: p ? `${p.name} 전용 상품 제안 | 와이어드컴퍼니` : '와이어드컴퍼니' };
}

export default async function PartnerPage({ params }) {
  await ensureSchema();
  const partner = await getPartnerBySlug(params.slug);
  if (!partner) notFound();
  return <Catalog partner={{ slug: partner.slug, name: partner.name, manager: partner.our_manager, contact: partner.manager_contact }} />;
}
