// =============================================================
// DAZUL OS — 예약 파서 테스트
// 실행: vitest (또는 jest 호환) — globals 미사용 시 import 그대로
// =============================================================

import { describe, it, expect } from 'vitest'
import { parseBookingInput } from './parser'

const STAFF = ['미용사A', '미용사B', '미용사C', '미용사D', '미용사E']


describe('parseBookingInput — 예약 (appointment)', () => {
  it('"10시 코코 비숑 2시간 미용사A"', () => {
    const r = parseBookingInput('10시 코코 비숑 2시간 미용사A', STAFF)
    expect(r.type).toBe('appointment')
    if (r.type !== 'appointment') return
    expect(r.data.time).toBe('10:00')
    expect(r.data.petName).toBe('코코')
    expect(r.data.breed).toBe('비숑')
    expect(r.data.duration).toBe(120)
    expect(r.data.staffName).toBe('미용사A')
    expect(r.data.note).toBeNull()
    expect(r.data.raw).toBe('10시 코코 비숑 2시간 미용사A')
  })

  it('"오후 2시 콩이 말티즈 1.5시간" — 미용사 미지정', () => {
    const r = parseBookingInput('오후 2시 콩이 말티즈 1.5시간', STAFF)
    expect(r.type).toBe('appointment')
    if (r.type !== 'appointment') return
    expect(r.data.time).toBe('14:00')
    expect(r.data.petName).toBe('콩이')
    expect(r.data.breed).toBe('말티즈')
    expect(r.data.duration).toBe(90)
    expect(r.data.staffName).toBeNull()
    expect(r.data.note).toBeNull()
  })

  it('"3시반 보리 골든 4시간 미용사B (메모)" — 괄호 메모 분리', () => {
    const input =
      '3시반 보리 골든 4시간 미용사B (10시 30분에 맡기고 2시에 픽업)'
    const r = parseBookingInput(input, STAFF)
    expect(r.type).toBe('appointment')
    if (r.type !== 'appointment') return
    expect(r.data.time).toBe('15:30')
    expect(r.data.petName).toBe('보리')
    expect(r.data.breed).toBe('골든')
    expect(r.data.duration).toBe(240)
    expect(r.data.staffName).toBe('미용사B')
    expect(r.data.note).toBe('10시 30분에 맡기고 2시에 픽업')
  })

  it('"11시 다다 푸들 3시간" — 7~12시는 오전 추정', () => {
    const r = parseBookingInput('11시 다다 푸들 3시간', STAFF)
    expect(r.type).toBe('appointment')
    if (r.type !== 'appointment') return
    expect(r.data.time).toBe('11:00')
    expect(r.data.petName).toBe('다다')
    expect(r.data.breed).toBe('푸들')
    expect(r.data.duration).toBe(180)
    expect(r.data.staffName).toBeNull()
  })
})


describe('parseBookingInput — 서비스 키워드', () => {
  it('"5시 벤 목욕 1시간"', () => {
    const r = parseBookingInput('5시 벤 목욕 1시간', STAFF)
    expect(r.type).toBe('appointment')
    if (r.type !== 'appointment') return
    expect(r.data.time).toBe('17:00')        // 5시 → 오후 추정
    expect(r.data.petName).toBe('벤')
    expect(r.data.service).toBe('목욕')
    expect(r.data.duration).toBe(60)
  })

  it('"10시 코코 비숑 미용 2시간 미용사A" — 미용 키워드와 미용사A 충돌 회피', () => {
    const r = parseBookingInput(
      '10시 코코 비숑 미용 2시간 미용사A',
      STAFF,
    )
    expect(r.type).toBe('appointment')
    if (r.type !== 'appointment') return
    expect(r.data.time).toBe('10:00')
    expect(r.data.petName).toBe('코코')
    expect(r.data.breed).toBe('비숑')
    expect(r.data.service).toBe('미용')
    expect(r.data.duration).toBe(120)
    expect(r.data.staffName).toBe('미용사A')
  })

  it('"2시 콩이 스파 3시간"', () => {
    const r = parseBookingInput('2시 콩이 스파 3시간', STAFF)
    expect(r.type).toBe('appointment')
    if (r.type !== 'appointment') return
    expect(r.data.time).toBe('14:00')
    expect(r.data.petName).toBe('콩이')
    expect(r.data.service).toBe('스파')
    expect(r.data.duration).toBe(180)
  })

  it('서비스 미지정 시 service = null', () => {
    const r = parseBookingInput('10시 코코 비숑 2시간', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.service).toBeNull()
  })

  // ── 복합 서비스 ──
  it('"11시 코코 목욕 얼굴컷" — 공백 → "목욕+얼굴컷" 합성', () => {
    const r = parseBookingInput('11시 코코 목욕 얼굴컷', STAFF)
    expect(r.type).toBe('appointment')
    if (r.type !== 'appointment') return
    expect(r.data.petName).toBe('코코')
    expect(r.data.service).toBe('목욕+얼굴컷')
  })

  it('"2시 콩이 부분얼컷 1시간"', () => {
    const r = parseBookingInput('2시 콩이 부분얼컷 1시간', STAFF)
    expect(r.type).toBe('appointment')
    if (r.type !== 'appointment') return
    expect(r.data.petName).toBe('콩이')
    expect(r.data.service).toBe('부분얼컷')
    expect(r.data.duration).toBe(60)
  })

  it('"10시 벤 목욕+얼굴컷 2시간 미용사A" — "+"로 직접 입력', () => {
    const r = parseBookingInput(
      '10시 벤 목욕+얼굴컷 2시간 미용사A',
      STAFF,
    )
    expect(r.type).toBe('appointment')
    if (r.type !== 'appointment') return
    expect(r.data.petName).toBe('벤')
    expect(r.data.service).toBe('목욕+얼굴컷')
    expect(r.data.duration).toBe(120)
    expect(r.data.staffName).toBe('미용사A')
  })
})


describe('parseBookingInput — 시간 파싱', () => {
  it('"14:30" 24시간 형식 그대로', () => {
    const r = parseBookingInput('14:30 코코 비숑', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.time).toBe('14:30')
  })

  it('"2시 30분" — 분 표기', () => {
    const r = parseBookingInput('2시 30분 코코 비숑', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.time).toBe('14:30')
  })

  it('"오전 9시" — 명시적 오전', () => {
    const r = parseBookingInput('오전 9시 코코 비숑', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.time).toBe('09:00')
  })

  it('"오후 12시" — 정오', () => {
    const r = parseBookingInput('오후 12시 코코 비숑', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.time).toBe('12:00')
  })
})


describe('parseBookingInput — 소요시간 파싱', () => {
  it('"1시간 30분"', () => {
    const r = parseBookingInput('10시 코코 비숑 1시간 30분', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.duration).toBe(90)
  })

  it('"1시간반"', () => {
    const r = parseBookingInput('10시 코코 비숑 1시간반', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.duration).toBe(90)
  })

  it('"3h"', () => {
    const r = parseBookingInput('10시 코코 비숑 3h', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.duration).toBe(180)
  })

  it('소요시간 없으면 기본 120분', () => {
    const r = parseBookingInput('10시 코코 비숑', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.duration).toBe(120)
  })
})


describe('parseBookingInput — 신규 / 지정없음 / 날짜 / 체중·나이', () => {
  // 헬퍼: 오늘로부터 N일 후 YYYY-MM-DD
  function dayOffset(n: number): string {
    const d = new Date()
    d.setDate(d.getDate() + n)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }

  it('"신규 비숑 다다 3키로 4살 가위컷 지정없음 5/1 3시" — 종합', () => {
    const r = parseBookingInput(
      '신규 비숑 다다 3키로 4살 가위컷 지정없음 5/1 3시',
      STAFF,
    )
    expect(r.type).toBe('appointment')
    if (r.type !== 'appointment') return
    expect(r.data.isNewCustomer).toBe(true)
    expect(r.data.breed).toBe('비숑')
    expect(r.data.petName).toBe('다다')
    expect(r.data.service).toBe('가위컷')
    expect(r.data.staffName).toBeNull()
    expect(r.data.time).toBe('15:00')          // 3시 → 1~6 → 오후
    const year = new Date().getFullYear()
    expect(r.data.date).toBe(`${year}-05-01`)
    expect(r.data.note).toBe('3키로 4살')
  })

  it('"신규 푸들 2시간 미용사A 10시" — 이름 없으면 "신규"로 fallback', () => {
    const r = parseBookingInput('신규 푸들 2시간 미용사A 10시', STAFF)
    expect(r.type).toBe('appointment')
    if (r.type !== 'appointment') return
    expect(r.data.isNewCustomer).toBe(true)
    expect(r.data.petName).toBe('신규')
    expect(r.data.breed).toBe('푸들')
    expect(r.data.staffName).toBe('미용사A')
    expect(r.data.time).toBe('10:00')
    expect(r.data.duration).toBe(120)
  })

  it('"내일 3시 코코 비숑 2시간" — date = 내일', () => {
    const r = parseBookingInput('내일 3시 코코 비숑 2시간', STAFF)
    expect(r.type).toBe('appointment')
    if (r.type !== 'appointment') return
    expect(r.data.date).toBe(dayOffset(1))
    expect(r.data.time).toBe('15:00')
    expect(r.data.petName).toBe('코코')
    expect(r.data.breed).toBe('비숑')
  })

  it('"모레 11시 벤 1시간" — date = 모레', () => {
    const r = parseBookingInput('모레 11시 벤 1시간', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.date).toBe(dayOffset(2))
  })

  it('"5월 3일 11시 벤 1시간" — 한국어 날짜', () => {
    const r = parseBookingInput('5월 3일 11시 벤 1시간', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    const year = new Date().getFullYear()
    expect(r.data.date).toBe(`${year}-05-03`)
  })

  it('"지정없음 11시 벤 목욕 1시간" — staffName null 강제', () => {
    const r = parseBookingInput('지정없음 11시 벤 목욕 1시간', STAFF)
    expect(r.type).toBe('appointment')
    if (r.type !== 'appointment') return
    expect(r.data.staffName).toBeNull()
    expect(r.data.petName).toBe('벤')
    expect(r.data.service).toBe('목욕')
  })

  it('"미지정 11시 벤 1시간"', () => {
    const r = parseBookingInput('미지정 11시 벤 1시간', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.staffName).toBeNull()
  })

  it('체중·나이 + 괄호 메모 합치기', () => {
    const r = parseBookingInput(
      '10시 코코 비숑 3키로 4살 (3시에 데리러 오심)',
      STAFF,
    )
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.note).toBe('3키로 4살 | 3시에 데리러 오심')
  })

  it('체중만 있을 때', () => {
    const r = parseBookingInput('10시 코코 비숑 3.5kg', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.note).toBe('3.5kg')
  })

  it('서비스 추가 — 발바닥컷 / 위생미용', () => {
    const r1 = parseBookingInput('10시 코코 발바닥컷', STAFF)
    if (r1.type !== 'appointment') throw new Error('appointment 아님')
    expect(r1.data.service).toBe('발바닥컷')

    const r2 = parseBookingInput('10시 코코 위생미용', STAFF)
    if (r2.type !== 'appointment') throw new Error('appointment 아님')
    expect(r2.data.service).toBe('위생미용')
  })

  // ── 전화번호 ──
  it('"신규 비숑 다다 010-1234-5678 11시 2시간" — 하이픈 형식', () => {
    const r = parseBookingInput(
      '신규 비숑 다다 010-1234-5678 11시 2시간',
      STAFF,
    )
    expect(r.type).toBe('appointment')
    if (r.type !== 'appointment') return
    expect(r.data.petName).toBe('다다')
    expect(r.data.note).toBe('010-1234-5678')
    expect(r.data.time).toBe('11:00')
    expect(r.data.duration).toBe(120)
  })

  it('"신규 푸들 2시간 10시 01098765432" — 무구분 11자리 → 자동 포맷', () => {
    const r = parseBookingInput(
      '신규 푸들 2시간 10시 01098765432',
      STAFF,
    )
    expect(r.type).toBe('appointment')
    if (r.type !== 'appointment') return
    expect(r.data.note).toBe('010-9876-5432')
  })

  it('전화번호 — 공백 / 점 구분도 지원', () => {
    const r1 = parseBookingInput('10시 코코 비숑 010 1234 5678', STAFF)
    if (r1.type !== 'appointment') throw new Error('appointment 아님')
    expect(r1.data.note).toBe('010-1234-5678')

    const r2 = parseBookingInput('10시 코코 비숑 010.1234.5678', STAFF)
    if (r2.type !== 'appointment') throw new Error('appointment 아님')
    expect(r2.data.note).toBe('010-1234-5678')
  })

  it('체중·나이 + 전화번호 + 괄호 메모 모두 합치기', () => {
    const r = parseBookingInput(
      '10시 코코 비숑 3키로 4살 010-1234-5678 (3시에 데리러 오심)',
      STAFF,
    )
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.note).toBe(
      '3키로 4살 | 010-1234-5678 | 3시에 데리러 오심',
    )
  })

  it('서비스 미지정 / 신규 미지정 — 기본값 false / null', () => {
    const r = parseBookingInput('10시 코코 비숑 2시간 미용사A', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.isNewCustomer).toBe(false)
    expect(r.data.date).toBeNull()
  })
})


describe('parseBookingInput — "N일" 날짜 패턴', () => {
  function thisMonthDay(day: number): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  it('"10일 5시 다다" → 이번 달 10일, 17:00', () => {
    const r = parseBookingInput('10일 5시 다다', STAFF)
    expect(r.type).toBe('appointment')
    if (r.type !== 'appointment') return
    expect(r.data.date).toBe(thisMonthDay(10))
    expect(r.data.time).toBe('17:00')
    expect(r.data.petName).toBe('다다')
  })

  it('"17일 11시 다다 미용 3시간" → 이번 달 17일, 서비스 미용, 소요 180분', () => {
    const r = parseBookingInput('17일 11시 다다 미용 3시간', STAFF)
    expect(r.type).toBe('appointment')
    if (r.type !== 'appointment') return
    expect(r.data.date).toBe(thisMonthDay(17))
    expect(r.data.time).toBe('11:00')
    expect(r.data.service).toBe('미용')
    expect(r.data.duration).toBe(180)
    expect(r.data.petName).toBe('다다')
  })

  it('"5월 3일 11시 벤" — N월N일이 N일보다 우선 매칭', () => {
    const r = parseBookingInput('5월 3일 11시 벤', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    const year = new Date().getFullYear()
    expect(r.data.date).toBe(`${year}-05-03`)
  })

  it('"1일 10시 코코" → 이번 달 1일', () => {
    const r = parseBookingInput('1일 10시 코코', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.date).toBe(thisMonthDay(1))
  })
})


describe('parseBookingInput — 서비스별 기본 소요시간', () => {
  it('미용 → 기본 180분', () => {
    const r = parseBookingInput('10시 코코 미용', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.service).toBe('미용')
    expect(r.data.duration).toBe(180)
  })

  it('목욕 → 기본 90분', () => {
    const r = parseBookingInput('10시 코코 목욕', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.service).toBe('목욕')
    expect(r.data.duration).toBe(90)
  })

  it('목욕+얼굴컷 → 기본 90분 (목욕 포함)', () => {
    const r = parseBookingInput('10시 코코 목욕 얼굴컷', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.service).toBe('목욕+얼굴컷')
    expect(r.data.duration).toBe(90)
  })

  it('미용+목욕 → 기본 180분 (미용 우선)', () => {
    const r = parseBookingInput('10시 코코 미용+목욕', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.service).toBe('미용+목욕')
    expect(r.data.duration).toBe(180)
  })

  it('스파 (기타) → 기본 120분', () => {
    const r = parseBookingInput('10시 코코 스파', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.service).toBe('스파')
    expect(r.data.duration).toBe(120)
  })

  it('서비스 없음 → 기본 120분', () => {
    const r = parseBookingInput('10시 코코 비숑', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.duration).toBe(120)
  })

  it('직접 입력한 소요시간이 서비스 기본값보다 우선', () => {
    const r = parseBookingInput('10시 코코 미용 1시간', STAFF)
    if (r.type !== 'appointment') throw new Error('appointment 아님')
    expect(r.data.service).toBe('미용')
    expect(r.data.duration).toBe(60)
  })
})


describe('parseBookingInput — 미용사 매칭 (대소문자 무시)', () => {
  it('"미용사b" 소문자도 "미용사B"로 매칭', () => {
    const r = parseBookingInput('10시 코코 비숑 2시간 미용사b', STAFF)
    expect(r.type).toBe('appointment')
    if (r.type !== 'appointment') return
    expect(r.data.staffName).toBe('미용사B')
    expect(r.data.petName).toBe('코코')
  })

  it('"미용사c 휴무" 소문자도 staff_off로 매칭', () => {
    const r = parseBookingInput('미용사c 휴무', STAFF)
    expect(r.type).toBe('staff_off')
    if (r.type !== 'staff_off') return
    expect(r.data.staffName).toBe('미용사C')
    expect(r.data.offType).toBe('dayoff')
  })
})


describe('parseBookingInput — 점심 / 휴무 (staff_off)', () => {
  it('"미용사A 점심 1시" → lunch, 13:00', () => {
    const r = parseBookingInput('미용사A 점심 1시', STAFF)
    expect(r.type).toBe('staff_off')
    if (r.type !== 'staff_off') return
    expect(r.data.staffName).toBe('미용사A')
    expect(r.data.offType).toBe('lunch')
    expect(r.data.startTime).toBe('13:00')
  })

  it('"미용사C 휴무" → dayoff', () => {
    const r = parseBookingInput('미용사C 휴무', STAFF)
    expect(r.type).toBe('staff_off')
    if (r.type !== 'staff_off') return
    expect(r.data.staffName).toBe('미용사C')
    expect(r.data.offType).toBe('dayoff')
    expect(r.data.startTime).toBeNull()
  })

  it('"미용사B 점심" — 시간 없으면 startTime null', () => {
    const r = parseBookingInput('미용사B 점심', STAFF)
    expect(r.type).toBe('staff_off')
    if (r.type !== 'staff_off') return
    expect(r.data.staffName).toBe('미용사B')
    expect(r.data.offType).toBe('lunch')
    expect(r.data.startTime).toBeNull()
  })
})


describe('parseBookingInput — 에러 케이스', () => {
  it('빈 입력', () => {
    const r = parseBookingInput('', STAFF)
    expect(r.type).toBe('error')
  })

  it('공백만', () => {
    const r = parseBookingInput('   ', STAFF)
    expect(r.type).toBe('error')
  })

  it('시간 없음', () => {
    const r = parseBookingInput('코코 비숑 미용사A', STAFF)
    expect(r.type).toBe('error')
    if (r.type !== 'error') return
    expect(r.message).toContain('시간')
  })

  it('이름이 비어있음 (시간만)', () => {
    const r = parseBookingInput('10시', STAFF)
    expect(r.type).toBe('error')
  })
})
