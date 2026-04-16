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
  <p style={{ fontSize: 9, letterSpacing: '0.3em', fontWeight: 400, color: C.sub, textTransform: 'uppercase' as const, marginBottom: 24 }}>
    {children}
  </p>
)

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
    <div style={{ background: C.card, borderTop: `1px solid ${C.border}` }}>
      {/* 날짜 헤더 */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
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
        <div style={{ padding: '0 24px 32px' }}>
          <div style={{ height: 1, background: C.line, marginBottom: 28 }} />

          {/* SERVICE */}
          {svc && (
            <div style={{ marginBottom: 32 }}>
              <SH>Service</SH>
              <p style={{ fontSize: 15, fontWeight: 300, color: C.text, letterSpacing: '0.03em' }}>
                {svc}
              </p>
              {spa && (
                <p style={{ fontSize: 11, color: C.gold, letterSpacing: '0.15em', marginTop: 6 }}>
                  {spa.label}
                </p>
              )}
              {spa && (
                <p style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>
                  {spa.desc}
                </p>
              )}
              {weight && (
                <p style={{ fontSize: 11, color: C.sub, marginTop: 8, letterSpacing: '0.05em' }}>
                  {weight}
                </p>
              )}
            </div>
          )}

          {/* CONDITION */}
          {bodyItems.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <SH>Condition</SH>
              {bodyItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-baseline"
                  style={{ padding: '14px 0', borderBottom: `1px solid ${C.line}` }}
                >
                  <span style={{ width: 48, fontSize: 9, color: C.sub, letterSpacing: '0.2em', textTransform: 'uppercase' as const, flexShrink: 0 }}>
                    {item.label}
                  </span>
                  <span style={{
                    fontSize: 13,
                    color: isIssue(item.value) ? C.gold : C.text,
                    fontWeight: isIssue(item.value) ? 400 : 300,
                    lineHeight: 2,
                  }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* PRODUCTS */}
          {rec.care_actions && (
            <div style={{ marginBottom: 32 }}>
              <SH>Products</SH>
              <p style={{ fontSize: 13, color: C.text, lineHeight: 2, fontWeight: 300 }}>{rec.care_actions}</p>
            </div>
          )}

          {/* HOME CARE */}
          {tips.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <SH>Home Care</SH>
              {tips.map((tip, i) => (
                <div key={i} style={{ padding: '12px 0', borderBottom: `1px solid ${C.line}`, display: 'flex', gap: 12 }}>
                  <span style={{ color: C.gold, fontSize: 13, flexShrink: 0 }}>—</span>
                  <p style={{ fontSize: 13, color: C.text, lineHeight: 2, fontWeight: 300 }}>{tip}</p>
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
              <p style={{ fontSize: 9, color: C.sub, textAlign: 'right', marginTop: 20, letterSpacing: '0.2em' }}>
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
    <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 80 }}>

      {/* ═══ 헤더 ═══ */}
      <header style={{ background: C.cream, position: 'relative', borderBottom: `1px solid ${C.gold}` }}>
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          {latest && <AdminMenu recordId={latest.id} />}
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

          {/* 날짜 + 몸무게 */}
          {latest?.visit_date && (
            <p style={{ fontSize: 11, color: C.sub, letterSpacing: '0.2em', marginTop: 20 }}>
              {fmtShort(latest.visit_date)}
              {latest.weight ? `  ·  ${latest.weight}kg` : ''}
            </p>
          )}

          {/* 다견 탭 */}
          {pets.length > 1 && (
            <div className="flex justify-center" style={{ marginTop: 32, gap: 0 }}>
              {[{ id: null as string | null, name: '전체' }, ...pets.map((p) => ({ id: p.id as string | null, name: p.name }))].map((tab) => {
                const active = activePetId === tab.id || (!activePetId && !tab.id)
                return (
                  <button
                    key={tab.id ?? 'all'}
                    type="button"
                    onClick={() => setActivePetId(tab.id)}
                    style={{
                      fontSize: 10, letterSpacing: '0.15em', padding: '10px 20px',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: active ? C.text : C.sub,
                      borderBottom: active ? `1px solid ${C.gold}` : '1px solid transparent',
                      fontWeight: active ? 400 : 300,
                      transition: 'all 0.4s ease',
                    }}
                  >
                    {tab.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </header>

      {/* ═══ 기록 ═══ */}
      <main className="mx-auto max-w-[480px]" style={{ padding: '32px 0 0' }}>
        {/* 카운트 */}
        <div className="flex items-center gap-3" style={{ marginBottom: 20, padding: '0 24px' }}>
          <div style={{ flex: 1, height: 0.5, background: C.border }} />
          <p style={{ fontSize: 9, letterSpacing: '0.3em', color: C.sub, flexShrink: 0 }}>
            CARE HISTORY · {filtered.length}
          </p>
          <div style={{ flex: 1, height: 0.5, background: C.border }} />
        </div>

        {/* 카드 목록 (간격 0, 상단 보더만) */}
        {filtered.map((rec) => (
          <RecordCard
            key={rec.id}
            rec={rec}
            expanded={expandedId === rec.id}
            onToggle={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
          />
        ))}

        {/* CTA */}
        <div style={{ marginTop: 48, padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              flex: 1, display: 'block', background: C.text, color: '#FFFFFF',
              fontSize: 10, letterSpacing: '0.12em', fontWeight: 400, padding: '14px 0',
              textDecoration: 'none', textAlign: 'center',
            }}>
              전화 예약
            </a>
          </div>
        </div>
      </main>

      {/* ═══ 푸터 ═══ */}
      <footer style={{ padding: '56px 0 0', textAlign: 'center' }}>
        <div className="mx-auto" style={{ width: 24, height: 0.5, background: C.gold, marginBottom: 20 }} />
        <p style={{ fontSize: 9, letterSpacing: '0.3em', color: C.sub, fontWeight: 300 }}>
          SALON DE DAZUL
        </p>
      </footer>
    </div>
  )
}
