# DAZUL OS — 프리랜서 정산 모듈 빌드 스펙 (Claude Code 전달용) · v3.6
> v3.6 변경(인증 단순화): 미용사 인증을 **휴대폰 OTP → 이메일 매직링크**로 변경. 문자 공급자(Twilio) 설정·건당 비용·한국 발신 규제 제거. 이메일이 신원·연결 키, 링크 탭으로 로그인, 세션 무기한 유지. (전제: 미용사가 폰에서 이메일 확인 가능)
> v3.5 변경(더블 체크 영구화): 미용사 개별 기록은 **은퇴하지 않고 영구 유지**(독립 교차검증). 미래 DAZUL OS 자체 매출관리 시, 미용사 수기 기록(`manual`) ↔ native 기록(`dazul`)을 **자동 대사(reconciliation)**로 비교 → 불일치만 매장 확인. 더블 체크는 은퇴가 아니라 "수동 대조 → 자동 대사"로 업그레이드. 미래 정산 금액 기준 = native 기록, 수기 기록 = 교차검증.
> v3.4 변경(미래 구조 정정): 향후 매출관리는 **외부 POS가 아니라 DAZUL OS 자체 기능**으로 개발. 그때는 매출이 같은 DB에 native 생성되어 **수기 입력·대조 단계가 은퇴**하고 정산 엔진만 그대로 재사용. 전환 대비 `freelance_sales.source`(`manual`/`dazul`) 추가.
> v3.3 변경(정산 주기): 정산 기간 = **매월 21일 ~ 익월 20일**, **지급일 21일**(예: 6/21 지급 → 5/21~6/20). 정산 기간 기본값을 이 사이클로 설정(주기 시작일 21은 설정값으로 분리). 현재 프리랜서 **1명** — per-groomer 구조 그대로라 N명 확장 시 무변경.
> v3.2 변경(운영 주기): 미용사 **하루 약 3건 수시 입력**(단건 입력으로 충분, 대량입력 불필요) · **로그인 세션 장기 유지**(매일 재인증 X) · 매장은 **월 1회 POS 일괄 대조 → 일괄 승인 → 정산**(정산 기간 기본=직전 캘린더 월) · 미용사 화면에 "검토 대기" 카피로 월 단위 대기 정상화.
> v3.1 변경(범위 확정): 본 앱은 **POS 더블 체크용 정산 장부**. POS 연동·결제 처리는 **MVP 범위 제외**(2차). `payment_method/reference`는 결제 기능이 아니라 **수동 지급 기록**. 우선순위 6단계 정렬.
> v3(운영 모델 전환): 기본 모델을 **"미용사 직접 입력 → 매장 승인(POS 대조) → 정산"** 으로 변경.
> ① `allow_self_input` 기본 true ② 매출 승인 상태(`submitted/approved/rejected`) 추가, `settled`는 파생 ③ 매장 승인/수정/반려 ④ 정산 생성은 **approved + 미바인딩** 매출만 ⑤ 상태를 **행(승인) / 배치(확인) 2층**으로 분리.
> v2 유지: settlement_items 스냅샷, 원자적 정산 생성, 바인딩=잠금, paid 하드 잠금.

## 0. 목적
계산기가 아니라, **정산 시점의 금액을 고정하고 매장과 프리랜서가 동일한 근거를 바라보는 신뢰 가능한 정산 장부**. POS를 대체하지 않으며, POS와 **대조·승인**하는 정산 계층.

### 범위 (MVP)
**포함:** 미용사 본인 매출 입력 · 매장 POS 대조 검토 · 승인/수정/반려 · 승인분만 정산 생성 · 정산 스냅샷 고정 · 지급완료 기록.
**제외(2차):** 결제·정산금 자동 이체, 매출 자동 생성, 자동 대사(reconciliation). **향후 DAZUL OS가 매출관리를 자체 기능으로 개발하면**(외부 결제 프로그램 미사용) 매출이 같은 DB에 native 생성 → 미용사 수기 기록은 **독립 교차검증으로 영구 유지**, native 기록과 자동 대사로 비교(은퇴 아님). 정산 엔진은 그대로 재사용.
- `payment_method`/`payment_reference`는 **결제 처리가 아니라 수동 지급 기록**(예: bank_transfer + 거래번호 메모).
- 정산 생성 대상은 **반드시 매장이 POS 대조 후 승인한 매출(`approved`)만** 포함(§6에서 강제).

## 1. 운영 모델 (기본값)

```
① 미용사 본인 매출 입력 (submitted)
② 매장이 POS와 대조 → 승인 / 수정 / 반려
③ 승인된 매출만 정산 대상 (approved)
④ 정산 생성 (approved + settlement_id NULL 만 포함, 스냅샷 동결)
⑤ 미용사 확인
⑥ 매장 확인 → 정산 완료(paid) → 지급
```

- 입력 주체는 **미용사**, 정합성 책임은 **매장(POS 대조)**.
- **운영 주기:** 미용사는 수시 입력(하루 약 3건) → `submitted`로 누적. 매장은 **월 1회**(정산 주기 마감 후) 일괄 대조·승인 후 정산 생성. 매장은 매일 확인하지 않음.
- **정산 주기:** 매월 **21일 ~ 익월 20일**, **지급일 21일**. (예: 6/21 지급분 = 5/21~6/20). 주기 시작일(21)은 하드코딩하지 말고 설정값(`SETTLEMENT_CYCLE_START_DAY=21` 등)으로.
- **현재 프리랜서 1명.** per-groomer 설계라 1명으로 운영, N명 추가 시 코드 변경 없음.
- **미래 구조 (더블 체크 영구):** 미용사 개별 기록은 매출관리가 다줄OS로 들어와도 **은퇴하지 않는다**. 두 독립 기록으로 오류를 잡는 게 더블 체크의 본질이므로 영구 유지.
  - 지금: 미용사 수기 기록 ↔ 매장이 현 POS와 **수동 대조**.
  - 미래: 미용사 수기(`source='manual'`) ↔ 다줄OS native(`source='dazul'`)를 **자동 대사(reconciliation)** → 불일치 건만 매장 확인.
  - 정산 금액 기준: 미래엔 **native 기록(시스템 기록)**, 수기 기록은 그걸 검증하는 교차 체크. 현재(native 없음)는 수기 기록이 기준 + POS 대조.
  - 정산 엔진(주기·스냅샷·계산·확인·지급)은 입력 출처에 무관(input-agnostic)하게 유지 → 어느 시나리오든 그대로 재사용.
- 최종형(2차): DAZUL OS 예약/POS 데이터 자동 연동으로 대조를 자동화.

## 2. 상태 2층 분리 (핵심 구조)

| 층위 | 테이블 | 상태값 | 의미 |
|---|---|---|---|
| 행(매출) | `freelance_sales.status` | `submitted` → `approved` / `rejected` | "이 한 건이 POS와 일치하는가" (데이터 정합) |
| 배치(정산) | `freelance_settlements.status` | `draft` → `groomer_confirmed` → `store_confirmed` → `paid` / `disputed` | "이번 기간 지급액을 확정·지급하는가" (금액 사인오프) |

- **`settled`는 저장하지 않는다.** "정산됨" = `settlement_id IS NOT NULL` 로 파생. (한 사실은 한 곳에만 — settlement_id와 status가 갈라지는 불일치 방지)
- 매출 승인(approved)과 정산의 매장확인(store_confirmed)은 **다른 행위**다. 전자는 건별 정합, 후자는 기간 지급액 확정.
- (선택) 클릭 단순화가 필요하면 `store_confirmed`를 생략하고 `groomer_confirmed → paid`로 줄여도 됨. 기본은 4단계 유지.

## 3. 계산식 (반올림 규칙 포함)
> 집계는 항상 `freelance_settlement_items` 스냅샷에서 계산. 라이브 sales 재계산 금지.

```
total_amount      = Σ amount_snapshot
supply_amount     = round(total_amount / 1.1)
before_tax_amount = round(supply_amount * rate)        (rate 기본 0.60)
payout_amount     = round(before_tax_amount * 0.967)
withholding_amount = before_tax_amount - payout_amount  (양수 저장, 화면엔 음수 "차감액")
```

- 원 단위 half-up 기본(세무사 확인 후 절사 가능), 단계별 반올림으로 명세가 정확히 합산.
- 명세 표시: ① 합계 ② 공급가액 ③ 커미션 적용 ④ 원천징수 차감액(음수) ⑤ **최종 지급액**.

## 4. 테이블 (Postgres / Supabase)
> 생성 순서: groomers → settlements → sales → settlement_items → sale_logs (FK 의존성).

```sql
create table freelance_groomers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),            -- 첫 로그인 시 email 매칭으로 세팅
  name text not null,
  email text not null,                               -- 인증·연결 키(매직링크). 등록 시 필수
  phone text,                                        -- 연락처(선택)
  allow_self_input boolean not null default true,    -- 기본 입력 허용, 특정 미용사만 false로 제한
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table freelance_settlements (
  id uuid primary key default gen_random_uuid(),
  groomer_id uuid not null references freelance_groomers(id),
  period_from date not null,
  period_to date not null,
  total_amount integer,
  supply_amount integer,
  commission_rate numeric not null default 0.60,     -- 스냅샷
  before_tax_amount integer,
  withholding_amount integer,
  payout_amount integer,
  status text not null default 'draft'
    check (status in ('draft','groomer_confirmed','store_confirmed','paid','disputed')),
  dispute_reason text,
  payment_method text,                               -- 수동 지급 기록(결제 처리 아님). 예: bank_transfer
  payment_reference text,                            -- 거래번호/메모(수동 입력)
  groomer_confirmed_by uuid, groomer_confirmed_at timestamptz,
  store_confirmed_by uuid,   store_confirmed_at timestamptz,
  paid_at timestamptz,
  reopened_by uuid, reopen_reason text, reopened_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table freelance_sales (
  id uuid primary key default gen_random_uuid(),
  groomer_id uuid not null references freelance_groomers(id),
  settlement_id uuid references freelance_settlements(id),  -- 라이브 바인딩 포인터(잠금/중복방지). "정산됨"은 이 값으로 파생
  date date not null,
  breed text,
  pet_name text,
  amount integer not null check (amount >= 0),
  service_type text check (service_type in ('grooming','bath','spa','care','other')),
  source text not null default 'manual' check (source in ('manual','dazul')),  -- 미래: DAZUL OS 매출관리 native 생성 행 구분, 전환기 공존용
  memo text,
  status text not null default 'submitted'
    check (status in ('submitted','approved','rejected')),  -- 승인 라이프사이클 (settled 없음)
  reject_reason text,
  approved_by uuid, approved_at timestamptz,
  created_by uuid, updated_by uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 정산 스냅샷: 생성 시점의 줄 단위 근거를 동결
create table freelance_settlement_items (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references freelance_settlements(id) on delete cascade,
  sale_id uuid not null references freelance_sales(id),
  date_snapshot date,
  pet_name_snapshot text,
  breed_snapshot text,
  amount_snapshot integer,
  created_at timestamptz not null default now()
);

create table freelance_sale_logs (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references freelance_sales(id),
  field text not null,                 -- amount/date/pet_name/breed/status 등
  old_value text,
  new_value text,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
```

## 5. 매출 승인 라이프사이클

```
미용사 입력 ──→ submitted ──(매장 승인)──→ approved ──(정산 생성)──→ [settlement_id set = 잠금]
                  │  ▲
       (매장 반려+사유)│  │(미용사 수정 후 재제출)
                  ▼  │
               rejected ─┘
```

매장 화면 버튼: `승인` / `수정`(값 보정, 로그) / `반려`(사유 필수)
- **월말 일괄 처리:** 다건 선택 후 **일괄 승인**(한 건씩 누르지 않게). 어긋나는 건만 개별 수정·반려. 일괄 승인도 건별로 status 로그 적재.

미용사 화면 버튼: (rejected 건) `수정 후 재제출`

전환 규칙:
- `submitted → approved`: 매장만. `approved_by/at` 기록.
- `submitted → rejected`: 매장만. `reject_reason` 필수.
- `rejected → submitted`: 미용사가 값 수정 후 재제출(재제출 시 `reject_reason` 클리어, 이력은 로그에).
- `approved → submitted`: 매장이 승인 철회 가능(단 `settlement_id IS NULL`일 때만).
- 모든 status 전환은 `freelance_sale_logs`에 field='status'로 기록.

편집 권한:
- 미용사: **본인 `submitted`(또는 `rejected`) 행만** 수정/삭제. `approved` 이후 잠금.
- 매장: 바인딩 전(`settlement_id IS NULL`) 매출은 언제든 수정/반려/승인.
- 바인딩됨 또는 정산 `paid` → 양측 잠금(§7).

## 6. 정산 생성 플로우 (원자적 RPC)
`create_settlement(groomer_id, period_from, period_to)` — all-or-nothing 트랜잭션.

```
1) settlements 행 생성 (status=draft)
2) 대상 매출 조회:
   status='approved' AND settlement_id IS NULL AND deleted_at IS NULL
   AND date BETWEEN period_from AND period_to AND groomer_id=...
3) settlement_items에 줄별 스냅샷 저장
4) 스냅샷 기준 금액 계산 → settlements 집계 컬럼 확정 (§3)
5) 대상 sales.settlement_id = 이 settlement (바인딩 = 잠금)
커밋
```

- **approved 미바인딩 매출만** 포함 → 미검토/이미정산 매출 유입 차단.
- 바인딩 즉시 잠금 → 스냅샷 드리프트 방지.
- 기간 기본값 = **직전 정산 주기 (전월 21일 ~ 당월 20일)**, 지급일 21일 기준. 예: 6/21 정산 → 05-21~06-20. 시작일(21)은 설정값. 매장이 조정 가능.

## 7. 정산 상태 머신 (배치)

```
draft ─(미용사 "확인")→ groomer_confirmed ─(매장 "매장확인")→ store_confirmed ─(매장 "정산완료")→ paid
  └─(미용사 "이의 있습니다"+사유)→ disputed
paid ─(관리자 "재오픈"+사유)→ store_confirmed   // 2차
```

미용사: `정산 내역 확인했습니다` / `이의 있습니다`(사유)
매장: `매장 확인` / `정산완료 처리` / (2차) `정산 재오픈`(사유)

전환 시 `*_by`, `*_at` 기록. 정산 상세는 라이브 sales가 아니라 **settlement_items 스냅샷**을 출처로 렌더.

## 8. 수정 이력 & 잠금
- amount/date/pet_name/breed/status 변경 시 `freelance_sale_logs` 1건씩(1일차 적재, 조회 UI는 2차).
- 삭제는 soft delete(`deleted_at`) + confirm.
- 잠금 단계:
  - 매출이 정산에 **바인딩**(settlement_id 존재) → 수정/삭제 잠금.
  - 정산 `paid` → 하드 잠금.
- MVP 탈출구: `draft`/`disputed` 정산은 삭제 가능(items 캐스케이드 + 묶인 sales의 settlement_id 해제, sales는 approved 상태로 복귀해 재포함 가능). `paid`는 삭제 불가.

## 9. 권한 (RLS 요약)
- 미용사(이메일 매직링크, `auth.users.email`↔`freelance_groomers.email`로 매칭→`user_id`):
  - **로그인 세션 무기한 유지**(refresh 토큰 자동 갱신, persistSession) — 한 번 링크로 로그인 후 재인증 불필요.
  - 본인 `groomer_id` 행만 select.
  - insert: `allow_self_input=true`인 본인 건만(상태 submitted로).
  - update/delete: 본인 `submitted`/`rejected` + `settlement_id IS NULL` 행만.
  - 본인 정산 행의 confirm/dispute status 전환(RPC).
- 매장 관리자(기존 역할 체계, `is_store_admin(uid)`):
  - 전체 select, 매출 CRUD, 승인/반려, 정산 생성/상태전환.
- 헬퍼: `is_store_admin(uid)`, `current_groomer_id()`.

## 10. UI/UX
- 토큰 유지: `#FFFFFF`, `#FAFAF8`, Gold `#C9A96E`, Black `#1A1A1A`, **border-radius 0**.
- 모바일 카드형, 천 단위 콤마, 빈값/음수 방지, 기간 밖 흐림 유지, 정산 명세 블랙 배경, 원천징수 음수 "차감액".
- 매출 행에 상태 배지(`제출됨`/`승인`/`반려`) + "수정됨"/최근 수정일(`updated_at`).
- 반려 건은 사유 노출 + 미용사 재제출 동선.
- **매장 월말 검토 화면:** 미용사/기간별 목록 + 다건 선택 일괄 승인 + POS 대조 보조(합계 표시). 검토 후 바로 "이 달 정산 생성" 동선.
- **미용사 대기 카피:** `submitted`가 몇 주 유지되는 게 정상이므로 "검토 대기 · 매장 월말 확인 예정"처럼 안내(불안 방지).
- 단건 입력 최적화: 저장 시 입력칸 초기화 + 날짜 자동 유지로 연속 추가가 매끄럽게(하루 3건 수준).

## 11. 빌드 순서 (보안 척추 먼저)
**1차 MVP** (보안 골격 먼저 → 우선순위 6단계)
0. 테이블 + RLS + 미용사 이메일 매직링크 인증 (보안 척추)
1. **미용사 본인 매출 입력** (submitted) + 본인 조회/수정(submitted·rejected 한정)
2. **매장 POS 대조용 검토 화면** (기간/미용사별 목록 + 상태 배지)
3. **승인 / 수정 / 반려**(사유)
4. **승인분만 정산 생성** — 원자적 RPC(`approved` + 미바인딩만) + 자동 계산
5. **정산 스냅샷 고정** (settlement_items + 집계 동결, 바인딩=잠금)
6. **지급완료 기록** (정산 상태 머신 + 미용사 확인 + paid + 수동 지급정보)

**2차**
- 수정 이력 상세 UI, 이의 흐름 고도화, 관리자 재오픈
- PDF/엑셀, 월별 리포트, service_type별 매출 분석
- DAZUL OS 자체 매출관리 개발 시: native 매출 생성(`source='dazul'`) → 미용사 수기(`manual`)와 **자동 대사(reconciliation)**, 불일치만 매장 확인. 수기 기록은 영구 교차검증으로 유지, 정산 엔진은 그대로.
- CFO 월간 보고 연결

## 12. 즉시 고칠 프로토타입 포인트
- `disabled={role === "groomer" ? false : false}` → 본인 외 선택 불가(실차단은 RLS).
- `useState(SEED)` → Supabase fetch/insert/update/delete.
- `canEdit` → 역할 + 매출 status(submitted만 미용사 편집) + 바인딩/paid 상태로 연결.
- 원천징수를 "차감액" / "최종 지급액"으로 분리.
- 즉시 삭제 → confirm + soft delete.

## 13. 세무 확인
3.3% 원천징수·매장 부가세(사업소득 구조) 및 반올림 방향은 세무사 확인 후 확정.
