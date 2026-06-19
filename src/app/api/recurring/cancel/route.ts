import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * DELETE /api/recurring/cancel
 * body: { year: number, month: number }  (month: 1~12)
 *
 * 해당 월 범위 내 raw_input = '루틴 예약 자동 생성' 마커가 있는 appointments 를
 * 일괄 삭제(soft delete)한다. 수동 수정분도 마커가 남아 있으면 함께 삭제된다.
 * 응답: { deleted: number } | { error: string }
 */

const BRANCH_ID = '00000000-0000-0000-0000-000000000001'
const RECURRING_MARKER = '루틴 예약 자동 생성'

/** KST 기준 그 달의 1일 / 다음 달 1일 (start_at 범위 조회용) */
function monthRangeKst(year: number, month: number): { start: string; end: string } {
  const ny = month === 12 ? year + 1 : year
  const nm = month === 12 ? 1 : month + 1
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    start: `${year}-${pad(month)}-01T00:00:00+09:00`,
    end: `${ny}-${pad(nm)}-01T00:00:00+09:00`,
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()

    // 인증 체크
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const year = Number(body.year)
    const month = Number(body.month)
    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      return NextResponse.json(
        { error: 'year, month가 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    const { start, end } = monthRangeKst(year, month)

    const { data, error } = await supabase
      .from('appointments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('branch_id', BRANCH_ID)
      .eq('raw_input', RECURRING_MARKER)
      .is('deleted_at', null)
      .gte('start_at', start)
      .lt('start_at', end)
      .select('id')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ deleted: data?.length ?? 0 })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
