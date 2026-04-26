import type { Metadata } from "next";
import { Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "DAZUL · Holistic Wellness Care",
  description: "Premium holistic wellness care for your beloved pets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${cormorant.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        {/* Kakao SDK — NEXT_PUBLIC_KAKAO_APP_KEY 설정 시 활성화
            SRI: kakao.min.js 2.7.4 sha384 — 버전 변경 시 해시 재계산 필요
            curl -s URL | openssl dgst -sha384 -binary | openssl base64 -A */}
        <script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
          integrity="sha384-DKYJZ8NLiK8MN4/C5P2dtSmLQ4KwPaoqAfyA/DfmEc1VDxu4yyC7wy6K1Hs90nka"
          crossOrigin="anonymous"
          async
        />
      </body>
    </html>
  );
}
