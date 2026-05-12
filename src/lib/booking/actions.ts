'use server'

// =============================================================
// DAZUL OS — 예약 시스템 서버 액션
// =============================================================

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { isClosedDow } from './constants'

// ─── 타입 ───

export type AppointmentInput = {
  start_at: string         // ISO 문자열 (KST 기준 → UTC 변환된 값)
  duration_min: number
  pet_id: string | null
  guardian_id: string | null
  staff_id: string | null
  branch_id?: string | null
  status?: string          // 'confirmed' | 'cancelled' | 'completed'
  note?: string | null
  raw_input?: string | null
  pet_name?: string | null    // 반려견 이름 스냅샷 (신규 고객용·표시용)
  pet_breed?: string | null   // 반려견 품종 스냅샷
  service?: string | null     // 서비스 키워드 (미용/목욕 등)
  assign_type?: 'fixed' | 'random'  // 'random' = autoAssignGroomer로 자동 배정됨
}

export type StaffOffInput = {
  staff_id: string
  off_date: string         // YYYY-MM-DD
  off_type: 'lunch' | 'dayoff' | 'half_off'
  start_time?: string | null  // "HH:MM"
  end_time?: string | null    // "HH:MM"
  branch_id?: string | null
}

export type Staff = {
  id: string
  name: string
  signature_color: string
  display_order: number
  is_active: boolean
  branch_id: string | null
  service_priority?: Record<string, number> | null
}

export type Appointment = {
  id: string
  start_at: string
  duration_min: number
  status: string                  // 'confirmed' | 'cancelled' | 'noshow'
  pet_id: string | null
  guardian_id: string | null
  staff_id: string | null
  note: string | null
  raw_input: string | null
  pet_name?: string | null
  pet_breed?: string | null
  guardian_name?: string | null
  service?: string | null
  assign_type?: 'fixed' | 'random'
  cancel_reason?: string | null    // '보호자 취소' | '노쇼' | '매장 사정'
  cancelled_at?: string | null     // ISO
}

export type CancelReason = '보호자 취소' | '노쇼' | '매장 사정'

export type StaffOff = {
  id: string
  staff_id: string
  off_date: string
  off_type: 'lunch' | 'dayoff' | 'half_off'
  start_time: string | null
  end_time: string | null
}

export type BookingData = {
  staff: Staff[]
  appointments: Appointment[]
  staffOff: StaffOff[]
}

export type MonthlyData = {
  staff: Staff[]
  appointments: Appointment[]
}


// ─── 조회 ───

/**
 * 해당 날짜의 staff / appointments / staff_off 데이터 조회
 * @param date YYYY-MM-DD (KST 기준 날짜)
 */
export async function getBookingData(date: string): Promise<BookingData> {
  const supabase = await createClient()

  // KST 자정 ~ 다음날 자정 (UTC로 변환)
  const dayStartUtc = new Date(`${date}T00:00:00+09:00`).toISOString()
  const dayEndUtc = new Date(`${date}T23:59:59.999+09:00`).toISOString()

  // 3개 쿼리 병렬 실행 — 서로 독립적이라 Promise.all로 동시 발사
  const [staffRes, apptRes, offRes] = await Promise.all([
    supabase
      .from('staff')
      .select('id, name, signature_color, display_order, is_active, branch_id')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabase
      .from('appointments')
      .select(
        `id, start_at, duration_min, status, pet_id, guardian_id, staff_id,
         note, raw_input, pet_name, pet_breed, service, assign_type,
         cancel_reason, cancelled_at,
         pets:pet_id ( name, breed ),
         guardians:guardian_id ( name )`,
      )
      .gte('start_at', dayStartUtc)
      .lte('start_at', dayEndUtc)
      .is('deleted_at', null)
      .order('start_at', { ascending: true }),
    supabase
      .from('staff_off')
      .select('id, staff_id, off_date, off_type, start_time, end_time')
      .eq('off_date', date),
  ])

  const staffRows = staffRes.data
  const apptRows = apptRes.data
  const offRows = offRes.data

  const appointments: Appointment[] = (apptRows ?? []).map((row: any) => ({
    id: row.id,
    start_at: row.start_at,
    duration_min: row.duration_min,
    status: row.status,
    pet_id: row.pet_id,
    guardian_id: row.guardian_id,
    staff_id: row.staff_id,
    note: row.note,
    raw_input: row.raw_input,
    // 관계 데이터 우선, 없으면 컬럼 스냅샷 fallback
    pet_name: row.pets?.name ?? row.pet_name ?? null,
    pet_breed: row.pets?.breed ?? row.pet_breed ?? null,
    guardian_name: row.guardians?.name ?? null,
    service: row.service ?? null,
    assign_type: row.assign_type ?? 'fixed',
    cancel_reason: row.cancel_reason ?? null,
    cancelled_at: row.cancelled_at ?? null,
  }))

  return {
    staff: (staffRows ?? []) as Staff[],
    appointments,
    staffOff: (offRows ?? []) as StaffOff[],
  }
}


/**
 * 해당 월의 모든 appointments + staff 조회
 */
export async function getMonthlyData(year: number, month: number): Promise<MonthlyData> {
  const supabase = await createClient()

  const mo = String(month).padStart(2, '0')

  // ── 달력 그리드 전체 범위 계산 (월~일 기준, KST) ──
  // noon UTC == 해당 날짜 noon KST → 요일 계산에 안전 (UTC 날짜 변동 없음)
  const firstDow = new Date(`${year}-${mo}-01T12:00:00Z`).getUTCDay() // 0=Sun…6=Sat
  const startOffset = (firstDow + 6) % 7 // 월요일 기준: 1일에서 뒤로 밀 일 수

  const lastDayNum = new Date(Date.UTC(year, month, 0)).getUTCDate() // 이달 말일
  const lastDow = new Date(`${year}-${mo}-${String(lastDayNum).padStart(2, '0')}T12:00:00Z`).getUTCDay()
  const endOffset = (7 - lastDow) % 7 // 말일 이후 일요일까지 남은 일 수

  // 달력 시작 = 이달 1일 KST 자정 - startOffset일
  const calStart = new Date(`${year}-${mo}-01T00:00:00+09:00`)
  calStart.setTime(calStart.getTime() - startOffset * 86400000)

  // 달력 끝 (독점) = 다음달 1일 KST 자정 + endOffset일
  const nextYear = month === 12 ? year + 1 : year
  const nextMo = String(month === 12 ? 1 : month + 1).padStart(2, '0')
  const calEnd = new Date(`${nextYear}-${nextMo}-01T00:00:00+09:00`)
  calEnd.setTime(calEnd.getTime() + endOffset * 86400000)

  // 2개 쿼리 병렬 실행
  const [staffRes, apptRes] = await Promise.all([
    supabase
      .from('staff')
      .select('id, name, signature_color, display_order, is_active, branch_id')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabase
      .from('appointments')
      .select(
        `id, start_at, duration_min, status, pet_id, guardian_id, staff_id,
         note, raw_input, pet_name, pet_breed, service, assign_type,
         cancel_reason, cancelled_at,
         pets:pet_id ( name, breed ),
         guardians:guardian_id ( name )`,
      )
      .gte('start_at', calStart.toISOString())
      .lt('start_at', calEnd.toISOString())
      .is('deleted_at', null)
      .order('start_at', { ascending: true }),
  ])

  const staffRows = staffRes.data
  const apptRows = apptRes.data

  const appointments: Appointment[] = (apptRows ?? []).map((row: any) => ({
    id: row.id,
    start_at: row.start_at,
    duration_min: row.duration_min,
    status: row.status,
    pet_id: row.pet_id,
    guardian_id: row.guardian_id,
    staff_id: row.staff_id,
    note: row.note,
    raw_input: row.raw_input,
    pet_name: row.pets?.name ?? row.pet_name ?? null,
    pet_breed: row.pets?.breed ?? row.pet_breed ?? null,
    guardian_name: row.guardians?.name ?? null,
    service: row.service ?? null,
    assign_type: row.assign_type ?? 'fixed',
    cancel_reason: row.cancel_reason ?? null,
    cancelled_at: row.cancelled_at ?? null,
  }))

  return {
    staff: (staffRows ?? []) as Staff[],
    appointments,
  }
}


// ─── 생성 / 수정 / 삭제 ───

export async function createAppointment(data: AppointmentInput) {
  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('appointments')
    .insert({
      start_at: data.start_at,
      duration_min: data.duration_min,
      pet_id: data.pet_id,
      guardian_id: data.guardian_id,
      staff_id: data.staff_id,
      branch_id: data.branch_id ?? null,
      status: data.status ?? 'confirmed',
      note: data.note ?? null,
      raw_input: data.raw_input ?? null,
      pet_name: data.pet_name ?? null,
      pet_breed: data.pet_breed ?? null,
      service: data.service ?? null,
      assign_type: data.assign_type ?? 'fixed',
    })
    .select()
    .single()

  if (error) {
    return { ok: false as const, error: error.message }
  }
  revalidatePath('/admin/booking')
  return { ok: true as const, data: row }
}

export async function updateAppointment(
  id: string,
  data: Partial<AppointmentInput>,
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('appointments')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/admin/booking')
  return { ok: true as const }
}

/** soft delete — deleted_at 세팅 */
export async function deleteAppointment(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('appointments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/admin/booking')
  return { ok: true as const }
}

/**
 * 예약 취소 — soft delete가 아니라 status를 바꾼다.
 *   '노쇼' → status='noshow'
 *   그 외 → status='cancelled'
 * cancel_reason / cancelled_at 기록.
 */
export async function cancelAppointment(id: string, reason: CancelReason) {
  const supabase = await createClient()
  const status = reason === '노쇼' ? 'noshow' : 'cancelled'
  const { error } = await supabase
    .from('appointments')
    .update({
      status,
      cancel_reason: reason,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/admin/booking')
  return { ok: true as const }
}

export async function createStaffOff(data: StaffOffInput) {
  const supabase = await createClient()
  const { error } = await supabase.from('staff_off').insert({
    staff_id: data.staff_id,
    off_date: data.off_date,
    off_type: data.off_type,
    start_time: data.start_time ?? null,
    end_time: data.end_time ?? null,
    branch_id: data.branch_id ?? null,
  })

  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/admin/booking')
  return { ok: true as const }
}

export type StaffUpdate = {
  name?: string
  signature_color?: string
  display_order?: number
  is_active?: boolean
}

export async function updateStaff(id: string, patch: StaffUpdate) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('staff')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/admin/booking')
  revalidatePath('/admin/booking/staff')
  return { ok: true as const }
}

/** display_order 두 직원 swap (위/아래 버튼용) */
export async function swapStaffOrder(idA: string, idB: string) {
  const supabase = await createClient()

  // 두 직원 현재 order 조회
  const { data: rows, error: fErr } = await supabase
    .from('staff')
    .select('id, display_order')
    .in('id', [idA, idB])
  if (fErr || !rows || rows.length !== 2) {
    return { ok: false as const, error: fErr?.message ?? '대상 직원을 찾지 못했습니다' }
  }
  const a = rows.find((r) => r.id === idA)!
  const b = rows.find((r) => r.id === idB)!

  // 순차 업데이트 (충돌 회피용 임시값 거치지 않아도 unique 제약 없으면 OK)
  const u1 = await supabase
    .from('staff')
    .update({ display_order: b.display_order, updated_at: new Date().toISOString() })
    .eq('id', a.id)
  if (u1.error) return { ok: false as const, error: u1.error.message }

  const u2 = await supabase
    .from('staff')
    .update({ display_order: a.display_order, updated_at: new Date().toISOString() })
    .eq('id', b.id)
  if (u2.error) return { ok: false as const, error: u2.error.message }

  revalidatePath('/admin/booking')
  revalidatePath('/admin/booking/staff')
  return { ok: true as const }
}

export async function deleteStaffOff(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('staff_off').delete().eq('id', id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/admin/booking')
  revalidatePath('/admin/booking/staff')
  return { ok: true as const }
}

// ─── 휴무 관리 ───
//
// createStaffOffs:
//   - 미용사 1명 + 날짜 여러 개 일괄 등록
//   - offType='dayoff': 전일 휴무 (start_time/end_time = null)
//   - offType='half_off': 반차. start_time/end_time는 OFF 시간 범위.
//       오전 반차(특정 시간부터 출근) → start_time='11:00', end_time=<출근 시간>
//       오후 반차(특정 시간까지만 근무) → start_time=<퇴근 시간>, end_time='20:00'
//       autoAssignGroomer의 시간 범위 충돌 로직(start/end overlap)에서 그대로 활용됨.
//   - 매장 휴무일(수/일)은 자동 제외.

export async function createStaffOffs(
  staffId: string,
  dates: string[],
  offType: 'dayoff' | 'half_off',
  startTime?: string | null,
  endTime?: string | null,
): Promise<{
  ok: boolean
  error?: string
  insertedCount?: number
  skippedCount?: number
}> {
  if (!staffId) return { ok: false, error: '미용사를 선택해 주세요' }
  if (!dates || dates.length === 0) {
    return { ok: false, error: '날짜를 선택해 주세요' }
  }
  if (offType === 'half_off' && !startTime && !endTime) {
    return { ok: false, error: '반차 시간을 선택해 주세요' }
  }

  // 수/일 제외
  const validDates: string[] = []
  let skippedCount = 0
  for (const d of dates) {
    const parts = d.split('-').map(Number)
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
      skippedCount++
      continue
    }
    const [y, m, dd] = parts
    const dow = new Date(Date.UTC(y, m - 1, dd)).getUTCDay()
    if (isClosedDow(dow)) {
      skippedCount++
      continue
    }
    validDates.push(d)
  }

  if (validDates.length === 0) {
    return {
      ok: false,
      error: '등록 가능한 날짜가 없습니다 (수/일은 매장 휴무로 자동 제외)',
    }
  }

  const supabase = await createClient()
  const rows = validDates.map((d) => ({
    staff_id: staffId,
    off_date: d,
    off_type: offType,
    start_time: offType === 'half_off' ? (startTime ?? null) : null,
    end_time: offType === 'half_off' ? (endTime ?? null) : null,
    branch_id: null,
  }))
  const { error } = await supabase.from('staff_off').insert(rows)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/booking')
  revalidatePath('/admin/booking/staff')
  return {
    ok: true,
    insertedCount: validDates.length,
    skippedCount,
  }
}

export type StaffOffWithStaff = StaffOff & { staff_name: string }


// ─── 고정(정기) 예약 ───

export type RecurringAppointment = {
  id: string
  pet_id: string | null
  pet_name: string
  pet_breed: string | null
  weekday: number               // 0=일 ~ 6=토
  staff_id: string | null
  staff_name: string | null     // 조인 결과
  note: string | null
}

export async function listRecurringAppointments(): Promise<RecurringAppointment[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recurring_appointments')
    .select(
      `id, pet_id, pet_name, pet_breed, weekday, staff_id, note,
       staff:staff_id ( name )`,
    )
    .order('weekday', { ascending: true })
    .order('pet_name', { ascending: true })
  if (error || !data) return []
  return data.map((row: any) => ({
    id: row.id,
    pet_id: row.pet_id ?? null,
    pet_name: row.pet_name,
    pet_breed: row.pet_breed ?? null,
    weekday: row.weekday,
    staff_id: row.staff_id ?? null,
    staff_name: row.staff?.name ?? null,
    note: row.note ?? null,
  }))
}

export async function createRecurringAppointment(input: {
  petName: string
  petBreed?: string | null
  weekday: number
  staffId?: string | null
  note?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  if (!input.petName?.trim()) {
    return { ok: false, error: '반려견 이름을 입력해 주세요' }
  }
  if (input.weekday < 0 || input.weekday > 6) {
    return { ok: false, error: '요일이 올바르지 않습니다' }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('recurring_appointments').insert({
    pet_name: input.petName.trim(),
    pet_breed: input.petBreed?.trim() || null,
    weekday: input.weekday,
    staff_id: input.staffId || null,
    note: input.note?.trim() || null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/booking')
  return { ok: true }
}

export async function deleteRecurringAppointment(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('recurring_appointments')
    .delete()
    .eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/booking')
  return { ok: true }
}

/** 오늘(KST) 이상의 staff_off 목록 — 미용사 이름 포함. */
export async function getUpcomingStaffOffs(): Promise<StaffOffWithStaff[]> {
  const supabase = await createClient()
  // KST 기준 오늘 날짜
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const todayKst = kst.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('staff_off')
    .select(
      `id, staff_id, off_date, off_type, start_time, end_time,
       staff:staff_id ( name )`,
    )
    .gte('off_date', todayKst)
    .neq('off_type', 'lunch')
    .order('off_date', { ascending: true })

  if (error || !data) return []
  return data.map((row: any) => ({
    id: row.id,
    staff_id: row.staff_id,
    off_date: row.off_date,
    off_type: row.off_type,
    start_time: row.start_time,
    end_time: row.end_time,
    staff_name: row.staff?.name ?? '',
  }))
}


// ─── 빈 시간 찾기 ───

export type WeeklyAvailability = {
  date: string                              // "YYYY-MM-DD"
  dayLabel: string                          // "월 5/12"
  ranges: { start: string; end: string }[]  // [{ start: "14:00", end: "17:00" }]
  isClosed: boolean                         // 매장 고정 휴무 (수/일)
}

const SHOP_OPEN_MIN = 11 * 60   // 11:00
const SHOP_CLOSE_MIN = 20 * 60  // 20:00

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function minToHHMM(min: number): string {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`
}

function addDaysStr(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
}

function dowOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=Sun…6=Sat
}

const DOW_KO = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 주간 빈 시간 조회.
 * weekStartDate(월요일)부터 7일치, 영업시간 11:00–20:00 기준.
 * - 수/일: isClosed = true (매장 고정 휴무)
 * - 그 외: appointments + staff_off(dayoff)를 차단으로 빼고 남은 연속 구간 반환
 *   (점심 시간은 자동 제외하지 않음 — 순수 빈 시간만 표시)
 * - durationMin 이상의 구간만 포함
 */
export async function findAvailableSlots(
  groomerId: string,
  durationMin: number,
  weekStartDate: string,
): Promise<WeeklyAvailability[]> {
  const supabase = await createClient()

  const endDate = addDaysStr(weekStartDate, 6)
  const dayStartUtc = new Date(`${weekStartDate}T00:00:00+09:00`).toISOString()
  const dayEndUtc = new Date(`${endDate}T23:59:59.999+09:00`).toISOString()

  const [offRes, apptRes] = await Promise.all([
    supabase
      .from('staff_off')
      .select('off_date, off_type')
      .eq('staff_id', groomerId)
      .gte('off_date', weekStartDate)
      .lte('off_date', endDate),
    supabase
      .from('appointments')
      .select('start_at, duration_min')
      .eq('staff_id', groomerId)
      .gte('start_at', dayStartUtc)
      .lte('start_at', dayEndUtc)
      .is('deleted_at', null),
  ])

  // 날짜별 종일 휴무 여부
  const dayoffSet = new Set<string>()
  for (const o of offRes.data ?? []) {
    if (o.off_type === 'dayoff') dayoffSet.add(o.off_date)
  }

  // 날짜별 예약 차단 구간
  const apptByDate = new Map<string, { start: number; end: number }[]>()
  for (const a of apptRes.data ?? []) {
    const startMs = new Date(a.start_at).getTime()
    const kst = new Date(startMs + 9 * 60 * 60 * 1000)
    const dateStr = kst.toISOString().slice(0, 10)
    const startMin = kst.getUTCHours() * 60 + kst.getUTCMinutes()
    const endMin = startMin + a.duration_min
    const arr = apptByDate.get(dateStr) ?? []
    arr.push({ start: startMin, end: endMin })
    apptByDate.set(dateStr, arr)
  }

  const result: WeeklyAvailability[] = []

  for (let i = 0; i < 7; i++) {
    const dateStr = addDaysStr(weekStartDate, i)
    const dow = dowOf(dateStr)
    const [, mo, d] = dateStr.split('-').map(Number)
    const dayLabel = `${DOW_KO[dow]} ${mo}/${d}`

    // 매장 고정 휴무 (일/수)
    if (isClosedDow(dow)) {
      result.push({ date: dateStr, dayLabel, ranges: [], isClosed: true })
      continue
    }

    // 미용사 종일 휴무 → 영업일이지만 가용 0
    if (dayoffSet.has(dateStr)) {
      result.push({ date: dateStr, dayLabel, ranges: [], isClosed: false })
      continue
    }

    // 예약 구간 정렬 + 병합
    const blocked = [...(apptByDate.get(dateStr) ?? [])].sort(
      (a, b) => a.start - b.start,
    )
    const merged: { start: number; end: number }[] = []
    for (const b of blocked) {
      const last = merged[merged.length - 1]
      if (last && b.start <= last.end) {
        last.end = Math.max(last.end, b.end)
      } else {
        merged.push({ start: b.start, end: b.end })
      }
    }

    // 영업시간 - 예약 = 빈 구간
    const free: { start: number; end: number }[] = []
    let cursor = SHOP_OPEN_MIN
    for (const b of merged) {
      const bs = Math.max(b.start, SHOP_OPEN_MIN)
      const be = Math.min(b.end, SHOP_CLOSE_MIN)
      if (bs > cursor) free.push({ start: cursor, end: bs })
      cursor = Math.max(cursor, be)
      if (cursor >= SHOP_CLOSE_MIN) break
    }
    if (cursor < SHOP_CLOSE_MIN) {
      free.push({ start: cursor, end: SHOP_CLOSE_MIN })
    }

    // durationMin 이상만 채택
    const ranges = free
      .filter((r) => r.end - r.start >= durationMin)
      .map((r) => ({ start: minToHHMM(r.start), end: minToHHMM(r.end) }))

    result.push({ date: dateStr, dayLabel, ranges, isClosed: false })
  }

  return result
}


// ─── 고객(반려견) 매칭 ───

export type PetMatch = {
  id: string
  name: string
  breed: string | null
  guardian_id: string | null
  guardian_name: string | null
  guardian_phone: string | null
}

/**
 * 이름으로 pets 검색.
 * - 항상 이름만으로 DB 조회 (품종으로 필터링하지 않음)
 * - breed가 주어지면, 품종 일치 결과를 앞쪽으로 정렬
 */
export async function findPetsByName(
  name: string,
  breed?: string | null,
): Promise<PetMatch[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pets')
    .select(
      `id, name, breed, guardian_id,
       guardians:guardian_id ( name, phone )`,
    )
    .eq('name', name)
    .limit(20)

  const all = (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    breed: p.breed,
    guardian_id: p.guardian_id,
    guardian_name: p.guardians?.name ?? null,
    guardian_phone: p.guardians?.phone ?? null,
  }))

  // 품종이 입력됐으면 일치 결과를 앞으로 정렬
  if (breed) {
    all.sort((a, b) => {
      const aMatch = a.breed === breed ? 1 : 0
      const bMatch = b.breed === breed ? 1 : 0
      return bMatch - aMatch
    })
  }

  return all
}

/** 이름 부분 검색 (ilike) — 고객 연결 팝업용 */
export async function searchPetsByQuery(query: string): Promise<PetMatch[]> {
  if (!query.trim()) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('pets')
    .select(
      `id, name, breed, guardian_id,
       guardians:guardian_id ( name, phone )`,
    )
    .ilike('name', `%${query.trim()}%`)
    .limit(20)

  return (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    breed: p.breed,
    guardian_id: p.guardian_id,
    guardian_name: p.guardians?.name ?? null,
    guardian_phone: p.guardians?.phone ?? null,
  }))
}

/** 신규 보호자 + 반려견 등록 */
export async function createPetWithGuardian(input: {
  petName: string
  breed: string | null
  guardianName: string
  guardianPhone: string
}) {
  const supabase = await createClient()

  // 1) guardian 등록
  const { data: g, error: gErr } = await supabase
    .from('guardians')
    .insert({ name: input.guardianName, phone: input.guardianPhone })
    .select('id')
    .single()
  if (gErr || !g) {
    return { ok: false as const, error: gErr?.message ?? '보호자 등록 실패' }
  }

  // 2) pet 등록
  const { data: p, error: pErr } = await supabase
    .from('pets')
    .insert({
      name: input.petName,
      breed: input.breed,
      guardian_id: g.id,
    })
    .select('id')
    .single()
  if (pErr || !p) {
    return { ok: false as const, error: pErr?.message ?? '반려견 등록 실패' }
  }

  return { ok: true as const, petId: p.id, guardianId: g.id }
}


// ─── 자동 미용사 배정 ───

/**
 * 주어진 시간대에 비어있는 미용사 중 service_priority + 그날 예약 수로
 * 가장 적합한 미용사를 선택해서 ID를 반환.
 * 모두 꽉 찼거나 휴무일이면 null.
 *
 * 정렬 우선순위:
 *   1) service_priority[service] 오름차순 (값 없으면 +Infinity)
 *   2) 그날 본인 예약 개수 오름차순
 *   3) display_order 오름차순 (안정적 tiebreaker)
 */
export async function autoAssignGroomer(
  date: string,           // "YYYY-MM-DD" (KST)
  startTime: string,      // "HH:MM"
  durationMin: number,
  service: string | null,
): Promise<string | null> {
  console.log('[autoAssign] called', { date, startTime, durationMin, service })

  // 휴무일 가드
  const [yy, mm, dd] = date.split('-').map(Number)
  const dow = new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay()
  if (isClosedDow(dow)) {
    console.log('[autoAssign] return null: closed day', { dow })
    return null
  }

  const supabase = await createClient()

  const newStartMs = new Date(`${date}T${startTime}:00+09:00`).getTime()
  const newEndMs = newStartMs + durationMin * 60000
  const dayStartUtc = new Date(`${date}T00:00:00+09:00`).toISOString()
  const dayEndUtc = new Date(`${date}T23:59:59.999+09:00`).toISOString()

  // active groomers — is_active 필터로 충분, role 컬럼은 비신뢰
  // 주의: service_priority 컬럼은 마이그레이션 적용 후에만 존재 → 별도로 try/catch 조회
  const { data: staffRows, error: stErr } = await supabase
    .from('staff')
    .select('id, display_order, is_active')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (stErr) console.log('[autoAssign] staff query error', stErr.message)
  console.log('[autoAssign] staffRows count', (staffRows ?? []).length, staffRows)

  let groomers = staffRows ?? []
  console.log('[autoAssign] groomers count (pre auto_assign filter)', groomers.length)

  // auto_assign 별도 조회 (컬럼 없으면 무필터 fallback)
  if (groomers.length > 0) {
    const { data: aaRows, error: aaErr } = await supabase
      .from('staff')
      .select('id, auto_assign')
      .in('id', groomers.map((g: any) => g.id))
    if (aaErr) {
      console.log('[autoAssign] auto_assign query error (ignored)', aaErr.message)
    } else {
      const allowSet = new Set(
        (aaRows ?? [])
          .filter((r: any) => r.auto_assign !== false)
          .map((r: any) => r.id),
      )
      groomers = groomers.filter((g: any) => allowSet.has(g.id))
      console.log('[autoAssign] groomers after auto_assign filter', groomers.length)
    }
  }

  // service_priority 별도 조회 (컬럼 없으면 빈 맵으로 fallback)
  const priorityMap = new Map<string, Record<string, number>>()
  if (groomers.length > 0) {
    const { data: prRows, error: prErr } = await supabase
      .from('staff')
      .select('id, service_priority')
      .in('id', groomers.map((g: any) => g.id))
    if (prErr) {
      console.log('[autoAssign] service_priority query error (ignored)', prErr.message)
    } else {
      for (const r of prRows ?? []) {
        if (r.service_priority) priorityMap.set(r.id, r.service_priority as Record<string, number>)
      }
    }
  }
  if (groomers.length === 0) {
    console.log('[autoAssign] return null: no eligible groomers')
    return null
  }

  // 당일 모든 예약 (active)
  const { data: apptRows, error: apErr } = await supabase
    .from('appointments')
    .select('staff_id, start_at, duration_min')
    .gte('start_at', dayStartUtc)
    .lte('start_at', dayEndUtc)
    .is('deleted_at', null)

  if (apErr) console.log('[autoAssign] appt query error', apErr.message)
  const dayAppts = apptRows ?? []
  console.log('[autoAssign] dayAppts count', dayAppts.length)

  // 당일 staff_off 조회
  const { data: offRows, error: offErr } = await supabase
    .from('staff_off')
    .select('staff_id, off_type, start_time, end_time')
    .eq('off_date', date)
    .in('staff_id', groomers.map((g: any) => g.id))

  if (offErr) console.log('[autoAssign] staff_off query error (ignored)', offErr.message)
  const dayOffs = offRows ?? []
  console.log('[autoAssign] staff_off rows count', dayOffs.length)

  // "HH:MM" → ms (KST 기준 해당 날짜)
  const hhmmToMs = (hhmm: string): number =>
    new Date(`${date}T${hhmm}:00+09:00`).getTime()

  // 미용사별 그날 예약 수 + 시간 충돌 여부
  type Candidate = {
    id: string
    priority: number
    dayCount: number
    displayOrder: number
  }
  const candidates: Candidate[] = []
  for (const g of groomers) {
    const offs = dayOffs.filter((o: any) => o.staff_id === g.id)

    // 1) 전일 휴무 → 완전 제외
    const isDayoff = offs.some((o: any) => o.off_type === 'dayoff')
    if (isDayoff) {
      console.log('[autoAssign] groomer skipped: dayoff', { id: g.id })
      continue
    }

    // 2) 시간 범위 휴무(lunch / half_off 등) → 요청 시간과 겹치면 제외
    const offConflict = offs.some((o: any) => {
      if (o.off_type === 'dayoff') return false
      if (!o.start_time) return false
      const oStart = hhmmToMs(o.start_time)
      const oEnd = o.end_time ? hhmmToMs(o.end_time) : oStart + 60 * 60000 // end_time 없으면 1시간 가정
      return newStartMs < oEnd && oStart < newEndMs
    })
    if (offConflict) {
      console.log('[autoAssign] groomer skipped: off-time overlap', { id: g.id })
      continue
    }

    // 3) 기존 예약 충돌 검사
    const own = dayAppts.filter((a: any) => a.staff_id === g.id)
    const apptConflict = own.some((a: any) => {
      const eStart = new Date(a.start_at).getTime()
      const eEnd = eStart + (a.duration_min ?? 0) * 60000
      return newStartMs < eEnd && eStart < newEndMs
    })
    console.log('[autoAssign] groomer check', { id: g.id, ownCount: own.length, apptConflict })
    if (apptConflict) continue

    const sp = priorityMap.get(g.id) ?? null
    const priority =
      service && sp && typeof sp[service] === 'number'
        ? sp[service]
        : Number.POSITIVE_INFINITY

    candidates.push({
      id: g.id,
      priority,
      dayCount: own.length,
      displayOrder: g.display_order ?? 0,
    })
  }

  console.log('[autoAssign] candidates', candidates.length, candidates)

  if (candidates.length === 0) {
    console.log('[autoAssign] return null: all conflicting')
    return null
  }

  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    if (a.dayCount !== b.dayCount) return a.dayCount - b.dayCount
    return a.displayOrder - b.displayOrder
  })

  console.log('[autoAssign] picked', candidates[0].id)
  return candidates[0].id
}
