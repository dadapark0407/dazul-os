'use client'

import { useState } from 'react'
import { CopyLinkButton, AdminMenu } from '@/components/report/ReportActions'

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

// ─── 팔레트 (따뜻한 럭셔리) ───
const C = {
  bg: '#FAFAF8',
  card: '#FFFFFF',
  text: '#1A1A1A',
  sub: '#8A8A7A',
  muted: '#8A8A7A',
  gold: '#C9A96E',
  border: '#E8E5E0',
  dark: '#1A1A1A',
  cream: '#FDFBF7',
}

// ─── 상수 ───
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

// ─── 기록 카드 ───
function RecordCard({ rec, expanded, onToggle }: { rec: Rec; expanded: boolean; onToggle: () => void }) {
  const svc = rec.service ?? rec.service_type ?? null
  const spa = rec.spa_level ? SPA[rec.spa_level] ?? null : null
  const cond = parseCond(rec.condition_status)
  const bodyItems = [
    { label: '피부', value: rec.skin_status },
    { label: '엉킴', value: rec.coat_status },
    { label: '눈', value: cond.eyes ?? null },
    { label: '귀', value: cond.ears ?? null },
    { label: '치아', value: cond.teeth ?? null },
    { label: '발톱', value: cond.nail ?? null },
  ].filter((item) => item.value)

  const tips = rec.next_care_guide
    ? rec.next_care_guide.split('\n').map((s) => s.trim()).filter(Boolean)
    : []

  const nextDate = rec.next_visit_date ? fmtDate(rec.next_visit_date) : null
  const nextWeeks = rec.next_visit_date ? weeksFrom(rec.next_visit_date) : ''
  const weight = rec.weight ? `${rec.weight}kg` : null

  return (
    <div style={{ background: C.card, marginBottom: 2 }}>
      {/* 날짜 헤더 */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 28px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div>
          <p style={{ fontSize: 13, fontWeight: 400, color: C.text, letterSpacing: '0.05em' }}>
            {fmtShort(rec.visit_date)}
          </p>
          <p style={{ fontSize: 11, color: C.muted, marginTop: 4, letterSpacing: '0.03em' }}>
            {[svc, spa ? `${spa.label}` : null, weight].filter(Boolean).join('  ·  ')}
          </p>
        </div>
        <span style={{ fontSize: 8, color: C.gold, transition: 'transform 0.3s ease', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
      </button>

      {/* 상세 */}
      {expanded && (
        <div style={{ padding: '0 28px 32px' }}>
          <div style={{ height: 1, background: C.border, marginBottom: 24 }} />

          {/* 서비스 + 몸무게 */}
          {svc && (
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 9, letterSpacing: '0.25em', color: C.muted, textTransform: 'uppercase' as const, marginBottom: 12 }}>
                Service
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span style={{ fontSize: 12, letterSpacing: '0.08em', color: C.text, fontWeight: 400 }}>
                  {svc}
                </span>
                {spa && (
                  <>
                    <span style={{ width: 1, height: 12, background: C.border, display: 'inline-block' }} />
                    <span style={{ fontSize: 12, color: C.gold, letterSpacing: '0.05em' }}>
                      {spa.label}
                    </span>
                  </>
                )}
                {weight && (
                  <>
                    <span style={{ width: 1, height: 12, background: C.border, display: 'inline-block' }} />
                    <span style={{ fontSize: 12, color: C.sub }}>{weight}</span>
                  </>
                )}
              </div>
              {spa && (
                <p style={{ fontSize: 10, color: C.muted, marginTop: 6, fontStyle: 'italic', letterSpacing: '0.02em' }}>
                  {spa.desc}
                </p>
              )}
            </div>
          )}

          {/* 신체 상태 */}
          {bodyItems.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 9, letterSpacing: '0.25em', color: C.muted, textTransform: 'uppercase' as const, marginBottom: 12 }}>
                Condition
              </p>
              {bodyItems.map((item, i) => (
                <div
                  key={item.label}
                  className="flex items-baseline gap-6"
                  style={{ padding: '8px 0', borderBottom: i < bodyItems.length - 1 ? `1px solid ${C.cream}` : 'none' }}
                >
                  <span style={{ width: 36, fontSize: 10, color: C.muted, letterSpacing: '0.1em', flexShrink: 0 }}>
                    {item.label}
                  </span>
                  <span style={{
                    fontSize: 12,
                    color: isIssue(item.value) ? C.gold : C.text,
                    fontWeight: isIssue(item.value) ? 500 : 300,
                    letterSpacing: '0.02em',
                  }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 사용 제품 */}
          {rec.care_actions && (
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 9, letterSpacing: '0.25em', color: C.muted, textTransform: 'uppercase' as const, marginBottom: 12 }}>
                Products
              </p>
              <p style={{ fontSize: 12, color: C.text, lineHeight: 1.8, fontWeight: 300 }}>{rec.care_actions}</p>
            </div>
          )}

          {/* 홈케어 */}
          {tips.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 9, letterSpacing: '0.25em', color: C.muted, textTransform: 'uppercase' as const, marginBottom: 12 }}>
                Home Care
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tips.map((tip, i) => (
                  <div key={i} style={{ paddingLeft: 16, borderLeft: `2px solid ${C.gold}`, background: C.cream, padding: '10px 16px', marginLeft: 0 }}>
                    <p style={{ fontSize: 11, color: C.text, lineHeight: 1.9, fontWeight: 300 }}>{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 다음 방문 */}
          {(nextDate || rec.next_visit_recommendation) && (
            <div style={{ marginBottom: 28, padding: '24px 0', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, textAlign: 'center' }}>
              <p style={{ fontSize: 9, letterSpacing: '0.25em', color: C.gold, textTransform: 'uppercase' as const, marginBottom: 14 }}>
                Next Visit
              </p>
              {nextDate && (
                <p style={{ fontSize: 20, fontWeight: 300, color: C.text, letterSpacing: '0.06em' }}>
                  {nextDate}
                </p>
              )}
              {nextWeeks && (
                <p style={{ fontSize: 10, color: C.muted, marginTop: 6, letterSpacing: '0.1em' }}>{nextWeeks}</p>
              )}
              {!nextDate && rec.next_visit_recommendation && (
                <p style={{ fontSize: 12, color: C.text, fontWeight: 300 }}>{rec.next_visit_recommendation}</p>
              )}
            </div>
          )}

          {/* 메시지 */}
          {rec.comment && (
            <div style={{ padding: '20px 24px', background: C.cream, borderLeft: `2px solid ${C.gold}`, marginTop: 4 }}>
              <p style={{ fontSize: 9, letterSpacing: '0.25em', color: C.gold, textTransform: 'uppercase' as const, marginBottom: 14 }}>
                Message
              </p>
              <p style={{ fontSize: 12, color: C.text, lineHeight: 2.2, whiteSpace: 'pre-wrap', fontWeight: 300 }}>
                {rec.comment}
              </p>
              <p style={{ fontSize: 9, color: C.muted, textAlign: 'right', marginTop: 16, letterSpacing: '0.15em' }}>
                — DAZUL
              </p>
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
}: {
  guardianName: string | null
  pets: Pet[]
  records: Rec[]
}) {
  const [activePetId, setActivePetId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | number | null>(records[0]?.id ?? null)

  const filtered = activePetId ? records.filter((r) => r.pet_id === activePetId) : records
  const latest = filtered[0]
  const petName = activePetId
    ? pets.find((p) => p.id === activePetId)?.name ?? latest?.pet_name ?? '반려견'
    : latest?.pet_name ?? '반려견'

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>

      {/* ═══ 헤더 ═══ */}
      <header style={{ background: C.cream, position: 'relative', borderBottom: `1px solid ${C.gold}` }}>
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          {latest && <AdminMenu recordId={latest.id} />}
        </div>

        <div className="mx-auto max-w-[480px] px-4 pt-20 pb-14 text-center">
          {/* 로고 */}
          <p style={{ fontSize: 11, letterSpacing: '0.25em', fontWeight: 300, color: C.sub }}>
            SALON DE DAZUL
          </p>
          <p style={{ fontSize: 13, fontStyle: 'italic', letterSpacing: '0.1em', color: C.sub, marginTop: 6 }}>
            Wellness Care Journal
          </p>

          {/* 골드 라인 */}
          <div className="mx-auto my-8" style={{ width: 40, height: 0.5, background: C.gold }} />

          {/* 반려견 이름 */}
          <h1 style={{ fontSize: 32, fontWeight: 300, letterSpacing: '0.1em', color: C.text, lineHeight: 1.1 }}>
            {petName}
          </h1>

          {/* 날짜 + 몸무게 */}
          {latest?.visit_date && (
            <p style={{ fontSize: 12, color: C.sub, letterSpacing: '0.15em', marginTop: 16 }}>
              {fmtShort(latest.visit_date)}
              {latest.weight ? `  ·  ${latest.weight}kg` : ''}
            </p>
          )}

          {/* 다견 탭 */}
          {pets.length > 1 && (
            <div className="mt-8 flex justify-center" style={{ gap: 0 }}>
              {[{ id: null as string | null, name: '전체' }, ...pets.map((p) => ({ id: p.id as string | null, name: p.name }))].map((tab) => (
                <button
                  key={tab.id ?? 'all'}
                  type="button"
                  onClick={() => setActivePetId(tab.id)}
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.15em',
                    padding: '8px 20px',
                    background: 'transparent',
                    color: (activePetId === tab.id || (!activePetId && !tab.id))
                      ? C.text
                      : C.muted,
                    border: 'none',
                    borderBottom: (activePetId === tab.id || (!activePetId && !tab.id))
                      ? `1px solid ${C.gold}`
                      : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.4s ease',
                    fontWeight: 300,
                  }}
                >
                  {tab.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ═══ 기록 ═══ */}
      <main className="mx-auto max-w-[480px] px-4 pt-8 pb-4">
        {/* 카운트 */}
        <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
          <div style={{ flex: 1, height: 0.5, background: C.border }} />
          <p style={{ fontSize: 9, letterSpacing: '0.3em', color: C.muted, flexShrink: 0 }}>
            CARE HISTORY · {filtered.length}
          </p>
          <div style={{ flex: 1, height: 0.5, background: C.border }} />
        </div>

        {/* 카드 목록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filtered.map((rec) => (
            <RecordCard
              key={rec.id}
              rec={rec}
              expanded={expandedId === rec.id}
              onToggle={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
            />
          ))}
        </div>

        {/* CTA */}
        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CopyLinkButton />
          <div className="flex gap-2">
            <a href="#" style={{
              flex: 1, display: 'block', background: '#FAE300', color: '#3B1E08',
              fontSize: 10, letterSpacing: '0.12em', fontWeight: 400, padding: '14px 0',
              textDecoration: 'none', textAlign: 'center',
            }}>
              카카오톡 문의
            </a>
            <a href="#" style={{
              flex: 1, display: 'block', background: C.dark, color: '#FFFFFF',
              fontSize: 10, letterSpacing: '0.12em', fontWeight: 400, padding: '14px 0',
              textDecoration: 'none', textAlign: 'center',
            }}>
              전화 예약
            </a>
          </div>
        </div>
      </main>

      {/* ═══ 푸터 ═══ */}
      <footer style={{ padding: '48px 0 36px', textAlign: 'center' }}>
        <div className="mx-auto" style={{ width: 24, height: 0.5, background: C.gold, marginBottom: 20 }} />
        <p style={{ fontSize: 11, letterSpacing: '0.2em', color: C.sub, fontWeight: 300 }}>
          DAZUL · Wellness Care Salon
        </p>
      </footer>
    </div>
  )
}
