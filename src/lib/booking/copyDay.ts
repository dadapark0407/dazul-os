// =============================================================
// 하루 스케줄 텍스트 — 월간/일간 캘린더의 "복사" 버튼 공용
//
// 형식:
//   5/13(화)
//   휴무: 길동, 영희
//   11:00 몽이 말티즈 미용 - 길동 (자동) (메모)
// =============================================================

import type { Appointment, Staff } from './actions'

const KO_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function isoToKstHHMM(iso: string): string {
  const kst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
  const h = String(kst.getUTCHours()).padStart(2, '0')
  const m = String(kst.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/** 한국 성씨 1자 가정 — "강수진" → "수진" */
function givenName(fullName: string | null | undefined): string | null {
  if (!fullName) return null
  return fullName.length >= 2 ? fullName.slice(1) : fullName
}

/** "5/13(화)" 형태로 포맷 */
function formatDateHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${m}/${d}(${KO_WEEKDAYS[dow]})`
}

/** 복사 대상 예약 — 취소/노쇼 제외, 미용사 필터 반영 */
export function copyableAppointments(appointments: Appointment[], filterGroomerId?: string | null): Appointment[] {
  return appointments.filter((a) => {
    if (a.status === 'cancelled' || a.status === 'noshow') return false
    if (filterGroomerId && a.staff_id !== filterGroomerId) return false
    return true
  })
}

/** 복사 대상 휴무자 — 미용사 필터 반영 */
export function copyableDayoffStaff(
  dayoffStaff: { id: string; name: string }[],
  filterGroomerId?: string | null,
): { id: string; name: string }[] {
  return filterGroomerId ? dayoffStaff.filter((s) => s.id === filterGroomerId) : dayoffStaff
}

/** 해당 날짜의 예약을 시간순 텍스트로 (휴무자 포함) */
export function buildDayScheduleText({
  date,
  appointments,
  staff,
  dayoffStaff,
  filterGroomerId,
}: {
  date: string
  appointments: Appointment[]
  staff: Staff[]
  dayoffStaff: { id: string; name: string }[]
  filterGroomerId?: string | null
}): string {
  const lines: string[] = [formatDateHeader(date)]

  // 개인 휴무 줄 — 이름 오름차순
  const dayoffFiltered = copyableDayoffStaff(dayoffStaff, filterGroomerId)
  if (dayoffFiltered.length > 0) {
    const names = [...dayoffFiltered]
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      .map((s) => givenName(s.name) ?? s.name)
      .join(', ')
    lines.push(`휴무: ${names}`)
  }

  // 예약 줄 — 시간순
  const sorted = copyableAppointments(appointments, filterGroomerId).sort((a, b) =>
    a.start_at.localeCompare(b.start_at),
  )
  for (const a of sorted) {
    const time = isoToKstHHMM(a.start_at)
    const staffMember = staff.find((s) => s.id === a.staff_id)
    const staffShort = givenName(staffMember?.name ?? null)

    const parts: string[] = [time]
    if (a.pet_name) parts.push(a.pet_name)
    if (a.pet_breed) parts.push(a.pet_breed)
    if (a.service) parts.push(a.service)
    let line = parts.join(' ')
    if (staffShort) line += ` - ${staffShort}`
    if (a.assign_type === 'random') line += ' (자동)'
    const noteTrim = a.note?.trim()
    if (noteTrim) line += ` (${noteTrim})`
    lines.push(line)
  }

  return lines.join('\n')
}
