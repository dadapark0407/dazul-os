// 한국 전화번호 자동 하이픈 포맷팅
// - 숫자만 추출 후 최대 11자리 사용
// - 010 → 3-4-4 (010-1234-5678)
// - 011/016/017/018/019 → 3-3-4 또는 3-4-4 (11자리일 때)
// - 02 (서울) → 2-3-4 / 2-4-4
// - 지역번호(031 등) → 3-3-4 / 3-4-4
// - 숫자 외 입력은 무시

export function formatPhone(raw: string): string {
  const digits = (raw ?? '').replace(/\D/g, '').slice(0, 11)
  if (!digits) return ''

  // 서울 (02)
  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, digits.length - 4)}-${digits.slice(digits.length - 4)}`
    // 10자리: 02-XXXX-XXXX
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`
  }

  // 010 (휴대폰 11자리 고정: 3-4-4)
  if (digits.startsWith('010')) {
    if (digits.length <= 3) return digits
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
  }

  // 011/016/017/018/019 (3-3-4 기본, 11자리면 3-4-4)
  if (/^01[1-9]/.test(digits)) {
    if (digits.length <= 3) return digits
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
    }
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`
  }

  // 지역번호 (031/032/.../070 등) — 3-3-4 또는 3-4-4
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4)}-${digits.slice(digits.length - 4)}`
  // 11자리 기타
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
}
