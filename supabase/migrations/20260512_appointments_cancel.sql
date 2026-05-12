-- =============================================================
-- DAZUL OS — 예약 취소 컬럼
-- =============================================================
-- status는 booking_system.sql에서 이미 존재 (default 'confirmed').
--   확장 값: 'cancelled', 'noshow'
-- cancel_reason / cancelled_at 추가.

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at  TIMESTAMPTZ;
