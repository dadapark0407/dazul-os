-- =============================================================
-- DAZUL OS — 예약 조회 쿼리 성능 인덱스
-- =============================================================
-- getBookingData / getMonthlyData / autoAssignGroomer에서
-- start_at 범위 + deleted_at NULL 필터, staff_id 조합 조회 가속.
--
-- 기존 idx_appointments_date / idx_appointments_staff 는 그대로 둠.
-- 본 마이그레이션은 부분 인덱스 + 복합 인덱스로 추가 가속.
-- =============================================================


-- 1) start_at 부분 인덱스 — soft-deleted 제외
-- getBookingData/getMonthlyData가 항상 `deleted_at IS NULL`을 같이 검사하므로
-- 부분 인덱스가 일반 인덱스보다 훨씬 작고 빠름.
CREATE INDEX IF NOT EXISTS idx_appointments_start_at_active
  ON appointments (start_at)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_appointments_start_at_active IS
  '일/월 예약 조회: start_at 범위 + deleted_at NULL 부분 인덱스';


-- 2) (staff_id, start_at) 복합 부분 인덱스
-- autoAssignGroomer / 충돌 체크에서 "특정 staff의 특정 시간 예약" 조회 가속.
CREATE INDEX IF NOT EXISTS idx_appointments_staff_start_active
  ON appointments (staff_id, start_at)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_appointments_staff_start_active IS
  'autoAssignGroomer/충돌 체크: 특정 staff의 시간 범위 조회 가속';


-- 3) staff(is_active, display_order) 복합 인덱스
-- 거의 모든 페이지에서 `is_active=true ORDER BY display_order` 조회.
-- staff는 작은 테이블이지만 매 페이지 로드마다 호출되므로 추가.
CREATE INDEX IF NOT EXISTS idx_staff_active_order
  ON staff (is_active, display_order)
  WHERE is_active = true;

COMMENT ON INDEX idx_staff_active_order IS
  'staff 활성 직원 목록 + display_order 정렬용';
