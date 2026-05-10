// =============================================================
// DAZUL OS — 예약 시스템 공용 상수
// =============================================================

/** 매장 고정 휴무일: 0=일요일, 3=수요일 */
export const CLOSED_DOWS = [0, 3] as const

/** 주어진 요일 번호(getDay/getUTCDay 기준)가 매장 휴무일인지 */
export function isClosedDow(dow: number): boolean {
  return CLOSED_DOWS.includes(dow as 0 | 3)
}
