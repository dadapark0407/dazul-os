'use server'

// =============================================================
// DAZUL OS — 예약 시스템 서버 액션
// =============================================================

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

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
}

export type StaffOffInput = {
  staff_id: string
  off_date: string         // YYYY-MM-DD
  off_type: 'lunch' | 'dayoff'
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
}

export type Appointment = {
  id: string
  start_at: string
  duration_min: number
  status: string
  pet_id: string | null
  guardian_id: string | null
  staff_id: string | null
  note: string | null
  raw_input: string | null
  pet_name?: string | null
  pet_breed?: string | null
  guardian_name?: string | null
  service?: string | null
}

export type StaffOff = {
  id: string
  staff_id: string
  off_date: string
  off_type: 'lunch' | 'dayoff'
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

  // 미용사 목록
  const { data: staffRows } = await supabase
    .from('staff')
    .select('id, name, signature_color, display_order, is_active, branch_id')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  // 당일 예약 (deleted_at NULL)
  // 표시 우선순위: 관계(pets) > 컬럼 스냅샷(appointments.pet_name)
  const { data: apptRows } = await supabase
    .from('appointments')
    .select(
      `id, start_at, duration_min, status, pet_id, guardian_id, staff_id,
       note, raw_input, pet_name, pet_breed, service,
       pets:pet_id ( name, breed ),
       guardians:guardian_id ( name )`,
    )
    .gte('start_at', dayStartUtc)
    .lte('start_at', dayEndUtc)
    .is('deleted_at', null)
    .order('start_at', { ascending: true })

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
  }))

  // 당일 staff_off
  const { data: offRows } = await supabase
    .from('staff_off')
    .select('id, staff_id, off_date, off_type, start_time, end_time')
    .eq('off_date', date)

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

  const { data: staffRows } = await supabase
    .from('staff')
    .select('id, name, signature_color, display_order, is_active, branch_id')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  const { data: apptRows } = await supabase
    .from('appointments')
    .select(
      `id, start_at, duration_min, status, pet_id, guardian_id, staff_id,
       note, raw_input, pet_name, pet_breed, service,
       pets:pet_id ( name, breed ),
       guardians:guardian_id ( name )`,
    )
    .gte('start_at', calStart.toISOString())
    .lt('start_at', calEnd.toISOString())
    .is('deleted_at', null)
    .order('start_at', { ascending: true })

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
  return { ok: true as const }
}


// ─── 빈 시간 찾기 ───

export type AvailableSlot = {
  date: string       // YYYY-MM-DD
  startTime: string  // "HH:MM"
  endTime: string    // "HH:MM"
}

const SHOP_OPEN_MIN = 11 * 60   // 11:00
const SHOP_CLOSE_MIN = 20 * 60  // 20:00
const SLOT_STEP_MIN = 30

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function minToHHMM(min: number): string {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`
}

function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
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

/**
 * 미용사·소요시간 기준 빈 슬롯 검색.
 * 오늘부터 30일 이내, 매장 휴무일(수/일) 제외, staff_off 및 기존 예약 제외.
 * 영업시간 11:00–20:00, 30분 간격으로 연속 빈 슬롯을 찾아 가장 빠른 limit개 반환.
 * (날짜당 1개씩, limit개 날짜)
 */
export async function findAvailableSlots(
  groomerId: string,
  durationMin: number,
  limit: number = 5,
): Promise<AvailableSlot[]> {
  const supabase = await createClient()

  // 오늘 (KST)
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const today = nowKst.toISOString().slice(0, 10)
  const endDate = addDaysStr(today, 29) // 오늘 포함 30일

  // 30일 범위 staff_off / appointments 한 번에 조회
  const dayStartUtc = new Date(`${today}T00:00:00+09:00`).toISOString()
  const dayEndUtc = new Date(`${endDate}T23:59:59.999+09:00`).toISOString()

  const [offRes, apptRes] = await Promise.all([
    supabase
      .from('staff_off')
      .select('off_date, off_type, start_time, end_time')
      .eq('staff_id', groomerId)
      .gte('off_date', today)
      .lte('off_date', endDate),
    supabase
      .from('appointments')
      .select('start_at, duration_min')
      .eq('staff_id', groomerId)
      .gte('start_at', dayStartUtc)
      .lte('start_at', dayEndUtc)
      .is('deleted_at', null),
  ])

  // 날짜별 인덱싱
  const offByDate = new Map<
    string,
    { off_type: string; start_time: string | null; end_time: string | null }[]
  >()
  for (const o of offRes.data ?? []) {
    const arr = offByDate.get(o.off_date) ?? []
    arr.push({
      off_type: o.off_type,
      start_time: o.start_time,
      end_time: o.end_time,
    })
    offByDate.set(o.off_date, arr)
  }

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

  const nowMin = nowKst.getUTCHours() * 60 + nowKst.getUTCMinutes()
  const results: AvailableSlot[] = []

  for (let i = 0; i < 30 && results.length < limit; i++) {
    const dateStr = addDaysStr(today, i)
    const dow = dowOf(dateStr)
    if (dow === 0 || dow === 3) continue // 일/수 매장 휴무

    // 미용사 종일 휴무
    const offs = offByDate.get(dateStr) ?? []
    if (offs.some((o) => o.off_type === 'dayoff')) continue

    // 차단 구간 = 점심 + 기존 예약
    const blocked: { start: number; end: number }[] = []
    for (const o of offs) {
      if (o.off_type === 'lunch' && o.start_time) {
        const s = hhmmToMin(o.start_time)
        const e = o.end_time ? hhmmToMin(o.end_time) : s + 60
        blocked.push({ start: s, end: e })
      }
    }
    for (const a of apptByDate.get(dateStr) ?? []) {
      blocked.push({ start: a.start, end: a.end })
    }

    // 30분 간격으로 연속 빈 슬롯 탐색 — 날짜당 가장 빠른 1개
    for (let t = SHOP_OPEN_MIN; t + durationMin <= SHOP_CLOSE_MIN; t += SLOT_STEP_MIN) {
      // 오늘이면 현재시각 이후만
      if (i === 0 && t < nowMin) continue
      const slotEnd = t + durationMin
      const overlap = blocked.some((b) => t < b.end && b.start < slotEnd)
      if (overlap) continue
      results.push({
        date: dateStr,
        startTime: minToHHMM(t),
        endTime: minToHHMM(slotEnd),
      })
      break
    }
  }

  return results
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
