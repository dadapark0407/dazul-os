-- pets.name 검색 성능 인덱스
-- - searchPetsByQuery: ilike '%query%' → pg_trgm GIN 인덱스 필요
-- - findPetsByName:    name = '...'    → btree 인덱스 활용

-- 1) 부분 일치(ilike '%...%')를 위한 trigram 확장 + GIN 인덱스
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_pets_name_trgm
  ON pets
  USING gin (name gin_trgm_ops);

COMMENT ON INDEX idx_pets_name_trgm IS
  '고객 검색 팝업의 ilike ''%query%'' 매칭을 위한 trigram GIN 인덱스';

-- 2) 정확 일치(name = '...')용 btree 인덱스
CREATE INDEX IF NOT EXISTS idx_pets_name
  ON pets (name);

COMMENT ON INDEX idx_pets_name IS
  'findPetsByName의 name = ... 정확 일치 검색용';

-- 3) guardian_id 조인이 자주 발생하므로 함께 추가 (이미 있을 수 있음, IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_pets_guardian_id
  ON pets (guardian_id);

COMMENT ON INDEX idx_pets_guardian_id IS
  'guardians 조인 성능용';
