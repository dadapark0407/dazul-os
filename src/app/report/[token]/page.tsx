import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { CopyLinkButton, AdminMenu } from '@/components/report/ReportActions'

// =============================================================
// DAZUL — Grooming Letter
// =============================================================

type PageProps = { params: Promise<{ token: string }> }

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

const SPA: Record<string, { label: string; desc: string }> = {
  basic: { label: '베이직', desc: '기본 클렌징' },
  premium: { label: '에센셜', desc: '딥클렌징 & 보습' },
  essential: { label: '에센셜', desc: '딥클렌징 & 보습' },
  deep: { label: '시그니처', desc: '전신 영양 트리트먼트' },
  signature: { label: '시그니처', desc: '전신 영양 트리트먼트' },
  prestige: { label: '프레스티지', desc: '프리미엄 맞춤 풀케어' },
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

function hasVal(v: string | null | undefined): boolean {
  return !!v && v.trim().length > 0
}

function isIssue(v: string | null): boolean {
  if (!v) return false
  return !['좋음', '깨끗함', '없음', '적당함', '양호'].some((g) => v.includes(g))
}

// ─── 섹션 헤더 ───
function SH({ children }: { children: string }) {
  return (
    <p style={{ fontSize: 10, letterSpacing: '0.2em', fontWeight: 400, color: '#C9A96E', textTransform: 'uppercase' as const, marginBottom: 20 }}>
      {children}
    </p>
  )
}

// ─── 구분선 ───
function Divider() {
  return <div style={{ height: 1, background: '#E8E8E8', margin: '4px 0' }} />
}

export default async function ReportPage({ params }: PageProps) {
  const { token } = await params
  if (!token) notFound()

  const supabase = getSupabase()

  const { data: guardian } = await supabase
    .from('guardians').select('id, name').eq('share_token', token).maybeSingle()
  if (!guardian) notFound()

  const { data: rec } = await supabase
    .from('visit_records')
    .select('id, pet_name, visit_date, service, service_type, spa_level, skin_status, coat_status, condition_status, care_actions, next_care_guide, next_visit_date, next_visit_recommendation, comment')
    .eq('guardian_id', guardian.id)
    .order('visit_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!rec) notFound()

  const petName = rec.pet_name ?? '반려견'
  const dateStr = fmtShort(rec.visit_date)
  const svc = rec.service ?? rec.service_type ?? null
  const serviceType = rec.service_type ?? null
  const spaKey = rec.spa_level as string | null
  const spa = spaKey ? SPA[spaKey] ?? null : null

  const cond = parseCond(rec.condition_status)
  const bodyItems = [
    { label: '피부', value: rec.skin_status },
    { label: '엉킴', value: rec.coat_status },
    { label: '눈', value: cond.eyes ?? null },
    { label: '귀', value: cond.ears ?? null },
    { label: '치아', value: cond.teeth ?? null },
    { label: '발톱', value: cond.nail ?? null },
  ].filter((item) => hasVal(item.value))

  const allGood = bodyItems.length === 0 || bodyItems.every((item) => !isIssue(item.value))

  const tips = rec.next_care_guide
    ? rec.next_care_guide.split('\n').map((s: string) => s.trim()).filter(Boolean)
    : []

  const nextDate = rec.next_visit_date ? fmtDate(rec.next_visit_date) : null
  const nextWeeks = rec.next_visit_date ? weeksFrom(rec.next_visit_date) : ''
  const nextRec = rec.next_visit_recommendation ?? null
  const comment = rec.comment ?? null
  const careActions = rec.care_actions ?? null

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAFA' }}>

      {/* ═══ 헤더 ═══ */}
      <header style={{ background: '#0A0A0A', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <AdminMenu recordId={rec.id} />
        </div>
        <div className="mx-auto max-w-[480px] px-6 pb-12 pt-14 text-center">
          <p style={{ fontSize: 11, letterSpacing: '0.4em', fontWeight: 300, color: 'rgba(255,255,255,0.5)' }}>
            DAZUL
          </p>
          <div className="mx-auto mt-6 mb-6" style={{ width: 24, height: 1, background: '#C9A96E' }} />
          <h1 style={{ fontSize: 32, fontWeight: 200, letterSpacing: '0.08em', color: '#FFFFFF', lineHeight: 1.2 }}>
            {petName}
          </h1>
          <p className="mt-4" style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em' }}>
            {dateStr}
          </p>
        </div>
      </header>

      {/* ═══ 콘텐츠 ═══ */}
      <main className="mx-auto max-w-[480px] px-5" style={{ marginTop: -1 }}>

        {/* 서비스 */}
        {svc && (
          <section style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', padding: '28px 24px', marginTop: 12 }}>
            <SH>Today&apos;s Service</SH>
            <div className="flex items-center gap-3">
              <span style={{ background: '#0A0A0A', color: '#FFFFFF', fontSize: 11, letterSpacing: '0.1em', fontWeight: 400, padding: '6px 14px' }}>
                {svc}
              </span>
              {spa && (
                <span style={{ border: '1px solid #C9A96E', color: '#C9A96E', fontSize: 11, letterSpacing: '0.08em', padding: '6px 14px' }}>
                  ✨ {spa.label}
                </span>
              )}
            </div>
            {spa && (
              <p className="mt-3" style={{ fontSize: 11, color: '#888', letterSpacing: '0.03em' }}>
                {spa.desc}
              </p>
            )}
            {serviceType && serviceType !== svc && (
              <p className="mt-2" style={{ fontSize: 11, color: '#888' }}>{serviceType}</p>
            )}
          </section>
        )}

        {/* 신체 상태 */}
        {(bodyItems.length > 0 || allGood) && (
          <section style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', padding: '28px 24px', marginTop: 12 }}>
            <SH>Body Check</SH>
            {bodyItems.length === 0 && (
              <p style={{ fontSize: 13, color: '#888', textAlign: 'center', padding: '8px 0' }}>
                전반적으로 건강한 상태예요 ✓
              </p>
            )}
            {bodyItems.map((item, i) => (
              <div key={item.label}>
                {i > 0 && <Divider />}
                <div className="flex items-center gap-4" style={{ padding: '10px 0' }}>
                  <span style={{ width: 44, fontSize: 11, color: '#888', letterSpacing: '0.08em', flexShrink: 0 }}>
                    {item.label}
                  </span>
                  <span style={{
                    fontSize: 13,
                    fontWeight: isIssue(item.value) ? 500 : 400,
                    color: isIssue(item.value) ? '#C9A96E' : '#0A0A0A',
                  }}>
                    {item.value}
                  </span>
                </div>
              </div>
            ))}
            {bodyItems.length > 0 && allGood && (
              <div style={{ marginTop: 12, padding: '10px 0', borderTop: '1px solid #E8E8E8', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: '#888' }}>모든 항목이 양호합니다 ✓</p>
              </div>
            )}
          </section>
        )}

        {/* 사용 제품 */}
        {careActions && (
          <section style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', padding: '28px 24px', marginTop: 12 }}>
            <SH>Products Used</SH>
            <p style={{ fontSize: 13, color: '#0A0A0A', lineHeight: 1.7 }}>{careActions}</p>
          </section>
        )}

        {/* 홈케어 가이드 */}
        {tips.length > 0 && (
          <section style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', padding: '28px 24px', marginTop: 12 }}>
            <SH>Home Care Guide</SH>
            <div className="space-y-3">
              {tips.map((tip: string, i: number) => (
                <div key={i} style={{ borderLeft: '2px solid #C9A96E', paddingLeft: 14, paddingTop: 2, paddingBottom: 2 }}>
                  <p style={{ fontSize: 12, color: '#0A0A0A', lineHeight: 1.8 }}>{tip}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 다음 방문 */}
        {(nextDate || nextRec) && (
          <section style={{ background: '#0A0A0A', padding: '32px 24px', marginTop: 12, textAlign: 'center' }}>
            <p style={{ fontSize: 10, letterSpacing: '0.2em', color: '#C9A96E', textTransform: 'uppercase' as const, marginBottom: 16 }}>
              Next Visit
            </p>
            {nextDate && (
              <p style={{ fontSize: 24, fontWeight: 200, color: '#FFFFFF', letterSpacing: '0.05em' }}>
                {nextDate}
              </p>
            )}
            {nextWeeks && (
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>{nextWeeks}</p>
            )}
            {!nextDate && nextRec && (
              <p style={{ fontSize: 13, color: '#FFFFFF', lineHeight: 1.7 }}>{nextRec}</p>
            )}
          </section>
        )}

        {/* 보호자 메시지 */}
        {comment && (
          <section style={{ background: '#FFFFFF', borderLeft: '2px solid #C9A96E', padding: '28px 24px', marginTop: 12 }}>
            <SH>Message</SH>
            <p style={{ fontSize: 13, color: '#0A0A0A', lineHeight: 2, whiteSpace: 'pre-wrap' }}>
              {comment}
            </p>
            <p style={{ fontSize: 10, color: '#C9A96E', textAlign: 'right', marginTop: 16, letterSpacing: '0.1em' }}>
              — DAZUL
            </p>
          </section>
        )}

        {/* CTA */}
        <div className="space-y-2" style={{ marginTop: 24, marginBottom: 12 }}>
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
