'use client'

import { useMemo, useState } from 'react'

// =============================================================
// DAZUL OS — 반려견 건강 트렌드
// 몸무게 라인 차트 + 신체 상태 타임라인 + 지속 주의 알림
// =============================================================

type R = Record<string, unknown>

type Props = {
  records: R[]
}

const GOLD = '#C9A96E'
const INK = '#1A1A1A'
const SAGE = '#7A9E8A'
const SUB = '#8A8A7A'
const LINE = '#F0EDE8'
const BORDER = '#E8E5E0'

const NORMAL_KEYWORDS = ['좋음', '깨끗함', '없음', '적당함', '양호']

function isIssue(value: string | null | undefined): boolean {
  if (!value) return false
  return !NORMAL_KEYWORDS.some((g) => value.includes(g))
}

function num(obj: R, key: string): number | null {
  const v = obj[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function str(obj: R, key: string): string | null {
  const v = obj[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function fmtShort(dateStr: string): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return `${d.getFullYear().toString().slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// condition_status 파싱
function parseCond(s: string | null): Record<string, string | null> {
  const r: Record<string, string | null> = { eyes: null, ears: null, teeth: null, nail: null }
  if (!s) return r
  for (const p of s.split('/').map((x) => x.trim())) {
    if (p.startsWith('눈:')) r.eyes = p.slice(2).trim()
    else if (p.startsWith('귀:')) r.ears = p.slice(2).trim()
    else if (p.startsWith('치아:')) r.teeth = p.slice(3).trim()
    else if (p.startsWith('발톱:')) r.nail = p.slice(3).trim()
  }
  return r
}

function coatValue(raw: string | null): string | null {
  if (!raw) return null
  return raw.replace(/^\s*엉킴\s*:\s*/, '').trim() || null
}

// ─── 몸무게 차트 ───

function WeightChart({ points }: { points: { date: string; weight: number }[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  if (points.length < 2) return null

  const W = 600
  const H = 140
  const padX = 24
  const padY = 20
  const innerW = W - padX * 2
  const innerH = H - padY * 2

  const weights = points.map((p) => p.weight)
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const span = maxW - minW || 1
  // y 여유 10%
  const yMin = minW - span * 0.15
  const yMax = maxW + span * 0.15
  const ySpan = yMax - yMin || 1

  const coords = points.map((p, i) => {
    const x = padX + (i / (points.length - 1)) * innerW
    const y = padY + innerH - ((p.weight - yMin) / ySpan) * innerH
    return { x, y, ...p }
  })

  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ')

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* 기준선 */}
        <line x1={padX} y1={padY + innerH} x2={W - padX} y2={padY + innerH} stroke={LINE} strokeWidth={0.5} />
        {/* 라인 */}
        <path d={path} fill="none" stroke={INK} strokeWidth={1.25} />
        {/* 포인트 */}
        {coords.map((c, i) => (
          <g key={i}>
            <circle
              cx={c.x}
              cy={c.y}
              r={hoverIdx === i ? 5 : 3}
              fill={GOLD}
              stroke="#FFFFFF"
              strokeWidth={1.5}
              style={{ cursor: 'pointer', transition: 'r 0.2s' }}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx((cur) => (cur === i ? null : cur))}
            />
          </g>
        ))}
        {/* 축 라벨 */}
        {coords.map((c, i) => {
          // 첫/마지막만 표시해서 겹침 방지
          if (i !== 0 && i !== coords.length - 1) return null
          return (
            <text key={`lx-${i}`} x={c.x} y={H - 4} textAnchor="middle" fontSize={9} fill={SUB}>
              {fmtShort(c.date)}
            </text>
          )
        })}
      </svg>

      {/* 호버 툴팁 */}
      {hoverIdx !== null && (
        <div
          style={{
            position: 'absolute',
            left: `${(coords[hoverIdx].x / W) * 100}%`,
            top: 0,
            transform: 'translate(-50%, -100%)',
            background: INK,
            color: '#FFFFFF',
            padding: '4px 8px',
            fontSize: 10,
            letterSpacing: '0.05em',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {fmtShort(coords[hoverIdx].date)} · {coords[hoverIdx].weight} kg
        </div>
      )}
    </div>
  )
}

// ─── 신체 상태 타임라인 ───

type BodyKey = 'skin' | 'coat' | 'eyes' | 'ears' | 'teeth' | 'nail'
const BODY_LABELS: Record<BodyKey, string> = {
  skin: '피부',
  coat: '엉킴',
  eyes: '눈',
  ears: '귀',
  teeth: '치아',
  nail: '발톱',
}

function ConditionTimeline({
  records,
}: {
  records: { date: string; values: Record<BodyKey, string | null> }[]
}) {
  if (records.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {(Object.keys(BODY_LABELS) as BodyKey[]).map((key) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              minWidth: 40,
              fontSize: 11,
              color: SUB,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {BODY_LABELS[key]}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            {records.map((r, i) => {
              const v = r.values[key]
              const issue = isIssue(v)
              const hasData = v !== null
              return (
                <div
                  key={i}
                  title={`${fmtShort(r.date)} · ${v ?? '기록 없음'}`}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: !hasData ? 'transparent' : issue ? GOLD : SAGE,
                    border: !hasData ? `1px solid ${BORDER}` : 'none',
                    cursor: 'help',
                  }}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── 메인 컴포넌트 ───

export default function HealthTrend({ records }: Props) {
  // 날짜 오름차순 정렬 (오래된→최신)
  const ordered = useMemo(() => {
    return [...records]
      .filter((r) => str(r, 'visit_date'))
      .sort((a, b) => (str(a, 'visit_date') ?? '').localeCompare(str(b, 'visit_date') ?? ''))
  }, [records])

  // 몸무게 포인트
  const weightPoints = useMemo(() => {
    return ordered
      .map((r) => {
        const d = str(r, 'visit_date')
        const w = num(r, 'weight')
        if (!d || w === null) return null
        return { date: d, weight: w }
      })
      .filter((x): x is { date: string; weight: number } => x !== null)
  }, [ordered])

  // 최근 5회 (최신 → 과거 표시, 하지만 위 정렬은 오름차순이므로 역순으로 slice)
  const recent5 = useMemo(() => {
    const desc = [...ordered].reverse().slice(0, 5) // 최신 → 과거
    return desc
      .map((r) => {
        const date = str(r, 'visit_date')
        if (!date) return null
        const cond = parseCond(str(r, 'condition_status'))
        return {
          date,
          values: {
            skin: str(r, 'skin_status'),
            coat: coatValue(str(r, 'coat_status')),
            eyes: cond.eyes,
            ears: cond.ears,
            teeth: cond.teeth,
            nail: cond.nail,
          } as Record<BodyKey, string | null>,
        }
      })
      .filter((x): x is { date: string; values: Record<BodyKey, string | null> } => x !== null)
  }, [ordered])

  // 지속 주의 감지 — 최근 3회 연속 같은 부위 주의
  const alerts = useMemo(() => {
    if (recent5.length < 3) return []
    const result: string[] = []
    const keys = Object.keys(BODY_LABELS) as BodyKey[]
    for (const key of keys) {
      const lastThree = recent5.slice(0, 3)
      const allIssue = lastThree.every((r) => r.values[key] && isIssue(r.values[key]))
      if (allIssue) {
        result.push(`${BODY_LABELS[key]}가 지속적으로 주의 상태예요 (최근 3회 연속).`)
      }
    }
    return result
  }, [recent5])

  // 충분한 데이터 없음
  const hasWeight = weightPoints.length >= 2
  const hasCondition = recent5.length >= 1

  if (!hasWeight && !hasCondition) return null

  return (
    <section
      style={{
        border: `1px solid ${BORDER}`,
        padding: 24,
        background: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <p
        style={{
          fontSize: 11,
          letterSpacing: '0.15em',
          color: SUB,
          textTransform: 'uppercase',
        }}
      >
        건강 트렌드
      </p>

      {/* 지속 주의 알림 */}
      {alerts.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '10px 14px',
            background: '#FDFBF7',
            borderLeft: `2px solid ${GOLD}`,
          }}
        >
          {alerts.map((msg, i) => (
            <p key={i} style={{ fontSize: 12, color: GOLD, lineHeight: 1.6 }}>
              ⚠ {msg}
            </p>
          ))}
        </div>
      )}

      {/* 몸무게 차트 */}
      {hasWeight && (
        <div>
          <p style={{ fontSize: 11, color: SUB, letterSpacing: '0.1em', marginBottom: 12 }}>
            몸무게 변화 ({weightPoints.length}회)
          </p>
          <WeightChart points={weightPoints} />
        </div>
      )}

      {/* 신체 상태 타임라인 */}
      {hasCondition && (
        <div>
          <p style={{ fontSize: 11, color: SUB, letterSpacing: '0.1em', marginBottom: 12 }}>
            최근 신체 상태 추이 (최신 → 과거, 최대 5회)
          </p>
          <ConditionTimeline records={recent5} />
          <div
            style={{
              display: 'flex',
              gap: 16,
              marginTop: 12,
              fontSize: 10,
              color: SUB,
              letterSpacing: '0.05em',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: SAGE }} />
              정상
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: GOLD }} />
              주의
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'transparent',
                  border: `1px solid ${BORDER}`,
                }}
              />
              기록 없음
            </span>
          </div>
        </div>
      )}
    </section>
  )
}
