import { notFound } from 'next/navigation'
import { getReportData, type ReportData, type CareTip } from '@/actions/saveVisitRecord'

// =============================================================
// DAZUL OS — 보호자 리포트 페이지 (서버 컴포넌트)
// 인라인 스타일만 사용, 외부 CSS 없음
// =============================================================

type PageProps = { params: Promise<{ token: string }> }

// ─── 상수 ───

const SERVICE_LABEL: Record<string, string> = { bath: '목욕관리', full_grooming: '전체미용' }
const SPA_LABEL: Record<string, string> = { basic: '베이직', essential: '에센셜', signature: '시그니처', prestige: '프레스티지' }
const SPA_COLOR: Record<string, string> = { basic: '#B0BEC5', essential: '#81C784', signature: '#4FC3F7', prestige: '#FFD54F' }

const HEALTH_LABEL: Record<string, string> = { skin: '피부', tangles: '엉킴', eyes: '눈', ears: '귀', teeth: '치아', nail: '발톱' }
const HEALTH_ICON: Record<string, string> = { skin: '🐾', tangles: '🌀', eyes: '👁️', ears: '👂', teeth: '🦷', nail: '✂️' }

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

function getSpaDescription(level: string): string {
  const map: Record<string, string> = {
    basic: '클렌징 + 보습 기본 케어',
    essential: '딥클렌징 + 영양 집중 케어',
    signature: '전신 트리트먼트 프리미엄 케어',
    prestige: '프리미엄 풀케어 스페셜 코스',
  }
  return map[level] ?? ''
}

function isGoodStatus(value: string | null): boolean {
  if (!value) return true
  const good = ['좋음', '깨끗함', '없음', '적당함', 'clean', 'good']
  return good.some((g) => value.toLowerCase().includes(g))
}

// ─── 스타일 상수 ───

const colors = {
  navy: '#1a1f3a',
  navyLight: '#252b4a',
  gold: '#c8a97e',
  cream: '#faf8f5',
  warmGray: '#f5f2ee',
  text: '#2d2d2d',
  textMuted: '#7a7a7a',
  border: '#e8e2d9',
  green: '#2e7d32',
  greenBg: '#e8f5e9',
  orange: '#e65100',
  orangeBg: '#fff3e0',
  blue: '#1565c0',
  blueBg: '#e3f2fd',
  purple: '#6a1b9a',
  purpleBg: '#f3e5f5',
  yellow: '#f9a825',
  yellowBg: '#fffde7',
  kakao: '#FEE500',
}

const containerStyle: React.CSSProperties = { maxWidth: 600, margin: '0 auto', padding: '0 16px' }

// ─── 메인 페이지 ───

export default async function ReportPage({ params }: PageProps) {
  const { token } = await params
  if (!token) notFound()

  const result = await getReportData(token)

  if (result.error || (!result.data && !result.records?.length)) {
    notFound()
  }

  // 단건 또는 최신 1건
  const records = result.records ?? (result.data ? [result.data] : [])
  const latest = records[0]
  if (!latest) notFound()

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.cream, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* ─── 헤더 ─── */}
      <header style={{ backgroundColor: colors.navy, color: 'white', padding: '40px 16px 32px', textAlign: 'center' }}>
        <div style={containerStyle}>
          <p style={{ fontSize: 10, letterSpacing: '0.4em', color: colors.gold, fontWeight: 600, textTransform: 'uppercase' as const }}>DAZUL</p>
          <p style={{ fontSize: 8, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>HOLISTIC WELLNESS CARE</p>
          <div style={{ width: 40, height: 1, backgroundColor: colors.gold, margin: '20px auto' }} />
          {latest.petName && (
            <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: '0.05em', marginTop: 8 }}>
              {latest.petName}
              {latest.petBreed && <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginLeft: 8 }}>{latest.petBreed}</span>}
            </h1>
          )}
          {latest.visitDate && (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>{formatDate(latest.visitDate)}</p>
          )}
        </div>
      </header>

      {/* ─── 콘텐츠 ─── */}
      <main style={{ ...containerStyle, paddingTop: 24, paddingBottom: 80 }}>
        {records.map((record, idx) => (
          <div key={String(record.visitRecordId)} style={{ marginBottom: idx < records.length - 1 ? 32 : 0 }}>
            {/* 여러 건일 때 날짜 구분 */}
            {records.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ height: 1, flex: 1, backgroundColor: colors.border }} />
                <span style={{ fontSize: 12, color: colors.textMuted, fontWeight: 600 }}>{formatDate(record.visitDate)}</span>
                <div style={{ height: 1, flex: 1, backgroundColor: colors.border }} />
              </div>
            )}

            <ServiceSummaryCard record={record} />
            <PhotoGallery photos={record.photos} />
            <HealthCheckSection record={record} />
            {record.healthSummary && <HealthSummaryCard text={record.healthSummary} />}
            <CareTipsSection tips={record.careTips} />
            <NextVisitSection record={record} />
            <CommentSection comment={record.comment} />
            <NotesSection notes={record.specialNotes} />
          </div>
        ))}

        <CTASection />
      </main>

      {/* ─── 푸터 ─── */}
      <footer style={{ backgroundColor: colors.navy, color: 'rgba(255,255,255,0.5)', padding: '32px 16px', textAlign: 'center' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.3em', color: colors.gold }}>DAZUL</p>
        <p style={{ fontSize: 11, marginTop: 8 }}>소중한 가족을 믿고 맡겨주셔서 감사합니다.</p>
        <p style={{ fontSize: 10, marginTop: 12, color: 'rgba(255,255,255,0.3)' }}>© DAZUL · Premium Pet Care</p>
      </footer>
    </div>
  )
}

// ─── 서비스 요약 ───

function ServiceSummaryCard({ record }: { record: ReportData }) {
  const mainLabel = record.mainService ? (SERVICE_LABEL[record.mainService] ?? record.mainService) : null
  const spaLabel = record.spaLevel ? (SPA_LABEL[record.spaLevel] ?? record.spaLevel) : null
  const spaColor = record.spaLevel ? (SPA_COLOR[record.spaLevel] ?? colors.gold) : colors.gold

  if (!mainLabel && !spaLabel) return null

  return (
    <div style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, marginBottom: 16, border: `1px solid ${colors.border}` }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: colors.gold, textTransform: 'uppercase' as const, marginBottom: 12 }}>SERVICE</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {mainLabel && (
          <span style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 20, backgroundColor: colors.navy, color: 'white', fontSize: 13, fontWeight: 600 }}>
            {mainLabel}
          </span>
        )}
        {record.careActions && (
          <span style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 20, backgroundColor: colors.warmGray, color: colors.text, fontSize: 12 }}>
            {record.careActions}
          </span>
        )}
      </div>

      {spaLabel && (
        <div style={{ marginTop: 16, padding: 16, borderRadius: 12, backgroundColor: `${spaColor}15`, border: `1px solid ${spaColor}40` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>✨</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: colors.text }}>스파 {spaLabel}</p>
              <p style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>{getSpaDescription(record.spaLevel ?? '')}</p>
            </div>
          </div>
        </div>
      )}

      {record.careSummary && (
        <p style={{ marginTop: 12, fontSize: 13, color: colors.textMuted, lineHeight: 1.6 }}>{record.careSummary}</p>
      )}
    </div>
  )
}

// ─── 사진 ───

function PhotoGallery({ photos }: { photos: ReportData['photos'] }) {
  if (!photos || photos.length === 0) return null

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, borderRadius: 12, overflow: 'hidden' }}>
        {photos.map((photo) => (
          <div key={photo.id} style={{ aspectRatio: '1', backgroundColor: '#eee', position: 'relative' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.publicUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 건강 체크 ───

function HealthCheckSection({ record }: { record: ReportData }) {
  const hc = record.healthCheck
  const items = Object.entries(HEALTH_LABEL).map(([key, label]) => {
    const value = hc[key as keyof typeof hc]
    const good = isGoodStatus(value)
    return { key, label, icon: HEALTH_ICON[key], value, good }
  })

  const allGood = items.every((i) => i.good)
  const cautionItems = items.filter((i) => !i.good)
  const hasAnyData = items.some((i) => i.value)

  if (!hasAnyData) return null

  return (
    <div style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, marginBottom: 16, border: `1px solid ${colors.border}` }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: colors.gold, textTransform: 'uppercase' as const, marginBottom: 16 }}>HEALTH CHECK</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {items.filter((i) => i.value).map((item) => (
          <div
            key={item.key}
            style={{
              padding: '12px 8px',
              borderRadius: 12,
              textAlign: 'center',
              backgroundColor: item.good ? colors.greenBg : colors.orangeBg,
              border: `1px solid ${item.good ? '#c8e6c9' : '#ffe0b2'}`,
            }}
          >
            <p style={{ fontSize: 16, marginBottom: 4 }}>{item.icon}</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: item.good ? colors.green : colors.orange }}>{item.label}</p>
            <p style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>{item.value}</p>
          </div>
        ))}
      </div>

      {allGood && hasAnyData && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: colors.greenBg, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: colors.green, fontWeight: 600 }}>🎉 모든 항목이 양호해요!</p>
        </div>
      )}

      {cautionItems.length > 0 && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: colors.orangeBg, border: `1px solid #ffe0b2` }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: colors.orange, marginBottom: 8 }}>⚠️ 주의가 필요한 항목</p>
          {cautionItems.map((item) => (
            <p key={item.key} style={{ fontSize: 12, color: colors.text, lineHeight: 1.8 }}>
              {item.icon} <strong>{item.label}</strong>: {item.value}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 건강 요약 문장 ───

function HealthSummaryCard({ text }: { text: string }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, marginBottom: 16, border: `1px solid ${colors.border}` }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: colors.gold, textTransform: 'uppercase' as const, marginBottom: 12 }}>HEALTH SUMMARY</p>
      <pre style={{ fontSize: 13, color: colors.text, lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{text}</pre>
    </div>
  )
}

// ─── 케어팁 ───

function CareTipsSection({ tips }: { tips: CareTip[] }) {
  if (!tips || tips.length === 0) return null

  return (
    <div style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, marginBottom: 16, border: `1px solid ${colors.border}` }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: colors.gold, textTransform: 'uppercase' as const, marginBottom: 16 }}>HOME CARE TIPS</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tips.map((tip, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{tip.emoji}</span>
            <div>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, backgroundColor: colors.blueBg, color: colors.blue, fontSize: 10, fontWeight: 600, marginBottom: 4 }}>
                {tip.title}
              </span>
              <p style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.6 }}>{tip.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 다음 방문 ───

function NextVisitSection({ record }: { record: ReportData }) {
  const dateStr = record.nextVisitDate ?? record.nextVisitRecommendation
  if (!dateStr) return null

  let weeksLabel = ''
  if (record.nextVisitDate) {
    const diff = new Date(record.nextVisitDate).getTime() - Date.now()
    if (diff > 0) {
      const weeks = Math.ceil(diff / (1000 * 60 * 60 * 24 * 7))
      weeksLabel = `약 ${weeks}주 후`
    }
  }

  return (
    <div style={{ backgroundColor: colors.navy, borderRadius: 16, padding: 24, marginBottom: 16, textAlign: 'center', color: 'white' }}>
      <p style={{ fontSize: 10, letterSpacing: '0.2em', color: colors.gold, fontWeight: 600, textTransform: 'uppercase' as const }}>NEXT VISIT</p>
      <p style={{ fontSize: 20, fontWeight: 300, marginTop: 12 }}>
        {record.nextVisitDate ? formatDate(record.nextVisitDate) : dateStr}
      </p>
      {weeksLabel && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{weeksLabel}</p>}
    </div>
  )
}

// ─── 보호자 메시지 ───

function CommentSection({ comment }: { comment: string | null }) {
  if (!comment) return null

  return (
    <div style={{ borderRadius: 16, padding: 24, marginBottom: 16, backgroundColor: colors.yellowBg, borderLeft: `4px solid ${colors.yellow}` }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: colors.yellow, textTransform: 'uppercase' as const, marginBottom: 12 }}>MESSAGE</p>
      <p style={{ fontSize: 14, color: colors.text, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{comment}</p>
      <p style={{ fontSize: 11, color: colors.textMuted, marginTop: 12, textAlign: 'right' }}>— 살롱다즐 💛</p>
    </div>
  )
}

// ─── 특이사항/메모 ───

function NotesSection({ notes }: { notes: string | null }) {
  if (!notes) return null

  return (
    <div style={{ backgroundColor: 'white', borderRadius: 16, padding: 24, marginBottom: 16, border: `1px solid ${colors.border}` }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: colors.gold, textTransform: 'uppercase' as const, marginBottom: 12 }}>NOTES</p>
      <pre style={{ fontSize: 13, color: colors.text, lineHeight: 1.8, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{notes}</pre>
    </div>
  )
}

// ─── CTA ───

function CTASection() {
  return (
    <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <a
        href="https://pf.kakao.com/_placeholder"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '14px 24px', borderRadius: 12, backgroundColor: colors.kakao,
          color: '#3C1E1E', fontSize: 14, fontWeight: 700, textDecoration: 'none',
        }}
      >
        💬 카카오톡으로 예약하기
      </a>
      <a
        href="tel:010-1234-5678"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '14px 24px', borderRadius: 12, backgroundColor: colors.navy,
          color: 'white', fontSize: 14, fontWeight: 700, textDecoration: 'none',
        }}
      >
        📞 전화로 예약하기
      </a>
    </div>
  )
}
