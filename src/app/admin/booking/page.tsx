// =============================================================
// DAZUL OS — 예약 캘린더 페이지 (서버 컴포넌트)
// =============================================================

import BookingCalendar from '@/components/booking/BookingCalendar'
import { getBookingData } from '@/lib/booking/actions'

/** YYYY-MM-DD (KST 기준) */
function todayKst(): string {
  const now = new Date()
  // KST 오프셋(+09:00) 적용한 ISO 문자열에서 날짜 추출
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

type SearchParams = Promise<{ date?: string }>

export default async function BookingPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
    ? params.date
    : todayKst()

  const initial = await getBookingData(date)

  return (
    <div>
      <BookingCalendar
        initialDate={date}
        initialStaff={initial.staff}
        initialAppointments={initial.appointments}
        initialStaffOff={initial.staffOff}
      />
    </div>
  )
}
