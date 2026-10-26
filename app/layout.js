import './globals.css';

export const metadata = {
  title: '와이어드컴퍼니 상품 제안',
  description: '와이어드컴퍼니 공동구매 상품 카탈로그',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
