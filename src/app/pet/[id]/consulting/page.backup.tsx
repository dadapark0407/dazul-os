"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

type ConsultingVisitRecord = {
  id?: string
  pet_id?: string
  guardian_id?: string
  visit_date?: string | null
  service_menu?: string | null
  skin_status?: string | null
  coat_status?: string | null
  condition_status?: string | null
  stress_status?: string | null
  special_notes?: string | null
  next_visit_recommendation?: string | null
}

type ConsultingPet = {
  id?: string
  name?: string | null
  guardian_id?: string | null
}

type ConsultingGuardian = {
  id?: string
  name?: string | null
  guardian_name?: string | null
}

type ConsultingResult = {
  petName: string
  guardianName: string
  latestVisitDateText: string
  visitCount: number
  averageCycleText: string
  routineType: string
  elapsedDaysText: string
  summaryLine: string
  flowSummary: string
  careRecommendation: string
  rebookingRecommendation: string
  openingMent: string
  consultationMent: string
  closingMent: string
  shortStaffMemo: string
  copyText: string
}

function formatDateKorean(dateString?: string | null) {
  if (!dateString) return "기록 없음"

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return "기록 없음"

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  return `${year}.${month}.${day}`
}

function getDaysBetween(a?: string | null, b?: string | null) {
  if (!a || !b) return null

  const dateA = new Date(a)
  const dateB = new Date(b)

  if (Number.isNaN(dateA.getTime()) || Number.isNaN(dateB.getTime())) return null

  const diff = Math.abs(dateA.getTime() - dateB.getTime())
  return Math.round(diff / (1000 * 60 * 60 * 24))
}

function getAverageVisitCycle(records: ConsultingVisitRecord[]) {
  if (records.length < 2) return null

  const sorted = [...records]
    .filter((record) => record.visit_date)
    .sort((a, b) => {
      return new Date(b.visit_date as string).getTime() - new Date(a.visit_date as string).getTime()
    })

  const gaps: number[] = []

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index]
    const next = sorted[index + 1]
    const gap = getDaysBetween(current.visit_date, next.visit_date)

    if (gap !== null) {
      gaps.push(gap)
    }
  }

  if (gaps.length === 0) return null

  const total = gaps.reduce((sum, value) => sum + value, 0)
  return Math.round(total / gaps.length)
}

function getRoutineType(records: ConsultingVisitRecord[]) {
  if (records.length < 2) return "판정 불가"

  const sorted = [...records]
    .filter((record) => record.visit_date)
    .sort((a, b) => {
      return new Date(b.visit_date as string).getTime() - new Date(a.visit_date as string).getTime()
    })

  const recentGaps: number[] = []

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index]
    const next = sorted[index + 1]
    const gap = getDaysBetween(current.visit_date, next.visit_date)

    if (gap !== null) {
      recentGaps.push(gap)
    }

    if (recentGaps.length === 3) {
      break
    }
  }

  if (recentGaps.length === 0) return "판정 불가"

  const isAllOneWeek = recentGaps.every((gap) => gap >= 5 && gap <= 9)
  const isAllTwoWeek = recentGaps.every((gap) => gap >= 10 && gap <= 17)
  const isAllThreeWeek = recentGaps.every((gap) => gap >= 18 && gap <= 24)
  const isAllFourWeek = recentGaps.every((gap) => gap >= 25 && gap <= 38)

  if (isAllOneWeek) return "1주 루틴"
  if (isAllTwoWeek) return "2주 루틴"
  if (isAllThreeWeek) return "3주 루틴"
  if (isAllFourWeek) return "4주 루틴"

  const includesShort = recentGaps.some((gap) => gap >= 5 && gap <= 17)
  const includesLong = recentGaps.some((gap) => gap >= 18 && gap <= 38)

  if (includesShort && includesLong) return "혼합 루틴"

  return "불규칙"
}

function getElapsedDaysFromLastVisit(records: ConsultingVisitRecord[]) {
  if (records.length === 0) return null

  const sorted = [...records]
    .filter((record) => record.visit_date)
    .sort((a, b) => {
      return new Date(b.visit_date as string).getTime() - new Date(a.visit_date as string).getTime()
    })

  const latest = sorted[0]
  if (!latest?.visit_date) return null

  const today = new Date()
  const latestDate = new Date(latest.visit_date)

  if (Number.isNaN(latestDate.getTime())) return null

  const diff = today.getTime() - latestDate.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function getLatestRecord(records: ConsultingVisitRecord[]) {
  if (records.length === 0) return null

  const sorted = [...records]
    .filter((record) => record.visit_date)
    .sort((a, b) => {
      return new Date(b.visit_date as string).getTime() - new Date(a.visit_date as string).getTime()
    })

  return sorted[0] ?? null
}

function mapConditionLabel(value?: string | null) {
  switch (value) {
    case "very_good":
      return "매우 좋음"
    case "good":
      return "좋음"
    case "normal":
      return "보통"
    case "low":
      return "저하"
    default:
      return value || "기록 없음"
  }
}

function mapStressLabel(value?: string | null) {
  switch (value) {
    case "very_stable":
      return "매우 안정"
    case "stable":
      return "안정"
    case "normal":
      return "보통"
    case "high":
      return "높음"
    default:
      return value || "기록 없음"
  }
}

function makeFlowSummary(records: ConsultingVisitRecord[]) {
  if (records.length === 0) {
    return "방문 기록이 아직 충분하지 않아 변화 흐름 분석은 보류합니다."
  }

  const latest = getLatestRecord(records)
  if (!latest) {
    return "방문 기록이 아직 충분하지 않아 변화 흐름 분석은 보류합니다."
  }

  const skin = latest.skin_status?.trim()
  const coat = latest.coat_status?.trim()
  const condition = mapConditionLabel(latest.condition_status)
  const stress = mapStressLabel(latest.stress_status)

  const parts: string[] = []

  if (skin) parts.push(`피부 상태는 ${skin}`)
  if (coat) parts.push(`모질 상태는 ${coat}`)
  parts.push(`컨디션은 ${condition}`)
  parts.push(`긴장도는 ${stress}`)

  return `${parts.join(", ")}로 기록되었습니다.`
}

function makeCareRecommendation(records: ConsultingVisitRecord[]) {
  const latest = getLatestRecord(records)

  if (!latest) {
    return "기록이 더 쌓이면 맞춤 케어 추천 정확도가 올라갑니다."
  }

  const notes = latest.special_notes?.trim()
  const nextRecommendation = latest.next_visit_recommendation?.trim()
  const stress = latest.stress_status
  const condition = latest.condition_status

  if (nextRecommendation) {
    return nextRecommendation
  }

  if (stress === "high") {
    return "다음 방문 때는 짧고 안정적인 케어 흐름으로 진행하고, 익숙한 루틴 안에서 부담을 줄이는 방향을 추천합니다."
  }

  if (condition === "low") {
    return "다음 방문 때는 전체 미용 완성도보다 컨디션 안정을 우선으로 두고 무리 없는 케어를 추천합니다."
  }

  if (notes) {
    return `최근 특이사항을 기준으로 보면 "${notes}" 부분을 다음 방문에서도 이어서 체크하는 것이 좋습니다.`
  }

  return "현재 기록 기준으로는 컨디션 유지 중심의 안정적인 웰니스 케어를 추천합니다."
}

function makeRebookingRecommendation(records: ConsultingVisitRecord[]) {
  const routineType = getRoutineType(records)
  const elapsedDays = getElapsedDaysFromLastVisit(records)
  const averageCycle = getAverageVisitCycle(records)

  if (elapsedDays === null) {
    return "다음 방문 시점은 방문 기록이 더 쌓이면 더 정확하게 추천할 수 있습니다."
  }

  if (routineType === "1주 루틴") {
    if (elapsedDays >= 7) return "현재 시점에서는 이번 주 안에 다음 방문 일정을 잡는 것을 권장합니다."
    return "현재 루틴은 1주 간격으로 유지하는 것이 가장 자연스럽습니다."
  }

  if (routineType === "2주 루틴") {
    if (elapsedDays >= 14) return "현재 시점에서는 바로 다음 예약을 잡는 것이 좋습니다."
    return "현재 루틴은 2주 간격 유지가 적절해 보입니다."
  }

  if (routineType === "3주 루틴") {
    if (elapsedDays >= 21) return "현재 시점에서는 다음 방문 일정을 잡아도 좋은 시점입니다."
    return "현재 루틴은 3주 전후로 유지하는 것이 적절해 보입니다."
  }

  if (routineType === "4주 루틴") {
    if (elapsedDays >= 28) return "현재 시점에서는 다음 방문 일정을 잡는 것을 권장합니다."
    return "현재 루틴은 4주 전후로 유지하는 것이 적절해 보입니다."
  }

  if (routineType === "혼합 루틴") {
    return "방문 간격이 일정하지 않기 때문에 아이 상태와 계절, 스타일 유지 정도를 함께 보고 다음 예약을 잡는 것을 추천합니다."
  }

  if (averageCycle !== null) {
    return `평균 방문 주기는 약 ${averageCycle}일이므로 그 전후로 다음 예약을 잡는 것을 추천합니다.`
  }

  return "현재 기록만으로는 재방문 주기 추천이 어렵습니다."
}

function generateConsultingMent(
  pet: ConsultingPet | null,
  guardian: ConsultingGuardian | null,
  records: ConsultingVisitRecord[]
): ConsultingResult {
  const petName = pet?.name?.trim() || "아이"
  const guardianName =
    guardian?.name?.trim() ||
    guardian?.guardian_name?.trim() ||
    "보호자님"

  const latest = getLatestRecord(records)
  const averageCycle = getAverageVisitCycle(records)
  const routineType = getRoutineType(records)
  const elapsedDays = getElapsedDaysFromLastVisit(records)

  const averageCycleText =
    averageCycle !== null ? `약 ${averageCycle}일` : "분석 데이터 부족"

  const elapsedDaysText =
    elapsedDays !== null ? `${elapsedDays}일` : "계산 불가"

  const latestVisitDateText = latest?.visit_date
    ? formatDateKorean(latest.visit_date)
    : "기록 없음"

  const flowSummary = makeFlowSummary(records)
  const careRecommendation = makeCareRecommendation(records)
  const rebookingRecommendation = makeRebookingRecommendation(records)

  const summaryLine =
    latest
      ? `${petName}의 최근 방문은 ${latestVisitDateText}이며, 현재까지 총 ${records.length}회 기록되었습니다.`
      : `${petName}의 방문 기록이 아직 충분하지 않습니다.`

  const openingMent = `${guardianName}, ${petName}는 지금까지의 방문 기록을 보면 ${routineType} 성향으로 보이고, 최근 방문 간격 기준으로는 ${averageCycleText} 정도 흐름으로 확인됩니다.`

  const consultationMent = `${flowSummary} 오늘 상담에서는 아이가 무리하지 않게 받을 수 있는 케어 흐름을 우선으로 보고, ${careRecommendation}`

  const closingMent = `${rebookingRecommendation} 마지막 방문 후 현재 ${elapsedDaysText}가 지나 있어서, 이번 예약 흐름도 함께 참고하시면 좋겠습니다.`

  const shortStaffMemo = `최근 방문 ${latestVisitDateText} / 루틴 ${routineType} / 평균 주기 ${averageCycleText} / 경과일 ${elapsedDaysText}`

  const copyText = [
    `${guardianName}, 안녕하세요 :)`,
    "",
    openingMent,
    consultationMent,
    closingMent,
  ].join("\n")

  return {
    petName,
    guardianName,
    latestVisitDateText,
    visitCount: records.length,
    averageCycleText,
    routineType,
    elapsedDaysText,
    summaryLine,
    flowSummary,
    careRecommendation,
    rebookingRecommendation,
    openingMent,
    consultationMent,
    closingMent,
    shortStaffMemo,
    copyText,
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function PetConsultingPage() {
  const params = useParams()
  const petId = params?.id as string

  const [pet, setPet] = useState<ConsultingPet | null>(null)
  const [guardian, setGuardian] = useState<ConsultingGuardian | null>(null)
  const [records, setRecords] = useState<ConsultingVisitRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function fetchData() {
      if (!petId) return

      try {
        setLoading(true)
        setError("")

        const { data: petData, error: petError } = await supabase
          .from("pets")
          .select("*")
          .eq("id", petId)
          .single()

        if (petError) {
          throw petError
        }

        setPet(petData)

        if (petData?.guardian_id) {
          const { data: guardianData, error: guardianError } = await supabase
            .from("guardians")
            .select("*")
            .eq("id", petData.guardian_id)
            .single()

          if (!guardianError) {
            setGuardian(guardianData)
          }
        }

        const { data: visitData, error: visitError } = await supabase
          .from("visit_records")
          .select("*")
          .eq("pet_id", petId)
          .order("visit_date", { ascending: false })

        if (visitError) {
          throw visitError
        }

        setRecords(visitData || [])
      } catch (fetchError) {
        console.error(fetchError)
        setError("상담 멘트 데이터를 불러오는 중 오류가 발생했습니다.")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [petId])

  const result = useMemo(() => {
    return generateConsultingMent(pet, guardian, records)
  }, [pet, guardian, records])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(result.copyText)
      alert("상담 멘트가 복사되었습니다.")
    } catch (copyError) {
      console.error(copyError)
      alert("복사 중 오류가 발생했습니다.")
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <h1 style={styles.title}>상담 멘트 자동 생성</h1>
          <p style={styles.muted}>데이터를 불러오는 중입니다...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <h1 style={styles.title}>상담 멘트 자동 생성</h1>
          <p style={styles.error}>{error}</p>
          <Link href={`/pet/${petId}`} style={styles.linkButton}>
            반려견 페이지로 돌아가기
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>상담 멘트 자동 생성</h1>
            <p style={styles.subtitle}>
              직원이 바로 읽을 수 있도록 자동으로 정리한 상담용 문장입니다.
            </p>
          </div>

          <div style={styles.headerButtonGroup}>
            <Link href={`/pet/${petId}`} style={styles.secondaryButton}>
              반려견 페이지
            </Link>
            <button onClick={handleCopy} style={styles.primaryButton}>
              상담 멘트 복사
            </button>
          </div>
        </div>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>기본 요약</h2>
          <div style={styles.grid}>
            <InfoBox label="반려견 이름" value={result.petName} />
            <InfoBox label="보호자" value={result.guardianName} />
            <InfoBox label="최근 방문일" value={result.latestVisitDateText} />
            <InfoBox label="총 방문 횟수" value={`${result.visitCount}회`} />
            <InfoBox label="평균 방문 주기" value={result.averageCycleText} />
            <InfoBox label="방문 루틴" value={result.routineType} />
            <InfoBox label="마지막 방문 후 경과일" value={result.elapsedDaysText} />
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>직원용 한줄 메모</h2>
          <div style={styles.memoBox}>{result.shortStaffMemo}</div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>상담 구조</h2>

          <div style={styles.sectionBlock}>
            <h3 style={styles.sectionTitle}>1. 오프닝 멘트</h3>
            <p style={styles.paragraph}>{result.openingMent}</p>
          </div>

          <div style={styles.sectionBlock}>
            <h3 style={styles.sectionTitle}>2. 상담 핵심 멘트</h3>
            <p style={styles.paragraph}>{result.consultationMent}</p>
          </div>

          <div style={styles.sectionBlock}>
            <h3 style={styles.sectionTitle}>3. 마무리 멘트</h3>
            <p style={styles.paragraph}>{result.closingMent}</p>
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>분석 내용</h2>

          <div style={styles.sectionBlock}>
            <h3 style={styles.sectionTitle}>방문 요약</h3>
            <p style={styles.paragraph}>{result.summaryLine}</p>
          </div>

          <div style={styles.sectionBlock}>
            <h3 style={styles.sectionTitle}>변화 흐름 요약</h3>
            <p style={styles.paragraph}>{result.flowSummary}</p>
          </div>

          <div style={styles.sectionBlock}>
            <h3 style={styles.sectionTitle}>자동 케어 추천</h3>
            <p style={styles.paragraph}>{result.careRecommendation}</p>
          </div>

          <div style={styles.sectionBlock}>
            <h3 style={styles.sectionTitle}>재방문 추천</h3>
            <p style={styles.paragraph}>{result.rebookingRecommendation}</p>
          </div>
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>보호자 전달용 복사본</h2>
          <textarea readOnly value={result.copyText} style={styles.textarea} />
        </section>
      </div>
    </main>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoBox}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f7f7f5",
    padding: "32px 16px",
  },
  container: {
    maxWidth: "1100px",
    margin: "0 auto",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "24px",
  },
  title: {
    fontSize: "32px",
    fontWeight: 700,
    margin: 0,
    color: "#1f2937",
  },
  subtitle: {
    marginTop: "8px",
    marginBottom: 0,
    color: "#6b7280",
    lineHeight: 1.6,
  },
  headerButtonGroup: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "20px",
    padding: "24px",
    marginBottom: "20px",
    border: "1px solid #e5e7eb",
    boxShadow: "0 6px 20px rgba(0,0,0,0.04)",
  },
  cardTitle: {
    fontSize: "22px",
    fontWeight: 700,
    marginTop: 0,
    marginBottom: "18px",
    color: "#111827",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  infoBox: {
    padding: "16px",
    borderRadius: "14px",
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
  },
  infoLabel: {
    fontSize: "13px",
    color: "#6b7280",
    marginBottom: "8px",
  },
  infoValue: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#111827",
  },
  sectionBlock: {
    marginBottom: "18px",
  },
  sectionTitle: {
    fontSize: "16px",
    fontWeight: 700,
    marginTop: 0,
    marginBottom: "8px",
    color: "#374151",
  },
  paragraph: {
    margin: 0,
    lineHeight: 1.8,
    color: "#1f2937",
    whiteSpace: "pre-wrap",
  },
  memoBox: {
    padding: "16px",
    borderRadius: "14px",
    backgroundColor: "#fef3c7",
    color: "#92400e",
    fontWeight: 600,
    lineHeight: 1.7,
  },
  textarea: {
    width: "100%",
    minHeight: "220px",
    borderRadius: "14px",
    border: "1px solid #d1d5db",
    padding: "16px",
    fontSize: "15px",
    lineHeight: 1.7,
    resize: "vertical",
    boxSizing: "border-box",
    backgroundColor: "#fcfcfc",
  },
  primaryButton: {
    border: "none",
    backgroundColor: "#111827",
    color: "#ffffff",
    padding: "12px 18px",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    textDecoration: "none",
    backgroundColor: "#ffffff",
    color: "#111827",
    padding: "12px 18px",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: 700,
    border: "1px solid #d1d5db",
  },
  linkButton: {
    display: "inline-block",
    textDecoration: "none",
    backgroundColor: "#111827",
    color: "#ffffff",
    padding: "12px 18px",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: 700,
    marginTop: "12px",
  },
  muted: {
    color: "#6b7280",
  },
  error: {
    color: "#dc2626",
    fontWeight: 600,
  },
}