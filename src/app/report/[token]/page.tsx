import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

// =============================================================
// DAZUL OS — 보호자 리포트 페이지 (서버 컴포넌트)
// guardian.share_token 기반 최신 방문 기록 1건 표시
// =============================================================

type PageProps = { params: Promise<{ token: string }> }

// ─── Supabase (anon, 서버 사이드) ───

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// ─── 상수 ───

const SPA_LABEL: Record<string, string> = {
  basic: '베이직',
  premium: '에센셜',
  essential: '에센셜',
  deep: '시그니처',
  signature: '시그니처',
  prestige: '프레스티지',
}

const SPA_COLOR: Record<string, string> = {
  basic: '#B0BEC5',
  premium: '#81C784',
  essential: '#81C784',
  deep: '#4FC3F7',
  signature: '#4FC3F7',
  prestige: '#FFD54F',
}

const SPA_DESC: Record<string, string> = {
  basic: '클렌징 + 보습 기본 케어',
  premium: '딥클렌징 + 영양 집중 케어',
  essential: '딥클렌징 + 영양 집중 케어',
  deep: '전신 트리트먼트 프리미엄 케어',
  signature: '전신 트리트먼트 프리미엄 케어',
  prestige: '프리미엄 풀케어 스페셜 코스',
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

function weeksFromNow(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return ''
  const weeks = Math.ceil(diff / (1000 * 60 * 60 * 24 * 7))
  return `약 ${weeks}주 후`
}

/** condition_status 문자열에서 개별 항목 파싱 */
function parseCondition(condStr: string | null): Record<string, string | null> {
  const result: Record<string, string | null> = {
    eyes: null,
    ears: null,
    teeth: null,
    nail: null,
  }
  if (!condStr) return result

  const parts = condStr.split('/').map((s) => s.trim())
  for (const part of parts) {
    if (part.startsWith('눈:')) result.eyes = part.replace('눈:', '').trim()
    else if (part.startsWith('귀:')) result.ears = part.replace('귀:', '').trim()
    else if (part.startsWith('치아:')) result.teeth = part.replace('치아:', '').trim()
    else if (part.startsWith('발톱:')) result.nail = part.replace('발톱:', '').trim()
  }
  return result
}

function isGood(value: string | null): boolean {
  if (!value) return true
  const good = ['좋음', '깨끗함', '없음', '적당함', '양호', 'clean', 'good']
  return good.some((g) => value.toLowerCase().includes(g.toLowerCase()))
}

// ─── 페이지 ───

export default async function ReportPage({ params }: PageProps) {
  const { token } = await params
  if (!token) notFound()

  const supabase = getSupabase()

  // 1. share_token으로 보호자 조회
  const { data: guardian } = await supabase
    .from('guardians')
    .select('id, name')
    .eq('share_token', token)
    .maybeSingle()

  if (!guardian) notFound()

  // 2. 최신 방문 기록 1건
  const { data: record } = await supabase
    .from('visit_records')
    .select(
      'pet_name, staff_name, visit_date, service, service_type, spa_level, skin_status, coat_status, condition_status, next_visit_date, next_visit_recommendation, next_care_guide, note, comment',
    )
    .eq('guardian_id', guardian.id)
    .order('visit_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!record) notFound()

  // 파싱
  const petName = record.pet_name ?? '반려견'
  const visitDate = formatDate(record.visit_date)
  const service = record.service ?? record.service_type ?? null
  const spaLevel = record.spa_level as string | null
  const spaLabel = spaLevel ? SPA_LABEL[spaLevel] ?? spaLevel : null
  const spaColor = spaLevel ? SPA_COLOR[spaLevel] ?? '#C9A96E' : '#C9A96E'
  const spaDesc = spaLevel ? SPA_DESC[spaLevel] ?? '' : ''

  // 신체 상태
  const cond = parseCondition(record.condition_status)
  const healthItems = [
    { key: 'skin', label: '피부', icon: '🐾', value: record.skin_status },
    { key: 'tangles', label: '엉킴', icon: '🌀', value: record.coat_status },
    { key: 'eyes', label: '눈', icon: '👁️', value: cond.eyes },
    { key: 'ears', label: '귀', icon: '👂', value: cond.ears },
    { key: 'teeth', label: '치아', icon: '🦷', value: cond.teeth },
    { key: 'nail', label: '발톱', icon: '✂️', value: cond.nail },
  ]
  const hasHealthData = healthItems.some((i) => i.value)
  const allGood = healthItems.every((i) => isGood(i.value))

  // 케어팁
  const careTips = record.next_care_guide
    ? record.next_care_guide
        .split('\n')
        .map((s: string) => s.trim())
        .filter(Boolean)
    : []

  // 다음 방문
  const nextDate = record.next_visit_date ?? null
  const nextDateStr = nextDate ? formatDate(nextDate) : null
  const nextWeeks = nextDate ? weeksFromNow(nextDate) : ''

  // 보호자 메시지
  const comment = record.comment ?? null

  // 담당자
  const staffName = record.staff_name ?? null

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* ─── 헤더 ─── */}
      <header className="bg-[#1A2B4A] px-4 pb-8 pt-10 text-center text-white">
        <div className="mx-auto max-w-lg">
          <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-[#C9A96E]">
            DAZUL
          </p>
          <p className="mt-1 text-[8px] tracking-[0.2em] text-white/30">
            HOLISTIC WELLNESS CARE
          </p>
          <div className="mx-auto mt-5 h-px w-10 bg-[#C9A96E]" />
          <h1 className="mt-4 text-2xl font-light tracking-wide">{petName}</h1>
          {visitDate && (
            <p className="mt-2 text-xs text-white/50">{visitDate} 케어 리포트</p>
          )}
        </div>
      </header>

      {/* ─── 콘텐츠 ─── */}
      <main className="mx-auto max-w-lg px-4 pb-20 pt-6">
        {/* 서비스 요약 */}
        {service && (
          <section className="mb-4 rounded-2xl border border-[#E8E2D9] bg-white p-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#C9A96E]">
              SERVICE
            </p>
            <span className="inline-block rounded-full bg-[#1A2B4A] px-4 py-2 text-xs font-semibold text-white">
              {service}
            </span>

            {spaLabel && (
              <div
                className="mt-4 rounded-xl p-4"
                style={{
                  backgroundColor: `${spaColor}15`,
                  border: `1px solid ${spaColor}40`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">✨</span>
                  <div>
                    <p className="text-sm font-bold text-[#2D2D2D]">
                      스파 {spaLabel}
                    </p>
                    {spaDesc && (
                      <p className="mt-0.5 text-[11px] text-[#7A7A7A]">
                        {spaDesc}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 신체 상태 */}
        {hasHealthData && (
          <section className="mb-4 rounded-2xl border border-[#E8E2D9] bg-white p-5">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#C9A96E]">
              HEALTH CHECK
            </p>
            <div className="grid grid-cols-3 gap-2">
              {healthItems.map((item) => {
                const good = isGood(item.value)
                return (
                  <div
                    key={item.key}
                    className={`rounded-xl border p-3 text-center ${
                      good
                        ? 'border-green-200 bg-green-50'
                        : 'border-orange-200 bg-orange-50'
                    }`}
                  >
                    <p className="text-base">{item.icon}</p>
                    <p
                      className={`mt-1 text-[11px] font-semibold ${
                        good ? 'text-green-700' : 'text-orange-700'
                      }`}
                    >
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[#7A7A7A]">
                      {item.value ?? '정상'}
                    </p>
                  </div>
                )
              })}
            </div>

            {allGood && (
              <div className="mt-4 rounded-xl bg-green-50 p-3 text-center">
                <p className="text-sm font-semibold text-green-700">
                  모든 부위가 건강해요 🎉
                </p>
              </div>
            )}

            {!allGood && (
              <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-3">
                <p className="mb-1 text-xs font-semibold text-orange-700">
                  ⚠️ 주의 항목
                </p>
                {healthItems
                  .filter((i) => !isGood(i.value))
                  .map((i) => (
                    <p
                      key={i.key}
                      className="text-xs leading-6 text-[#2D2D2D]"
                    >
                      {i.icon} <strong>{i.label}</strong>: {i.value}
                    </p>
                  ))}
              </div>
            )}
          </section>
        )}

        {/* 케어팁 */}
        {careTips.length > 0 && (
          <section className="mb-4 rounded-2xl border border-[#E8E2D9] bg-white p-5">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#C9A96E]">
              HOME CARE TIPS
            </p>
            <div className="space-y-2.5">
              {careTips.map((tip: string, i: number) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5"
                >
                  <span className="mt-0.5 shrink-0 text-blue-400">💡</span>
                  <p className="text-xs leading-5 text-blue-800">{tip}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 다음 방문 */}
        {nextDateStr && (
          <section className="mb-4 rounded-2xl bg-[#1A2B4A] p-6 text-center text-white">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C9A96E]">
              NEXT VISIT
            </p>
            <p className="mt-3 text-xl font-light">{nextDateStr}</p>
            {nextWeeks && (
              <p className="mt-1 text-xs text-white/50">{nextWeeks}</p>
            )}
          </section>
        )}

        {/* 보호자 메시지 */}
        {comment && (
          <section className="mb-4 rounded-2xl border-l-4 border-yellow-400 bg-[#FFFDE7] p-5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-600">
              MESSAGE
            </p>
            <p className="whitespace-pre-wrap text-sm leading-7 text-[#2D2D2D]">
              {comment}
            </p>
            <p className="mt-3 text-right text-[11px] text-[#7A7A7A]">
              — 살롱다즐 💛
            </p>
          </section>
        )}

        {/* 담당자 */}
        {staffName && (
          <p className="mb-6 text-center text-xs text-[#7A7A7A]">
            {staffName}이 케어했어요 🐾
          </p>
        )}

        {/* CTA */}
        <div className="mt-8 flex flex-col gap-2">
          <a
            href="#"
            className="flex items-center justify-center gap-2 rounded-xl bg-[#FAE300] px-6 py-3.5 text-sm font-bold text-[#3B1E08] transition-colors hover:bg-[#F5D800]"
          >
            💬 카카오톡 문의
          </a>
          <a
            href="#"
            className="flex items-center justify-center gap-2 rounded-xl bg-[#1A2B4A] px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#152340]"
          >
            📞 전화 예약
          </a>
        </div>
      </main>

      {/* ─── 푸터 ─── */}
      <footer className="border-t border-[#E8E2D9] bg-white py-8 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#B0A89C]">
          DAZUL 반려견 케어 살롱
        </p>
      </footer>
    </div>
  )
}
