'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

// ─── 다국어 ───
type Lang = 'ko' | 'en' | 'ja'

const T: Record<Lang, Record<string, string>> = {
  ko: {
    good: '정상', attention: '주의',
    bath: '목욕관리', fullGrooming: '전체미용',
    basic: '베이직 코스', essential: '✨ 에센셜 스파 코스', signature: '💎 시그니처 팩 코스', prestige: '👑 프레스티지 풀 케어 코스',
    nextVisit: '다음 방문 추천', inWeeks: '약 {n}주 후',
    copyLink: '링크 복사', copied: '복사됨 ✓',
    kakao: '카카오톡 문의', call: '전화 예약',
    all: '전체',
  },
  en: {
    good: 'Good', attention: 'Attention',
    bath: 'Bath & Care', fullGrooming: 'Full Grooming',
    basic: 'Basic', essential: 'Essential', signature: 'Signature', prestige: 'Prestige',
    nextVisit: 'Next Visit', inWeeks: 'in {n} weeks',
    copyLink: 'Copy Link', copied: 'Copied ✓',
    kakao: 'Book via KakaoTalk', call: 'Call to Book',
    all: 'All',
  },
  ja: {
    good: '良好', attention: '注意',
    bath: 'バス＆ケア', fullGrooming: 'フルグルーミング',
    basic: 'ベーシック', essential: 'エッセンシャル', signature: 'シグネチャー', prestige: 'プレステージ',
    nextVisit: '次回来店', inWeeks: '{n}週間後',
    copyLink: 'リンクをコピー', copied: 'コピー済み ✓',
    kakao: 'カカオで予約', call: 'お電話で予約',
    all: '全体',
  },
}

function useLang(): [Lang, (l: Lang) => void] {
  const searchParams = useSearchParams()
  const router = useRouter()
  const raw = searchParams.get('lang')
  const lang: Lang = raw === 'en' || raw === 'ja' ? raw : 'ko'

  function setLang(l: Lang) {
    const url = new URL(window.location.href)
    if (l === 'ko') url.searchParams.delete('lang')
    else url.searchParams.set('lang', l)
    router.replace(url.pathname + url.search, { scroll: false })
  }

  return [lang, setLang]
}

function tSvc(svc: string, lang: Lang): string {
  const t = T[lang]
  if (svc === '목욕관리') return t.bath
  if (svc === '전체미용') return t.fullGrooming
  return svc
}

function tSpa(key: string, lang: Lang): string {
  const map: Record<string, keyof typeof T.ko> = {
    basic: 'basic', premium: 'essential', essential: 'essential',
    deep: 'signature', signature: 'signature', prestige: 'prestige',
  }
  return T[lang][map[key] ?? 'basic'] ?? key
}

// ─── 타입 ───
type Pet = { id: string; name: string; breed: string | null }
type Rec = {
  id: number | string
  pet_id: string | null
  pet_name: string | null
  visit_date: string | null
  weight: number | string | null
  service: string | null
  service_type: string | null
  spa_level: string | null
  skin_status: string | null
  coat_status: string | null
  condition_status: string | null
  care_actions: string | null
  next_care_guide: string | null
  next_visit_date: string | null
  next_visit_recommendation: string | null
  comment: string | null
}

// ─── 팔레트 ───
const C = {
  bg: '#FAFAF8',
  card: '#FFFFFF',
  text: '#1A1A1A',
  sub: '#8A8A7A',
  gold: '#C9A96E',
  border: '#E8E5E0',
  line: '#F0EDE8',
  cream: '#FDFBF7',
}

const SPA: { [k: string]: { label: string; desc: string } } = {
  basic: { label: '베이직', desc: '기본 클렌징' },
  premium: { label: '에센셜', desc: '딥클렌징 & 보습' },
  essential: { label: '에센셜', desc: '딥클렌징 & 보습' },
  deep: { label: '시그니처', desc: '전신 영양 트리트먼트' },
  signature: { label: '시그니처', desc: '전신 영양 트리트먼트' },
  prestige: { label: '프레스티지', desc: '프리미엄 맞춤 풀케어' },
}

// ─── 유틸 ───
function fmtDate(v: string | null): string {
  if (!v) return ''
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

function fmtShort(v: string | null): string {
  if (!v) return ''
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function weeksFrom(v: string): string {
  const diff = new Date(v).getTime() - Date.now()
  if (diff <= 0) return ''
  return `약 ${Math.ceil(diff / (7 * 24 * 60 * 60 * 1000))}주 후`
}

function parseCond(s: string | null): { [k: string]: string } {
  const r: { [k: string]: string } = {}
  if (!s) return r
  for (const p of s.split('/').map((x) => x.trim())) {
    if (p.startsWith('눈:')) r.eyes = p.slice(2).trim()
    else if (p.startsWith('귀:')) r.ears = p.slice(2).trim()
    else if (p.startsWith('치아:')) r.teeth = p.slice(3).trim()
    else if (p.startsWith('발톱:')) r.nail = p.slice(3).trim()
  }
  return r
}

function isIssue(v: string | null): boolean {
  if (!v) return false
  return !['좋음', '깨끗함', '없음', '적당함', '양호'].some((g) => v.includes(g))
}

// ─── 섹션 헤더 ───
const SH = ({ children }: { children: string }) => (
  <p style={{ fontSize: 10, letterSpacing: '0.1em', fontWeight: 400, color: C.sub, textTransform: 'uppercase' as const, marginBottom: 16 }}>
    {children}
  </p>
)

// ─── 기록 카드 ───
function RecordCard({ rec, expanded, onToggle, lang, productSummaryMap, productCategoryMap }: { rec: Rec; expanded: boolean; onToggle: () => void; lang: Lang; productSummaryMap: Record<string, string>; productCategoryMap: Record<string, string> }) {
  const rawSvc = rec.service ?? rec.service_type ?? null
  const svc = rawSvc ? tSvc(rawSvc, lang) : null
  const spa = rec.spa_level ? { ...SPA[rec.spa_level], label: tSpa(rec.spa_level, lang) } : null
  const cond = parseCond(rec.condition_status)
  // 엉킴 라벨 중복 제거: '엉킴: 겨드랑이' → '겨드랑이'
  const coatValue = rec.coat_status
    ? rec.coat_status.replace(/^\s*엉킴\s*:\s*/, '').trim() || null
    : null
  // 6개 행 항상 표시 — 값 없으면 '깨끗함'으로 기본 표시
  const bodyItems = [
    { label: '피부', value: rec.skin_status || '깨끗함' },
    { label: '엉킴', value: coatValue || '깨끗함' },
    { label: '눈', value: cond.eyes || '깨끗함' },
    { label: '귀', value: cond.ears || '깨끗함' },
    { label: '치아', value: cond.teeth || '깨끗함' },
    { label: '발톱', value: cond.nail || '깨끗함' },
  ]

  const tips = rec.next_care_guide
    ? rec.next_care_guide.split('\n').map((s) => s.trim()).filter(Boolean)
    : []

  const nextDate = rec.next_visit_date ? fmtDate(rec.next_visit_date) : null
  const nextWeeksN = rec.next_visit_date ? Math.ceil((new Date(rec.next_visit_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)) : 0
  const nextWeeks = nextWeeksN > 0 ? T[lang].inWeeks.replace('{n}', String(nextWeeksN)) : ''
  const weight = rec.weight ? `${rec.weight}kg` : null

  // care_actions 파싱 → 카테고리별 그룹
  type ProductItem = { label: string; summary: string | null }
  const productItems = (rec.care_actions ?? '')
    .split(',')
    .map((raw) => raw.trim())
    .filter(Boolean)
  const productsByCat: Record<string, ProductItem[]> = {}
  for (const label of productItems) {
    const productName = label.replace(/\s*\([^)]*\)\s*$/, '').trim()
    const cat = productCategoryMap[productName] || '기타'
    const summary = productSummaryMap[productName] || null
    if (!productsByCat[cat]) productsByCat[cat] = []
    productsByCat[cat].push({ label, summary })
  }

  return (
    <div style={{ background: C.card, borderTop: `1px solid ${C.border}` }}>
      {/* 날짜 헤더 */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div>
          <p style={{ fontSize: 13, fontWeight: 400, color: C.text, letterSpacing: '0.08em' }}>
            {fmtShort(rec.visit_date)}
          </p>
          <p style={{ fontSize: 11, color: C.sub, marginTop: 4, letterSpacing: '0.05em' }}>
            {[svc, spa ? spa.label : null, weight].filter(Boolean).join('  ·  ')}
          </p>
        </div>
        <span style={{ fontSize: 8, color: C.gold, transition: 'transform 0.3s ease', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
      </button>

      {/* 상세 */}
      {expanded && (
        <div style={{ padding: '0 20px 28px' }}>
          <div style={{ height: 1, background: C.line, marginBottom: 24 }} />

          {/* SERVICE */}
          {svc && (
            <div style={{ marginBottom: 28 }}>
              <SH>Service</SH>
              <p style={{ fontSize: 15, fontWeight: 300, color: C.text, letterSpacing: '0.03em' }}>
                {svc}
              </p>
              {spa && (
                <div
                  style={{
                    marginTop: 12,
                    padding: '14px 16px',
                    background: C.cream,
                    border: `1px solid ${C.gold}`,
                    borderLeft: `3px solid ${C.gold}`,
                  }}
                >
                  <p
                    style={{
                      fontSize: 12,
                      color: C.gold,
                      letterSpacing: '0.15em',
                      fontWeight: 500,
                    }}
                  >
                    {spa.label}
                  </p>
                  {spa.desc && (
                    <p style={{ fontSize: 11, color: C.sub, marginTop: 4, letterSpacing: '0.02em' }}>
                      {spa.desc}
                    </p>
                  )}
                  {/* 스파코스에서 사용한 제품 — 스파/팩 카테고리 제품 */}
                  {(() => {
                    const spaList = productsByCat['스파'] ?? []
                    const packList = productsByCat['팩'] ?? []
                    if (spaList.length === 0 && packList.length === 0) return null
                    return (
                      <div
                        style={{
                          marginTop: 12,
                          paddingTop: 12,
                          borderTop: `1px solid ${C.border}`,
                        }}
                      >
                        {[
                          { label: '스파', items: spaList },
                          { label: '팩', items: packList },
                        ].map(({ label, items }) => {
                          if (items.length === 0) return null
                          return (
                            <div key={label} style={{ display: 'flex', alignItems: 'baseline', padding: '4px 0' }}>
                              <span style={{ width: 44, fontSize: 11, color: C.sub, flexShrink: 0, letterSpacing: '0.05em' }}>
                                {label}
                              </span>
                              <div style={{ flex: 1 }}>
                                {items.map((p, i) => (
                                  <p
                                    key={i}
                                    style={{
                                      fontSize: 12,
                                      color: C.gold,
                                      lineHeight: 1.7,
                                      marginBottom: i < items.length - 1 ? 2 : 0,
                                    }}
                                  >
                                    {p.label}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              )}
              {/* 몸무게는 헤더 날짜 옆에만 표시 (중복 제거) */}
            </div>
          )}

          {/* PRODUCTS — 카테고리별 표시 (스파/팩은 SERVICE 카드 내부에 표시됨) */}
          {(() => {
            const grouped = productsByCat

            // 표시 규칙:
            // 항상 표시 (빈 경우 '—'): 샴푸, 린스
            // 값 있을 때만 표시: 피부케어, 피모케어, 위생관리, 기타
            const ALWAYS = ['샴푸', '린스']
            const ON_VALUE = ['피부케어', '피모케어', '위생관리', '기타']

            const orderedCats: string[] = []
            for (const c of ALWAYS) orderedCats.push(c)
            for (const c of ON_VALUE) {
              if ((grouped[c]?.length ?? 0) > 0) orderedCats.push(c)
            }

            if (orderedCats.length === 0) return null

            return (
              <div style={{ marginBottom: 28 }}>
                <SH>Products</SH>
                {orderedCats.map((cat) => {
                  const list = grouped[cat] ?? []
                  return (
                    <div key={cat} style={{ padding: '10px 0', borderBottom: `1px solid ${C.line}` }}>
                      <div className="flex items-baseline">
                        <span style={{ minWidth: 60, fontSize: 13, color: '#8A8A7A', letterSpacing: '0.05em', flexShrink: 0 }}>
                          {cat}
                        </span>
                        <div style={{ flex: 1 }}>
                          {list.length === 0 ? (
                            <span style={{ fontSize: 13, color: '#D0D0D0' }}>—</span>
                          ) : (
                            list.map((p, i) => (
                              <div key={i} style={{ marginBottom: i < list.length - 1 ? 6 : 0 }}>
                                <p style={{ fontSize: 13, color: C.text, lineHeight: 1.6, fontWeight: 400 }}>{p.label}</p>
                                {p.summary && (
                                  <p style={{ fontSize: 11, color: C.sub, lineHeight: 1.6, fontWeight: 300, marginTop: 2 }}>
                                    {p.summary}
                                  </p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* CONDITION — 6개 항목 항상 표시, 색상 통일 */}
          <div style={{ marginBottom: 28 }}>
            <SH>Condition</SH>
            {bodyItems.map((item) => (
              <div
                key={item.label}
                className="flex items-baseline"
                style={{ padding: '10px 0', borderBottom: `1px solid ${C.line}` }}
              >
                <span style={{ minWidth: 60, fontSize: 13, color: '#8A8A7A', letterSpacing: '0.05em', textTransform: 'uppercase' as const, flexShrink: 0 }}>
                  {item.label}
                </span>
                <span style={{
                  fontSize: 13,
                  color: C.text,
                  fontWeight: 300,
                  lineHeight: 1.7,
                }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          {/* HOME CARE */}
          {tips.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <SH>Home Care</SH>
              {tips.map((tip, i) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: `1px solid ${C.line}`, display: 'flex', gap: 10 }}>
                  <span style={{ color: C.gold, fontSize: 13, flexShrink: 0 }}>—</span>
                  <p style={{ fontSize: 13, color: C.text, lineHeight: 1.8, fontWeight: 300 }}>{tip}</p>
                </div>
              ))}
            </div>
          )}

          {/* NEXT VISIT */}
          {(nextDate || rec.next_visit_recommendation) && (
            <div style={{ marginBottom: 32, padding: '28px 0', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, textAlign: 'center' }}>
              <SH>Next Visit</SH>
              {nextDate && (
                <p style={{ fontSize: 24, fontWeight: 300, color: C.text, letterSpacing: '0.06em' }}>
                  {nextDate}
                </p>
              )}
              {nextWeeks && (
                <p style={{ fontSize: 10, color: C.sub, marginTop: 8, letterSpacing: '0.15em' }}>{nextWeeks}</p>
              )}
              {!nextDate && rec.next_visit_recommendation && (
                <p style={{ fontSize: 13, color: C.text, fontWeight: 300, lineHeight: 2 }}>{rec.next_visit_recommendation}</p>
              )}
            </div>
          )}

          {/* MESSAGE */}
          {rec.comment && (
            <div style={{ padding: '24px', background: C.cream, marginTop: 8 }}>
              <SH>Message</SH>
              <p style={{ fontSize: 13, color: C.text, lineHeight: 2, whiteSpace: 'pre-wrap', fontWeight: 300 }}>
                {rec.comment}
              </p>
              <div
                style={{
                  textAlign: 'center',
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: '1px solid #E8E5E0',
                  fontSize: 11,
                  color: '#8A8A7A',
                  lineHeight: 2,
                }}
              >
                <p>소중한 가족을 믿고 맡겨주셔서 감사드리며,</p>
                <p>앞으로도 최선을 다하겠습니다.</p>
                <p style={{ color: '#C9A96E', letterSpacing: '0.15em', marginTop: 8 }}>— 살롱드다줄 —</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 메인 ───
export default function ReportClient({
  guardianName,
  pets,
  records,
  productSummaryMap = {},
  productCategoryMap = {},
}: {
  guardianName: string | null
  pets: Pet[]
  records: Rec[]
  productSummaryMap?: Record<string, string>
  productCategoryMap?: Record<string, string>
}) {
  const [lang, setLang] = useLang()
  // 선택된 반려견 — 기본: 최신 레코드의 pet_id (가장 최근 방문한 아이)
  const [activePetId, setActivePetId] = useState<string | null>(records[0]?.pet_id ?? null)
  const [expandedId, setExpandedId] = useState<string | number | null>(records[0]?.id ?? null)
  const [showPast, setShowPast] = useState(false)

  // 선택된 반려견 기준으로 필터 (pet_id 없는 레코드는 전체 노출)
  const filtered = activePetId
    ? records.filter((r) => r.pet_id === activePetId)
    : records
  const latest = filtered[0]
  const past = filtered.slice(1)
  const currentPet = pets.find((p) => p.id === activePetId)
  const petName = currentPet?.name ?? latest?.pet_name ?? '반려견'

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 80 }}>

      {/* ═══ 헤더 ═══ */}
      <header style={{ background: C.cream, position: 'relative', borderBottom: `1px solid ${C.gold}` }}>
        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* 언어 전환 */}
          {(['KO', 'EN', 'JA'] as const).map((l) => {
            const key = l.toLowerCase() as Lang
            const active = lang === key
            return (
              <button
                key={l}
                type="button"
                onClick={() => setLang(key)}
                style={{
                  fontSize: 10, letterSpacing: '0.15em', fontWeight: 300, padding: 0,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: active ? C.text : C.sub,
                  borderBottom: active ? `1px solid ${C.gold}` : '1px solid transparent',
                  paddingBottom: 2, transition: 'all 0.3s ease',
                }}
              >
                {l}
              </button>
            )
          })}
        </div>

        <div className="mx-auto max-w-[480px] text-center" style={{ padding: '60px 24px 48px' }}>
          {/* 로고 */}
          <p style={{ fontSize: 10, letterSpacing: '0.4em', fontWeight: 300, color: C.sub }}>
            SALON DE DAZUL
          </p>

          {/* 골드 라인 */}
          <div className="mx-auto" style={{ width: 32, height: 1, background: C.gold, margin: '16px auto' }} />

          <p style={{ fontSize: 12, fontStyle: 'italic', letterSpacing: '0.2em', color: C.sub }}>
            Wellness Care Journal
          </p>

          {/* 반려견 이름 */}
          <h1 style={{ fontSize: 48, fontWeight: 200, letterSpacing: '0.1em', color: C.text, lineHeight: 1.1, marginTop: 32 }}>
            {petName}
          </h1>

          {/* 날짜 */}
          {latest?.visit_date && (
            <p style={{ fontSize: 11, color: C.sub, letterSpacing: '0.2em', marginTop: 20 }}>
              {fmtShort(latest.visit_date)}
            </p>
          )}

          {/* 몸무게 강조 행 + 이전 방문 대비 증감 */}
          {latest?.weight !== null && latest?.weight !== undefined && latest?.weight !== '' && (() => {
            const parseW = (v: unknown): number | null => {
              if (typeof v === 'number' && Number.isFinite(v)) return v
              if (typeof v === 'string' && v.trim()) {
                const n = parseFloat(v)
                return Number.isFinite(n) ? n : null
              }
              return null
            }
            const currentW = parseW(latest.weight)
            // 같은 반려견의 이전 방문 중 weight가 기록된 가장 최근 건
            const prevRec = past.find((r) => parseW(r.weight) !== null)
            const prevW = prevRec ? parseW(prevRec.weight) : null
            const diff = currentW !== null && prevW !== null ? currentW - prevW : null
            // 소수 1자리 반올림
            const diffRounded = diff !== null ? Math.round(diff * 10) / 10 : null
            return (
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 10 }}>
                <span style={{ fontSize: 10, color: '#8A8A7A', letterSpacing: '0.15em' }}>체중</span>
                <span style={{ fontSize: 16, fontWeight: 500, color: '#1A1A1A', letterSpacing: '0.05em' }}>
                  {latest.weight} kg
                </span>
                {diffRounded !== null && diffRounded !== 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      color: diffRounded > 0 ? '#C9A96E' : '#7A9E8A',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {diffRounded > 0 ? '▲' : '▼'} {diffRounded > 0 ? '+' : ''}{diffRounded}kg
                  </span>
                )}
              </div>
            )
          })()}
        </div>

        {/* 다견 가정 — 반려견 전환 탭 */}
        {pets.length > 1 && (
          <div
            className="mx-auto max-w-[480px]"
            style={{
              display: 'flex',
              gap: 24,
              justifyContent: 'center',
              fontSize: 12,
              letterSpacing: '0.1em',
              borderBottom: '1px solid #E8E5E0',
              paddingBottom: 12,
            }}
          >
            {pets.map((p) => {
              const active = p.id === activePetId
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setActivePetId(p.id)
                    // 새 반려견의 최신 레코드를 자동 펼치기
                    const nextLatest = records.find((r) => r.pet_id === p.id)
                    setExpandedId(nextLatest?.id ?? null)
                    setShowPast(false)
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '8px 0',
                    borderBottom: active ? '1px solid #1A1A1A' : '1px solid transparent',
                    color: active ? '#1A1A1A' : '#8A8A7A',
                    fontWeight: active ? 500 : 300,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {p.name}
                </button>
              )
            })}
          </div>
        )}
      </header>

      {/* ═══ 기록 ═══ */}
      <main className="mx-auto max-w-[480px]" style={{ padding: '0' }}>
        {/* 오늘의 케어 리포트 — 강조 헤더 */}
        {latest && (
          <>
            <div
              style={{
                background: '#FFFFFF',
                padding: '16px 0',
                textAlign: 'center',
                fontSize: 11,
                letterSpacing: '0.2em',
                color: '#1A1A1A',
                fontWeight: 400,
                marginTop: 32,
              }}
            >
              오늘의 웰니스 케어 기록
            </div>

            <RecordCard
              key={latest.id}
              rec={latest}
              expanded={expandedId === latest.id}
              onToggle={() => setExpandedId(expandedId === latest.id ? null : latest.id)}
              lang={lang}
              productSummaryMap={productSummaryMap}
              productCategoryMap={productCategoryMap}
            />
          </>
        )}

        {/* 지난 방문 기록 토글 */}
        {past.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowPast((v) => !v)}
              style={{
                width: '100%',
                borderTop: `1px solid ${C.border}`,
                borderBottom: `1px solid ${C.border}`,
                background: 'transparent',
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 11,
                letterSpacing: '0.15em',
                color: C.sub,
                cursor: 'pointer',
                marginTop: 24,
              }}
            >
              <span>지난 방문 기록 ({past.length}회)</span>
              <span style={{ color: C.gold, fontSize: 9, transition: 'transform 0.3s ease', transform: showPast ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                ▼
              </span>
            </button>

            {showPast && past.map((rec) => (
              <RecordCard
                key={rec.id}
                rec={rec}
                expanded={expandedId === rec.id}
                onToggle={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
                lang={lang}
                productSummaryMap={productSummaryMap}
                productCategoryMap={productCategoryMap}
              />
            ))}
          </>
        )}
      </main>
    </div>
  )
}
