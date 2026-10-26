# 와이어드 상품 카탈로그 (업체별 링크 + 통계)

- `/p/[slug]` 업체 전용 상품 페이지 (로그인 없음)
- `/admin` 업체 링크 발급 · 관심도 통계 (비밀번호)
- `/admin/products` 진행 허들 작성, 숨김, 가격구조 선택/수정
- `/admin/sync` 와이어드민 동기화 북마크

## 환경변수 (Vercel)
- `DATABASE_URL` (또는 Neon 연동 시 자동 생성되는 `POSTGRES_URL`/`DATABASE_URL`)
- `ADMIN_PASSWORD` 관리자 비밀번호
- `SYNC_KEY` 동기화용 임의 문자열
- (선택) `MIN_UPDATED_AT` 이 날짜 이전 수정 상품 제외, 기본 2026-01-01

테이블은 첫 요청 때 자동 생성됩니다.
