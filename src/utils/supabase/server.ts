import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'

// React.cache로 "같은 요청" 안에서 createClient 결과를 메모이즈한다.
// - 같은 render/server-action 안에서 여러 번 호출돼도 동일 인스턴스 재사용
// - 요청이 끝나면 자동 폐기 → 쿠키/세션 누출 위험 없음
// 요청 간 모듈 레벨 전역 캐싱은 절대 금지 (사용자별 쿠키가 섞임).
export const createClient = cache(async () => {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component에서 set 불가 — 무시
          }
        },
      },
    }
  )
})
