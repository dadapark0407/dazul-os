import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // /admin 하위 전체 + 루트 / (로그인 리디렉트용)
    // _next, api, 정적 파일 제외
    '/((?!_next/static|_next/image|favicon.ico|api|report).*)',
  ],
}
