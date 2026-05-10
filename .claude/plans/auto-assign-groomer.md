# Auto-assign groomer 구현 계획

## 결정사항 (사용자 확정)
- Auto-assign 실패 시: `staff_id=null, assign_type='fixed'`로 저장 (기존 미배정 스타일)
- 어드민 service_priority 편집 UI: 이번 작업에서 제외 (DB 컬럼만 추가, 값은 SQL로 직접 세팅)
- "지정없음" 키워드 처리: autoAssign 호출 (미지정과 동일)

---

## 1. DB 마이그레이션

### `supabase/migrations/20260510_staff_service_priority.sql`
```sql
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS service_priority JSONB DEFAULT NULL;

COMMENT ON COLUMN staff.service_priority IS
  '서비스별 우선 미용사 매핑. 예: {"목욕": 1, "미용": 2}. 숫자가 낮을수록 우선.';
```

### `supabase/migrations/20260510_appointments_assign_type.sql`
```sql
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS assign_type TEXT NOT NULL DEFAULT 'fixed'
    CHECK (assign_type IN ('fixed', 'random'));
```

---

## 2. 공용 상수 파일 (선택적 정리)

### `src/lib/booking/constants.ts` (신규)
```ts
// 휴무일: 0=일요일, 3=수요일
export const CLOSED_DOWS = [0, 3] as const
export function isClosedDow(dow: number): boolean {
  return CLOSED_DOWS.includes(dow as 0 | 3)
}
```

`MonthlyView.tsx`, `actions.ts`의 `findAvailableSlots`에서 이 상수 사용으로 교체.

---

## 3. autoAssignGroomer 서버 액션

### `src/lib/booking/actions.ts` 수정

**Type 확장:**
```ts
export type Appointment = {
  // ... 기존 필드
  assign_type?: 'fixed' | 'random'
}

export type Staff = {
  // ... 기존 필드
  service_priority?: Record<string, number> | null
}
```

**`getBookingData()` SELECT절에 `service_priority`, `assign_type` 추가**

**신규 함수:**
```ts
export async function autoAssignGroomer(
  date: string,         // "YYYY-MM-DD" KST
  startTime: string,    // "HH:MM"
  durationMin: number,
  service: string | null,
): Promise<string | null>
```

**로직:**
1. `date`의 KST 자정을 UTC로 변환 → `getUTCDay()`로 dow 계산 (MonthlyView 버그 패턴 회피)
2. `isClosedDow(dow)` → 즉시 `null` 반환
3. supabase에서 staff(active, role='groomer') 전체 조회
4. 같은 날 모든 active appointments(`start_at` 범위로 필터, deleted_at IS NULL) 조회
5. (있다면) `staff_off` 테이블 조회 — 해당 일자에 근무 제외된 staff 제거
   - 테이블이 없으면 이 단계 skip (마이그레이션 추가 X)
6. 시간 충돌 필터링 — 신규 `[startMs, endMs)`와 겹치는 예약이 있는 staff 제외
   - 겹침 식: `newStart < existEnd && existStart < newEnd` (BookingInput.checkConflictThen과 동일)
7. 후보군에서 정렬:
   - 1순위: `service_priority[service]` 오름차순 (값 없으면 +Infinity)
   - 2순위: 그날 예약 개수 오름차순
   - 3순위: `display_order` 오름차순 (안정적 tiebreaker)
8. 후보 없으면 `null`

### staff_off 처리
- Explore 결과에 staff_off 언급은 없음. 현재 스키마에 없을 가능성 높음.
- 첫 구현은 staff_off 조회 생략. 추후 별도 PR.

---

## 4. 파서 출력에 `unassigned` 노출

### `src/lib/booking/parser.ts` 수정
- `ParsedAppointment` 타입에 `unassigned: boolean` 필드 추가
- `parseBookingInput` 내부에서 이미 `unaRes.unassigned` 계산 중 → 그대로 export

이유: BookingInput에서 "이름 누락"과 "지정없음 명시"를 구분 없이 모두 autoAssign 호출하기로 했지만, 이후 분기/로깅을 위해 명시적 필드가 있으면 유리.

---

## 5. BookingInput.tsx 통합

`processLine()` 내부, `findStaffId(appt.staff)` 호출 직후:

```ts
let staffId = findStaffId(appt.staff)
let assignType: 'fixed' | 'random' = 'fixed'

if (staffId === null) {
  // 미용사 미지정/지정없음 → 자동 배정 시도
  const autoId = await autoAssignGroomer(
    targetDate,
    appt.time,
    appt.duration,
    appt.service ?? null,
  )
  if (autoId) {
    staffId = autoId
    assignType = 'random'
  }
  // autoId가 null이면 staffId=null, assignType='fixed' 유지 (기존 미배정 동작)
}
```

`createAppointment` 호출 시 `assign_type: assignType` 추가.

`createAppointment(input)` 내부에서 insert 시 `assign_type`을 받도록 `AppointmentInput` 확장:
```ts
export type AppointmentInput = {
  // ... 기존 필드
  assign_type?: 'fixed' | 'random'
}
```

---

## 6. 시각 구분 — AppointmentBlock

### `src/components/booking/AppointmentBlock.tsx` 수정

기존 분기:
- `unassigned === true` (staff_id null): 베이지 + 점선 (기존 유지)
- `unassigned === false`: signature_color 채움 (기존 유지)

추가 분기 — `assign_type === 'random'` (이때 staff_id는 항상 존재):
```tsx
const isRandom = appointment.assign_type === 'random'

const blockStyle: React.CSSProperties = unassigned
  ? { background: '#F0EDE8', border: '1px dashed #888888', color: '#1A1A1A' }
  : isRandom
  ? {
      background: color,
      opacity: 0.7,
      border: `1.5px dotted ${color}`,
      color: '#FFFFFF',
    }
  : { background: color, border: 'none', color: '#FFFFFF' }
```

라벨 추가 (블록 내부 첫 줄 옆에):
```tsx
{isRandom && (
  <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.85 }}>자동</span>
)}
```

### `TimelineGrid.tsx`
- `Appointment` 타입에 `assign_type` 이미 포함되므로 prop 전달은 자동.
- 별도 수정 없음.

---

## 7. 검증 (preview 워크플로)

1. `preview_start` 후 `/admin/booking` 진입
2. SQL로 임의 staff에 `service_priority='{"목욕":1, "미용":2}'` 세팅
3. 입력 테스트:
   - `"내일 11시 코코 푸들 목욕"` (미용사 누락) → 자동 배정 → 점선 + "자동" 라벨
   - `"내일 11시 코코 푸들 목욕 김민지"` → fixed → 기존 스타일
   - `"내일 11시 지정없음 코코 목욕"` → 자동 배정 → 점선
   - 모든 미용사 꽉 찬 시간 → 미배정(베이지) 표시
4. preview_screenshot으로 시각 결과 확인

---

## 작업 순서
1. constants.ts 생성 + MonthlyView/actions.ts 리팩토링
2. 마이그레이션 SQL 2개 작성
3. actions.ts 타입 확장 + autoAssignGroomer 함수 추가
4. parser.ts에 unassigned 필드 노출
5. BookingInput.tsx에 자동 배정 분기 추가
6. AppointmentBlock.tsx 시각 구분 추가
7. preview로 시나리오 검증

---

## 영향받는 파일
- 신규: `supabase/migrations/20260510_staff_service_priority.sql`
- 신규: `supabase/migrations/20260510_appointments_assign_type.sql`
- 신규: `src/lib/booking/constants.ts`
- 수정: `src/lib/booking/actions.ts`
- 수정: `src/lib/booking/parser.ts`
- 수정: `src/components/booking/BookingInput.tsx`
- 수정: `src/components/booking/AppointmentBlock.tsx`
- 수정: `src/components/booking/MonthlyView.tsx` (CLOSED_DOWS 사용)
