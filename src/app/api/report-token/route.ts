import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getOrCreateReportToken } from '@/lib/reports/createReportToken'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: NextRequest) {
  // 인증 체크 — 로그인된 admin만 토큰 발급 가능
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const visitRecordId = body?.visitRecordId

  if (!visitRecordId || typeof visitRecordId !== 'string') {
    return NextResponse.json({ error: 'visitRecordId가 필요합니다.' }, { status: 400 })
  }

  try {
    const tokenRow = await getOrCreateReportToken(visitRecordId)

    if (!tokenRow) {
      return NextResponse.json({ error: '토큰을 생성하지 못했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ token: tokenRow.token })
  } catch (error) {
    console.error('report token creation failed', error)
    return NextResponse.json({ error: '공유 링크 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
