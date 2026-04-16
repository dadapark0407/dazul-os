import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { CopyLinkButton, AdminMenu } from '@/components/report/ReportActions'

// =============================================================
// DAZUL OS — Grooming Letter (보호자 리포트)
// guardian.share_token 기반, 최신 방문 기록 1건
// =============================================================

type PageProps = { params: Promise<{ token: string }> }

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// ─── 상수 ───

const SPA: Record<string, { label: string; color: string; desc: string }> = {
  basic:     { label: '베이직',     color: '#B0BEC5', desc: '기본 클렌징' },
  premium:   { label: '에센셜',     color: '#81C784', desc: '딥클렌징 & 보습' },
  essential: { label: '에센셜',     color: '#81C784', desc: '딥클렌징 & 보습' },
  deep:      { label: '시그니처',   color: '#4FC3F7', desc: '전신 영양 트리트먼트' },
  signature: { label: '시그니처',   color: '#4FC3F7', desc: '전신 영양 트리트먼트' },
  prestige:  { label: '프레스티지', color: '#FFD54F', desc: '프리미엄 맞춤 풀케어' },
}

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

function parseCond(s: string | null): Record<string, string> {
  const r: Record<string, string> = {}
  if (!s) return r
  for (const p of s.split('/').map((x) => x.trim())) {
    if (p.startsWith('눈:')) r.eyes = p.slice(2).trim()
    else if (p.startsWith('귀:')) r.ears = p.slice(2).trim()
    else if (p.startsWith('치아:')) r.teeth = p.slice(3).trim()
    else if (p.startsWith('발톱:')) r.nail = p.slice(3).trim()
  }
  return r
}

function isOk(v: string | null): boolean {
  if (!v) return true
  return ['좋음', '깨끗함', '없음', '적당함', '양호'].some((g) => v.includes(g))
}

// ─── 페이지 ───

export default async function ReportPage({ params }: PageProps) {
  const { token } = await params
  if (!token) notFound()

  const supabase = getSupabase()

  const { data: guardian } = await supabase
    .from('guardians')
    .select('id, name')
    .eq('share_token', token)
    .maybeSingle()

  if (!guardian) notFound()

  const { data: rec } = await supabase
    .from('visit_records')
    .select('id, pet_name, visit_date, service, service_type, spa_level, skin_status, coat_status, condition_status, next_care_guide, next_visit_date, next_visit_recommendation, comment')
    .eq('guardian_id', guardian.id)
    .order('visit_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!rec) notFound()

  const petName = rec.pet_name ?? '반려견'
  const dateStr = fmtShort(rec.visit_date)
  const svc = rec.service ?? rec.service_type ?? null
  const spaKey = rec.spa_level as string | null
  const spa = spaKey ? SPA[spaKey] ?? null : null

  const cond = parseCond(rec.condition_status)
  const health = [
    { key: 'skin',    label: '피부', icon: '🐾', value: rec.skin_status },
    { key: 'tangles', label: '엉킴', icon: '🌀', value: rec.coat_status },
    { key: 'eyes',    label: '눈',   icon: '👁️', value: cond.eyes ?? null },
    { key: 'ears',    label: '귀',   icon: '👂', value: cond.ears ?? null },
    { key: 'teeth',   label: '치아', icon: '🦷', value: cond.teeth ?? null },
    { key: 'nail',    label: '발톱', icon: '✂️', value: cond.nail ?? null },
  ]
  const hasHealth = health.some((h) => h.value)
  const allOk = health.every((h) => isOk(h.value))

  const tips = rec.next_care_guide
    ? rec.next_care_guide.split('\n').map((s: string) => s.trim()).filter(Boolean)
    : []

  const nextDate = rec.next_visit_date ? fmtDate(rec.next_visit_date) : null
  const nextWeeks = rec.next_visit_date ? weeksFrom(rec.next_visit_date) : ''
  const nextRec = rec.next_visit_recommendation ?? null
  const hasNext = nextDate || nextRec

  const comment = rec.comment ?? null

  // ─── 섹션 헤더 컴포넌트 ───
  const SH = ({ children }: { children: string }) => (
    <p className="mb-4" style={{ fontSize: 11, letterSpacing: '0.15em', fontWeight: 300, color: '#888', textTransform: 'uppercase' as const }}>
      {children}
    </p>
  )

  return (
    <div className="min-h-screen" style={{ background: '#FFFFFF' }}>
      {/* ─── 1. 헤더 ─── */}
      <header style={{ background: '#0A0A0A', borderBottom: '1px solid #C9A96E', position: 'relative' }}>
        {/* 관리 메뉴 (직원용) */}
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <AdminMenu recordId={rec.id} />
        </div>
        <div className="mx-auto max-w-[480px] px-6 py-10 text-center">
          <p style={{ fontSize: 12, letterSpacing: '0.25em', fontWeight: 300, color: '#FFFFFF' }}>
            DAZUL
          </p>
          <p className="mt-2" style={{ fontSize: 14, letterSpacing: '0.08em', fontWeight: 300, color: '#C9A96E', fontStyle: 'italic' }}>
            Grooming Letter
          </p>
          <div className="mx-auto mt-4 h-px w-8" style={{ background: '#C9A96E' }} />
          <h1 className="mt-5" style={{ fontSize: 28, fontWeight: 300, letterSpacing: '0.05em', color: '#FFFFFF' }}>
            {petName}
          </h1>
          <p className="mt-3" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}>
            {dateStr}
          </p>
        </div>
      </header>

      {/* ─── 콘텐츠 ─── */}
      <main className="mx-auto max-w-[480px] px-4 py-6">

        {/* 2. 오늘의 서비스 */}
        {svc && (
          <section className="mb-3" style={{ border: '1px solid #E8E8E8', padding: 28 }}>
            <SH>Service</SH>
            <span style={{ display: 'inline-block', background: '#0A0A0A', color: '#FFFFFF', fontSize: 12, letterSpacing: '0.08em', fontWeight: 400, padding: '8px 16px' }}>
              {svc}
            </span>
            {spa && (
              <div className="mt-4" style={{ background: `${spa.color}12`, border: `1px solid ${spa.color}40`, padding: 16 }}>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 16 }}>✨</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#0A0A0A' }}>스파 {spa.label}</p>
                    <p style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{spa.desc}</p>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 3. 신체 상태 체크 */}
        {hasHealth && (
          <section className="mb-3" style={{ border: '1px solid #E8E8E8', padding: 28 }}>
            <SH>Health Check</SH>
            <div className="grid grid-cols-3 gap-2">
              {health.map((h) => {
                const ok = isOk(h.value)
                return (
                  <div
                    key={h.key}
                    style={{
                      border: ok ? '1px solid #E8E8E8' : '1px solid #C9A96E',
                      background: ok ? '#FFFFFF' : '#FFFDF7',
                      padding: '14px 10px',
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ fontSize: 16 }}>{h.icon}</p>
                    <p style={{ fontSize: 11, fontWeight: 500, color: ok ? '#888' : '#C9A96E', marginTop: 4 }}>
                      {h.label}
                    </p>
                    <p style={{ fontSize: 10, color: ok ? '#888' : '#C9A96E', marginTop: 2 }}>
                      {ok ? '✓' : '⚠'}
                    </p>
                    {!ok && h.value && (
                      <p style={{ fontSize: 10, color: '#C9A96E', marginTop: 4, lineHeight: 1.4 }}>
                        {h.value}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            {allOk && (
              <p className="mt-4 text-center" style={{ fontSize: 13, color: '#888' }}>
                모든 부위가 건강해요 🎉
              </p>
            )}
          </section>
        )}

        {/* 4. 집에서 케어팁 */}
        {tips.length > 0 && (
          <section className="mb-3" style={{ border: '1px solid #E8E8E8', padding: 28 }}>
            <SH>Home Care Tips</SH>
            <div className="space-y-2">
              {tips.map((tip: string, i: number) => (
                <div
                  key={i}
                  style={{ borderLeft: '2px solid #C9A96E', paddingLeft: 14, paddingTop: 4, paddingBottom: 4 }}
                >
                  <p style={{ fontSize: 12, color: '#0A0A0A', lineHeight: 1.7 }}>{tip}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 5. 다음 방문 추천 */}
        {hasNext && (
          <section className="mb-3" style={{ border: '1px solid #E8E8E8', padding: 28, textAlign: 'center' }}>
            <SH>Next Visit</SH>
            {nextDate && (
              <>
                <p style={{ fontSize: 22, fontWeight: 300, color: '#0A0A0A', letterSpacing: '0.03em' }}>
                  {nextDate}
                </p>
                {nextWeeks && (
                  <p style={{ fontSize: 11, color: '#888', marginTop: 6 }}>{nextWeeks}</p>
                )}
              </>
            )}
            {!nextDate && nextRec && (
              <p style={{ fontSize: 13, color: '#0A0A0A', lineHeight: 1.7 }}>{nextRec}</p>
            )}
          </section>
        )}

        {/* 6. 보호자 전달 메시지 */}
        {comment && (
          <section className="mb-3" style={{ background: '#FAFAFA', borderLeft: '2px solid #C9A96E', padding: 20 }}>
            <SH>Message</SH>
            <p style={{ fontSize: 13, color: '#0A0A0A', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {comment}
            </p>
            <p className="mt-3" style={{ fontSize: 11, color: '#888', textAlign: 'right' }}>
              — 살롱다즐
            </p>
          </section>
        )}

        {/* 7. CTA */}
        <div className="mb-3 space-y-2">
          <CopyLinkButton />
          <a
            href="#"
            className="flex items-center justify-center gap-2"
            style={{ background: '#FAE300', color: '#3B1E08', fontSize: 12, letterSpacing: '0.1em', fontWeight: 500, padding: '14px 0', textDecoration: 'none', display: 'block', textAlign: 'center' }}
          >
            💬 카카오톡 문의
          </a>
          <a
            href="#"
            className="flex items-center justify-center gap-2"
            style={{ background: '#0A0A0A', color: '#FFFFFF', fontSize: 12, letterSpacing: '0.1em', fontWeight: 500, padding: '14px 0', textDecoration: 'none', display: 'block', textAlign: 'center' }}
          >
            📞 전화 예약
          </a>
        </div>
      </main>

      {/* 8. 푸터 */}
      <footer className="py-8 text-center" style={{ borderTop: '1px solid #E8E8E8' }}>
        <p style={{ fontSize: 11, letterSpacing: '0.2em', color: '#888' }}>
          DAZUL · 반려견 케어 살롱
        </p>
      </footer>
    </div>
  )
}
