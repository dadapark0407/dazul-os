import type { NextConfig } from 'next'

// 보안 헤더 정의
// CSP 화이트리스트:
// - script-src: 자체 + Kakao SDK CDN (인증/공유 SDK)
// - img-src: Supabase Storage(*.supabase.co) + data/blob (첨부 미리보기)
// - connect-src: Supabase API + Anthropic API (서버 라우트 fetch)
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' t1.kakaocdn.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: *.supabase.co",
      "connect-src 'self' *.supabase.co api.anthropic.com",
      "font-src 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
