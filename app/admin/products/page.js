import AdminNav from '@/components/AdminNav';
import ProductAdmin from './ProductAdmin';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <>
      <AdminNav on="products" />
      <div className="adm">
        <h1>상품 관리</h1>
        <p className="desc">와이어드민에서 동기화한 거래중 상품이에요. 진행 허들 작성, 상품 제외(여러 개 한 번에), 가격 구조 선택·수정을 할 수 있고 여기서 고친 값은 동기화해도 유지돼요.</p>
        <ProductAdmin />
      </div>
    </>
  );
}
