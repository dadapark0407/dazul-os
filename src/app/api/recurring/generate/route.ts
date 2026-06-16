import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isClosedDow } from '@/lib/booking/constants'
import type { RecurringSchedule } from '@/types/recurring'

/**
 * POST /api/recurring/generate
 * body: { year: number, month: number }  (month: 1~12)
 *
 * is_active = true 인 recurring_schedules 를 기준으로 해당 월의 예약을
 * appointments 테이블에 일괄 생성한다.
 * 응답: { created: number } | { alreadyGenerated: true } | { error: string }
 */

const BRANCH_ID = '00000000-0000-0000-0000-000000000001'

// 자동 생성된 루틴 예약 식별용 마커 (raw_input). 중복 생성 감지에 사용.
const RECURRING_MARKER = '루틴 예약 자동 생성'

/**
 * 서비스 기준 기본 소요시간(분) — visit_records에 실측값이 없을 때만 사용하는 폴백.
 * - 목욕 / 목욕(부분): 90
 * - 미용 / 가위컷 / 스포팅: 180
 * - 기계컷: 120
 * - 그외: 120
 */
function fallbackDuration(service: string | null): number {
  if (!service) return 120
  if (service.includes('목욕')) return 90
  if (service.includes('기계컷')) return 120
  if (service.includes('미용') || service.includes('가위컷') || service.includes('스포팅')) return 180
  return 120
}

/** 미용 담당 선생님 배정 대상 서비스(미용·가위컷·스포팅) 여부 */
function isGroomingService(service: string | null): boolean {
  if (!service) return false
  return service.includes('미용') || service.includes('가위컷') || service.includes('스포팅')
}

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

export async function POST(req: NextRequest) {
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

    // 활성 루틴 스케줄 조회
    const { data: schedules, error: schedErr } = await supabase
      .from('recurring_schedules')
      .select('*')
      .eq('branch_id', BRANCH_ID)
      .eq('is_active', true)

    if (schedErr) {
      return NextResponse.json({ error: schedErr.message }, { status: 500 })
    }
    const list = (schedules ?? []) as RecurringSchedule[]
    if (list.length === 0) {
      return NextResponse.json({ created: 0, skipped: 0 })
    }

    // 반려견 스냅샷(이름/품종) — 표시용 컬럼 채우기
    const petIds = Array.from(new Set(list.map((s) => s.pet_id)))
    const { data: petRows } = await supabase
      .from('pets')
      .select('id, name, breed')
      .in('id', petIds)
    const petMap = new Map<string, { name: string | null; breed: string | null }>()
    for (const p of petRows ?? []) {
      petMap.set(String(p.id), {
        name: typeof p.name === 'string' ? p.name : null,
        breed: typeof p.breed === 'string' ? p.breed : null,
      })
    }

    // pet_id별 가장 최근 grooming_duration_minutes — 한 번의 쿼리로 일괄 조회.
    // visit_date 내림차순으로 가져와 pet당 첫 값(최근)만 채택.
    const durationMap = new Map<string, number>()
    const { data: durationRows } = await supabase
      .from('visit_records')
      .select('pet_id, grooming_duration_minutes, visit_date')
      .in('pet_id', petIds)
      .not('grooming_duration_minutes', 'is', null)
      .is('deleted_at', null)
      .order('visit_date', { ascending: false })
    for (const r of durationRows ?? []) {
      const pid = String(r.pet_id)
      if (durationMap.has(pid)) continue
      const v = r.grooming_duration_minutes
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        durationMap.set(pid, v)
      }
    }

    // 중복 감지용 — 이번 달 기존 예약의 (pet_id + 시작시각) 키 집합.
    // start_at 은 timestamptz 라 표현이 달라질 수 있어 epoch(ms)로 정규화해 비교.
    const dedupKeys = new Set<string>()
    const { data: monthAppts } = await supabase
      .from('appointments')
      .select('pet_id, start_at')
      .eq('branch_id', BRANCH_ID)
      .in('pet_id', petIds)
      .is('deleted_at', null)
      .gte('start_at', start)
      .lt('start_at', end)
    for (const a of monthAppts ?? []) {
      if (!a.pet_id || !a.start_at) continue
      dedupKeys.add(`${a.pet_id}|${new Date(a.start_at as string).getTime()}`)
    }

    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const pad = (n: number) => String(n).padStart(2, '0')

    type ApptInsert = Record<string, unknown>
    const inserts: ApptInsert[] = []
    const indexUpdates: { id: string; index: number }[] = []
    let skipped = 0

    for (const s of list) {
      const patternLen = s.service_pattern.length
      if (patternLen === 0) continue

      // 이번 달 preferred_day_of_week 에 해당하는 날짜 (휴무일 제외)
      const candidateDates: string[] = []
      for (let d = 1; d <= lastDay; d++) {
        const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay()
        if (dow !== s.preferred_day_of_week) continue
        if (isClosedDow(dow)) continue // 수(3)·일(0) 자동 제외
        candidateDates.push(`${year}-${pad(month)}-${pad(d)}`)
      }

      // frequency_weeks 간격 적용 — 첫 주 오프셋은 current_pattern_index 기준
      const startOffset = s.current_pattern_index % s.frequency_weeks
      const selected = candidateDates.filter(
        (_, i) => i >= startOffset && (i - startOffset) % s.frequency_weeks === 0
      )

      const pet = petMap.get(s.pet_id)
      const recentDuration = durationMap.get(s.pet_id)
      let idx = s.current_pattern_index
      for (const date of selected) {
        const startAt = `${date}T${s.preferred_time}+09:00`
        // 같은 pet + 같은 시작시각이 이미 있으면 건너뜀 (회차 인덱스도 advance하지 않음)
        const key = `${s.pet_id}|${new Date(startAt).getTime()}`
        if (dedupKeys.has(key)) {
          skipped++
          continue
        }
        const service = s.service_pattern[idx % patternLen]
        // 미용·가위컷·스포팅 회차에만 담당 미용사 배정, 그 외(목욕/목욕(부분)/기계컷)는 미배정
        const staffId = isGroomingService(service) ? s.grooming_stylist_id ?? null : null
        inserts.push({
          start_at: startAt,
          duration_min: recentDuration ?? fallbackDuration(service),
          pet_id: s.pet_id,
          guardian_id: s.guardian_id,
          staff_id: staffId,
          branch_id: BRANCH_ID,
          status: 'confirmed',
          service,
          note: s.notes ?? null,
          raw_input: RECURRING_MARKER,
          pet_name: pet?.name ?? null,
          pet_breed: pet?.breed ?? null,
          assign_type: 'fixed',
        })
        dedupKeys.add(key)
        idx++
      }
      indexUpdates.push({ id: s.id, index: idx % patternLen })
    }

    if (inserts.length === 0) {
      return NextResponse.json({ created: 0, skipped })
    }

    const { error: insertErr } = await supabase
      .from('appointments')
      .insert(inserts)

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    // 각 스케줄의 current_pattern_index 순환 업데이트
    await Promise.all(
      indexUpdates.map((u) =>
        supabase
          .from('recurring_schedules')
          .update({ current_pattern_index: u.index, updated_at: new Date().toISOString() })
          .eq('id', u.id)
      )
    )

    return NextResponse.json({ created: inserts.length, skipped })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
