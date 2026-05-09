-- appointments.service 컬럼 추가
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS service TEXT;
