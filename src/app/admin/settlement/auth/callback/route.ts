import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * 정산 관리자 비밀번호 재설정 전용 콜백
 *
 * 흐름:
 * 1. 재설정 이메일 링크 클릭 → /admin/settlement/auth/callback?code=XXX
 * 2. code를 세션으로 교환 (type=recovery)
 * 3. /admin/settlement/reset-password 로 리디렉트
 *
 * 일반 로그인은 signInWithPassword — 이 콜백을 거치지 않음
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/admin/settlement/login?error=missing_code`)
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[admin/settlement/auth/callback] exchangeCodeForSession error:', error)
    return NextResponse.redirect(`${origin}/admin/settlement/login?error=reset_failed`)
  }

  return NextResponse.redirect(`${origin}/admin/settlement/reset-password`)
}
