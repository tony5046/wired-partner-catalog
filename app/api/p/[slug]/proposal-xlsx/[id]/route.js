import { NextResponse } from 'next/server';

// 업체 직접 다운로드는 막음 — 제안서 엑셀은 총괄 페이지(/api/admin/proposal-xlsx)에서만 받을 수 있어요
export async function GET() {
  return NextResponse.json({ error: 'not found' }, { status: 404 });
}
