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
        {/* Kakao SDK — NEXT_PUBLIC_KAKAO_APP_KEY 설정 시 활성화 */}
        <script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js" async />
      </body>
    </html>
  );
}
