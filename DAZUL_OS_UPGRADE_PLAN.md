# DAZUL OS 업그레이드 계획서

> 작성일: 2026-03-28
> 목표: 단일 매장 방문 기록 앱 → 지점 확장 가능한 DAZUL 그루밍 운영 시스템

---

## 1. 현재 구조 요약

### 현재 파일 트리

```
src/
├── app/
│   ├── layout.tsx          ← 유지
│   ├── page.tsx            ← 유지 (홈)
│   ├── globals.css         ← 유지
│   └── record/
│       ├── actions.ts      ← 확장 필요
│       ├── page.tsx        ← 유지 후 grooming_sessions로 점진 마이그레이션
│       └── new/
│           └── page.tsx    ← 유지 후 신규 폼으로 점진 마이그레이션
└── lib/
    └── supabase.ts         ← 유지
```

### 현재 Supabase 테이블

| 테이블 | 상태 |
|--------|------|
| `visit_records` | 운영 중 — 유지하되 신규 스키마로 점진 이전 |

### 현재 없는 것

- 타입 파일 (`types.ts`) 없음
- 보호자/반려동물 전용 페이지 없음
- 히스토리 페이지 없음
- 지점(branch) 개념 없음

---

## 2. 목표 DB 스키마 (신규 추가 대상)

### 추가할 테이블 목록

```
branches              ← 지점 정보
staff                 ← 직원 (지점 소속)
pets                  ← 반려동물 프로필
guardians             ← 보호자 정보
products              ← 사용 제품 목록
grooming_sessions     ← 핵심: 기존 visit_records를 대체
session_health_checks ← 세션별 피부/건강 체크
session_products      ← 세션에서 사용한 제품
session_notes         ← 세션 케어 메모
session_photos        ← 세션 사진 (추후 구현)
ai_comments           ← AI 케어 코멘트 (추후 구현)
```

### 각 테이블 컬럼 계획

#### `branches`
```sql
id            uuid PK
name          text        -- 예: "다줄 본점", "다줄 강남점"
address       text
phone         text
created_at    timestamptz
```

#### `staff`
```sql
id            uuid PK
branch_id     uuid FK → branches.id
name          text
role          text        -- 예: "그루머", "리셉션"
is_active     boolean
created_at    timestamptz
```

#### `guardians`
```sql
id            uuid PK
branch_id     uuid FK → branches.id
name          text
phone         text
memo          text
created_at    timestamptz
```

#### `pets`
```sql
id            uuid PK
guardian_id   uuid FK → guardians.id
branch_id     uuid FK → branches.id
name          text
breed         text
birth_year    int
gender        text        -- 'M' | 'F'
neutered      boolean
created_at    timestamptz
```

#### `products`
```sql
id            uuid PK
branch_id     uuid FK → branches.id
name          text
category      text        -- 예: "샴푸", "컨디셔너", "향수"
is_active     boolean
created_at    timestamptz
```

#### `grooming_sessions`
```sql
id            uuid PK
branch_id     uuid FK → branches.id
pet_id        uuid FK → pets.id
staff_id      uuid FK → staff.id
session_date  date
services      text[]      -- 예: ["목욕", "미용"]
status        text        -- 'draft' | 'completed'
created_at    timestamptz
```

#### `session_health_checks`
```sql
id            uuid PK
session_id    uuid FK → grooming_sessions.id
skin_status   text
coat_status   text
ear_status    text
nail_status   text
memo          text
created_at    timestamptz
```

#### `session_products`
```sql
id            uuid PK
session_id    uuid FK → grooming_sessions.id
product_id    uuid FK → products.id
amount        text
created_at    timestamptz
```

#### `session_notes`
```sql
id            uuid PK
session_id    uuid FK → grooming_sessions.id
note_type     text        -- 'care' | 'recommendation' | 'special'
content       text
created_at    timestamptz
```

#### `session_photos`
```sql
id            uuid PK
session_id    uuid FK → grooming_sessions.id
storage_path  text
caption       text
created_at    timestamptz
```
> ⚠️ 사진 업로드는 추후 구현 — 지금은 테이블만 설계

#### `ai_comments`
```sql
id            uuid PK
session_id    uuid FK → grooming_sessions.id
content       text
generated_at  timestamptz
```
> ⚠️ AI 코멘트는 추후 구현 — 지금은 테이블만 설계

---

## 3. 현재 파일별 처리 방침

| 파일 | 처리 방침 | 이유 |
|------|-----------|------|
| `src/lib/supabase.ts` | **유지** | 클라이언트 설정 정상 |
| `src/app/page.tsx` | **유지** | 홈 화면 정상 |
| `src/app/layout.tsx` | **유지** | 레이아웃 정상 |
| `src/app/globals.css` | **유지** | Tailwind 설정 정상 |
| `src/app/record/page.tsx` | **유지 → 점진 이전** | `visit_records` 조회 중 → 신규 스키마 안정 후 `grooming_sessions`로 전환 |
| `src/app/record/new/page.tsx` | **유지 → 점진 이전** | 폼 정상 동작 중 → 신규 폼 완성 후 교체 |
| `src/app/record/actions.ts` | **유지 → 확장** | 서버 액션 재사용 가능 → 신규 액션 추가 |

---

## 4. 신규 추가할 파일/페이지

### 타입 파일
```
src/types/
└── index.ts              ← Branch, Staff, Pet, Guardian, GroomingSession 등 공통 타입
```

### 신규 페이지 구조
```
src/app/
├── sessions/
│   ├── page.tsx          ← 세션 목록 (grooming_sessions 기반)
│   ├── new/
│   │   └── page.tsx      ← 신규 세션 작성 폼 (pet 선택 → 서비스 → 피부체크 → 메모)
│   └── [id]/
│       └── page.tsx      ← 세션 상세 보기
├── pets/
│   ├── page.tsx          ← 반려동물 목록
│   ├── new/
│   │   └── page.tsx      ← 반려동물 등록
│   └── [id]/
│       ├── page.tsx      ← 반려동물 상세 + 히스토리
│       └── report/
│           └── page.tsx  ← 보호자 리포트 (인쇄/공유용)
├── guardians/
│   ├── page.tsx          ← 보호자 목록
│   └── [id]/
│       └── page.tsx      ← 보호자 상세 + 반려동물 목록
└── admin/                ← (추후) 지점/직원 관리
    ├── branches/
    └── staff/
```

### 신규 서버 액션
```
src/app/sessions/actions.ts     ← createSession, updateSession
src/app/pets/actions.ts         ← createPet, updatePet
src/app/guardians/actions.ts    ← createGuardian, updateGuardian
```

### 신규 컴포넌트
```
src/components/
├── ui/
│   ├── ChipGroup.tsx       ← 현재 폼에서 인라인 정의된 것을 공통화
│   ├── Section.tsx
│   └── Field.tsx
├── SessionCard.tsx         ← 세션 목록 카드
├── PetCard.tsx             ← 반려동물 카드
└── GuardianCard.tsx        ← 보호자 카드
```

---

## 5. `visit_records` → `grooming_sessions` 마이그레이션 매핑

| 기존 `visit_records` 컬럼 | 신규 위치 | 비고 |
|--------------------------|-----------|------|
| `id` | `grooming_sessions.id` | |
| `visit_date` | `grooming_sessions.session_date` | |
| `pet_name` | `pets.name` (FK로 연결) | 기존 텍스트 → 정규화 필요 |
| `staff_name` | `staff.name` (FK로 연결) | 기존 텍스트 → 정규화 필요 |
| `service` | `grooming_sessions.services` | 단일 text → text[] |
| `skin_status` | `session_health_checks.skin_status` | 별도 테이블로 분리 |
| `note` | `session_notes` (note_type='care') | |
| `next_visit_recommendation` | `session_notes` (note_type='recommendation') | |
| `special_notes` | `session_notes` (note_type='special') | |

> ⚠️ 마이그레이션 시 `pet_name` / `staff_name` 텍스트를 `pets` / `staff` 테이블 레코드로 변환하는 스크립트가 필요합니다.

---

## 6. Supabase 대시보드에서 수동 작업이 필요한 항목

아래 작업은 코드가 아닌 **Supabase 대시보드 또는 SQL Editor**에서 직접 진행해야 합니다.

| 작업 | 위치 | 우선순위 |
|------|------|---------|
| 신규 테이블 8개 생성 | SQL Editor | 🔴 높음 |
| `branch_id` 기본값 설정 (단일 지점 운영 중) | SQL Editor | 🔴 높음 |
| Row Level Security (RLS) 정책 설정 | Authentication → Policies | 🟡 중간 |
| `visit_records` 기존 데이터 마이그레이션 스크립트 실행 | SQL Editor | 🟡 중간 |
| Storage 버킷 생성 (`session-photos`) | Storage | 🟢 낮음 (사진 기능 시) |
| `ai_comments` 관련 Edge Function 배포 | Edge Functions | 🟢 낮음 (AI 기능 시) |

---

## 7. 단계별 구현 순서 (권장)

### Phase 1 — 기반 정리 (지금 바로)
1. `src/types/index.ts` 생성
2. `src/components/ui/` 공통 컴포넌트 분리
3. Supabase에 `branches`, `staff`, `pets`, `guardians` 테이블 생성

### Phase 2 — 반려동물/보호자 등록
1. `/pets/new` 등록 폼
2. `/guardians/new` 등록 폼
3. `/pets/[id]` 상세 + 히스토리

### Phase 3 — 세션 시스템 전환
1. Supabase에 `grooming_sessions` 및 하위 테이블 생성
2. `/sessions/new` 폼 (pet 선택 → 서비스 → 피부체크 → 메모)
3. `/sessions/[id]` 상세 보기
4. 기존 `/record` 페이지를 `/sessions` 기반으로 전환

### Phase 4 — 보호자 리포트
1. `/pets/[id]/report` 인쇄용 리포트 페이지

### Phase 5 — 지점/직원 관리 (멀티 지점 시)
1. `/admin/branches`, `/admin/staff` 페이지
2. `branch_id` 기반 데이터 필터링 전면 적용

---

## 8. 주요 원칙 (개발 전 기간 유지)

- `branch_id`는 모든 신규 테이블에 포함 — 단일 지점이어도 미리 설계
- 기존 `visit_records` 테이블은 마이그레이션 완료 전까지 삭제하지 않음
- UI는 항상 모바일/태블릿 우선, 한국어, 큰 버튼 유지
- 의료적 표현 금지 (`CLAUDE.md` 규칙 준수)
- 사진 업로드, AI 코멘트는 Phase 5 이후로 미룸
