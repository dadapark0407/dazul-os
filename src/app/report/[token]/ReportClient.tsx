'use client'

import { useState } from 'react'
import { CopyLinkButton, AdminMenu } from '@/components/report/ReportActions'

// ─── 타입 ───
type Pet = { id: string; name: string; breed: string | null }
type Record = {
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

function SH({ children }: { children: string }) {
  return (
    <p style={{ fontSize: 10, letterSpacing: '0.2em', fontWeight: 400, color: '#C9A96E', textTransform: 'uppercase' as const, marginBottom: 20 }}>
      {children}
    </p>
  )
}

// ─── 개별 기록 카드 ───
function RecordCard({ rec, expanded, onToggle }: { rec: Record; expanded: boolean; onToggle: () => void }) {
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
    <div style={{ border: '1px solid #E8E8E8', background: '#FFFFFF', marginBottom: 8 }}>
      {/* 헤더 (클릭으로 토글) */}
      <button
        type="button"
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div>
          <p style={{ fontSize: 14, fontWeight: 500, color: '#0A0A0A' }}>
            {fmtShort(rec.visit_date)}
          </p>
          <p style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            {[svc, spa?.label ? `✨ ${spa.label}` : null, weight].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span style={{ fontSize: 12, color: '#C9A96E', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
      </button>

      {/* 상세 (펼쳐진 상태) */}
      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid #E8E8E8' }}>

          {/* 서비스 */}
          {svc && (
            <div style={{ paddingTop: 16, paddingBottom: 16, borderBottom: '1px solid #E8E8E8' }}>
              <div className="flex items-center gap-2">
                <span style={{ background: '#0A0A0A', color: '#FFFFFF', fontSize: 11, letterSpacing: '0.1em', padding: '5px 12px' }}>
                  {svc}
                </span>
                {spa && (
                  <span style={{ border: '1px solid #C9A96E', color: '#C9A96E', fontSize: 11, padding: '5px 12px' }}>
                    ✨ {spa.label}
                  </span>
                )}
                {weight && (
                  <span style={{ fontSize: 11, color: '#888' }}>{weight}</span>
                )}
              </div>
              {spa && <p style={{ fontSize: 11, color: '#888', marginTop: 6 }}>{spa.desc}</p>}
            </div>
          )}

          {/* 신체 상태 */}
          {bodyItems.length > 0 && (
            <div style={{ paddingTop: 16, paddingBottom: 16, borderBottom: '1px solid #E8E8E8' }}>
              <SH>Body Check</SH>
              {bodyItems.map((item, i) => (
                <div key={item.label} className="flex items-center gap-4" style={{ padding: '6px 0', borderBottom: i < bodyItems.length - 1 ? '1px solid #F0F0F0' : 'none' }}>
                  <span style={{ width: 44, fontSize: 11, color: '#888', flexShrink: 0 }}>{item.label}</span>
                  <span style={{ fontSize: 13, color: isIssue(item.value) ? '#C9A96E' : '#0A0A0A', fontWeight: isIssue(item.value) ? 500 : 400 }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 사용 제품 */}
          {rec.care_actions && (
            <div style={{ paddingTop: 16, paddingBottom: 16, borderBottom: '1px solid #E8E8E8' }}>
              <SH>Products</SH>
              <p style={{ fontSize: 12, color: '#0A0A0A', lineHeight: 1.7 }}>{rec.care_actions}</p>
            </div>
          )}

          {/* 홈케어 가이드 */}
          {tips.length > 0 && (
            <div style={{ paddingTop: 16, paddingBottom: 16, borderBottom: '1px solid #E8E8E8' }}>
              <SH>Home Care</SH>
              <div className="space-y-2">
                {tips.map((tip, i) => (
                  <div key={i} style={{ borderLeft: '2px solid #C9A96E', paddingLeft: 12 }}>
                    <p style={{ fontSize: 12, color: '#0A0A0A', lineHeight: 1.7 }}>{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 다음 방문 */}
          {(nextDate || rec.next_visit_recommendation) && (
            <div style={{ paddingTop: 16, paddingBottom: 16, borderBottom: '1px solid #E8E8E8', textAlign: 'center' }}>
              <SH>Next Visit</SH>
              {nextDate && <p style={{ fontSize: 18, fontWeight: 200, color: '#0A0A0A' }}>{nextDate}</p>}
              {nextWeeks && <p style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{nextWeeks}</p>}
              {!nextDate && rec.next_visit_recommendation && (
                <p style={{ fontSize: 12, color: '#0A0A0A' }}>{rec.next_visit_recommendation}</p>
              )}
            </div>
          )}

          {/* 보호자 메시지 */}
          {rec.comment && (
            <div style={{ paddingTop: 16, borderLeft: '2px solid #C9A96E', paddingLeft: 16, marginTop: 8 }}>
              <SH>Message</SH>
              <p style={{ fontSize: 13, color: '#0A0A0A', lineHeight: 2, whiteSpace: 'pre-wrap' }}>
                {rec.comment}
              </p>
              <p style={{ fontSize: 10, color: '#C9A96E', textAlign: 'right', marginTop: 12, letterSpacing: '0.1em' }}>
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
  records: Record[]
}) {
  const [activePetId, setActivePetId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | number | null>(records[0]?.id ?? null)

  // 필터링
  const filtered = activePetId
    ? records.filter((r) => r.pet_id === activePetId)
    : records

  // 최신 기록 (헤더용)
  const latest = filtered[0]
  const latestPetName = latest?.pet_name ?? (activePetId ? pets.find((p) => p.id === activePetId)?.name : null) ?? '반려견'

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA' }}>

      {/* ═══ 헤더 ═══ */}
      <header style={{ background: '#0A0A0A', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          {latest && <AdminMenu recordId={latest.id} />}
        </div>
        <div className="mx-auto max-w-[480px] px-6 pb-10 pt-14 text-center">
          <p style={{ fontSize: 11, letterSpacing: '0.4em', fontWeight: 300, color: 'rgba(255,255,255,0.5)' }}>
            DAZUL
          </p>
          <div className="mx-auto mt-6 mb-5" style={{ width: 24, height: 1, background: '#C9A96E' }} />
          <h1 style={{ fontSize: 28, fontWeight: 200, letterSpacing: '0.08em', color: '#FFFFFF' }}>
            {latestPetName}
          </h1>
          {latest?.visit_date && (
            <p className="mt-3" style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em' }}>
              {fmtShort(latest.visit_date)}
              {latest.weight ? ` · ${latest.weight}kg` : ''}
            </p>
          )}

          {/* 반려견 탭 (다견 가정) */}
          {pets.length > 1 && (
            <div className="mt-6 flex justify-center gap-1">
              <button
                type="button"
                onClick={() => setActivePetId(null)}
                style={{
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  padding: '6px 14px',
                  background: !activePetId ? '#C9A96E' : 'transparent',
                  color: !activePetId ? '#0A0A0A' : 'rgba(255,255,255,0.4)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                전체
              </button>
              {pets.map((pet) => (
                <button
                  key={pet.id}
                  type="button"
                  onClick={() => setActivePetId(pet.id)}
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    padding: '6px 14px',
                    background: activePetId === pet.id ? '#C9A96E' : 'transparent',
                    color: activePetId === pet.id ? '#0A0A0A' : 'rgba(255,255,255,0.4)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {pet.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* ═══ 기록 목록 ═══ */}
      <main className="mx-auto max-w-[480px] px-4 py-6">
        <p style={{ fontSize: 10, letterSpacing: '0.2em', color: '#C9A96E', textTransform: 'uppercase' as const, marginBottom: 12 }}>
          Care History · {filtered.length}건
        </p>

        {filtered.map((rec) => (
          <RecordCard
            key={rec.id}
            rec={rec}
            expanded={expandedId === rec.id}
            onToggle={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
          />
        ))}

        {/* CTA */}
        <div className="mt-6 space-y-2">
          <CopyLinkButton />
          <a href="#" style={{ display: 'block', background: '#FAE300', color: '#3B1E08', fontSize: 11, letterSpacing: '0.1em', fontWeight: 500, padding: '14px 0', textDecoration: 'none', textAlign: 'center' }}>
            💬 카카오톡 문의
          </a>
          <a href="#" style={{ display: 'block', background: '#0A0A0A', color: '#FFFFFF', fontSize: 11, letterSpacing: '0.1em', fontWeight: 500, padding: '14px 0', textDecoration: 'none', textAlign: 'center' }}>
            📞 전화 예약
          </a>
        </div>
      </main>

      {/* ═══ 푸터 ═══ */}
      <footer style={{ padding: '40px 0 32px', textAlign: 'center' }}>
        <div className="mx-auto" style={{ width: 16, height: 1, background: '#C9A96E', marginBottom: 16 }} />
        <p style={{ fontSize: 10, letterSpacing: '0.25em', color: '#C0C0C0' }}>
          DAZUL · HOLISTIC WELLNESS CARE
        </p>
      </footer>
    </div>
  )
}
