'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

// =============================================================
// DAZUL OS — 케어 히스토리 누적 테이블 (Numbers 스타일)
// =============================================================

type R = Record<string, unknown>

function s(obj: R, key: string): string {
  const v = obj[key]
  return typeof v === 'string' && v.trim() ? v.trim() : ''
}

/** id 등 숫자/문자 혼합 필드용 */
function idStr(obj: R, key: string): string {
  const v = obj[key]
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' || typeof v === 'bigint') return String(v)
  return ''
}

function parseGroomingStyle(obj: R): Record<string, string> {
  const gs = obj.grooming_style
  if (gs && typeof gs === 'object' && !Array.isArray(gs)) return gs as Record<string, string>
  return {}
}

function parseCondition(cond: string): Record<string, string> {
  const result: Record<string, string> = {}
  if (!cond) return result
  for (const part of cond.split('/').map((s) => s.trim())) {
    if (part.startsWith('눈:')) result.eyes = part.replace('눈:', '').trim()
    else if (part.startsWith('귀:')) result.ears = part.replace('귀:', '').trim()
    else if (part.startsWith('치아:')) result.teeth = part.replace('치아:', '').trim()
    else if (part.startsWith('발톱:')) result.nail = part.replace('발톱:', '').trim()
  }
  return result
}

function formatDate(v: string): string {
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatDateFull(v: string): string {
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// ─── 셀 스타일 상수 ───
const HD = { background: '#0A0A0A', color: '#FFFFFF', fontSize: 11, letterSpacing: '0.1em', fontWeight: 500 as const, padding: '8px 14px', whiteSpace: 'nowrap' as const, borderRight: '1px solid #2A2A2A' }
const GH = { ...HD, background: '#2A2A2A', textAlign: 'center' as const }
const TD = { fontSize: 12, padding: '10px 14px', whiteSpace: 'nowrap' as const, borderRight: '1px solid #E8E8E8', borderBottom: '1px solid #E8E8E8', verticalAlign: 'top' as const }
const STICKY = { position: 'sticky' as const, left: 0, zIndex: 2, background: '#FFFFFF', borderRight: '1px solid #E8E8E8', boxShadow: '2px 0 4px rgba(0,0,0,0.04)' }
const STICKY2 = { ...STICKY, left: 60 }
const GOLD = '#C9A96E'

export default function CareHistoryTable({
  records,
  petName,
  productCategoryMap = {},
}: {
  records: R[]
  petName: string
  productCategoryMap?: Record<string, string>
}) {
  const router = useRouter()
  const [hoverId, setHoverId] = useState<string | null>(null)

  // care_actions 에서 샴푸/스파/팩 항목만 추출
  function extractKeyProducts(raw: string): { label: string; value: string }[] {
    if (!raw) return []
    const out: Record<string, string[]> = { '샴푸': [], '스파': [], '팩': [] }
    for (const itemRaw of raw.split(',')) {
      const label = itemRaw.trim()
      if (!label) continue
      const productName = label.replace(/\s*\([^)]*\)\s*$/, '').trim()
      const cat = productCategoryMap[productName]
      if (cat && out[cat]) out[cat].push(productName)
    }
    return (['샴푸', '스파', '팩'] as const)
      .filter((k) => out[k].length > 0)
      .map((k) => ({ label: k, value: out[k].join(', ') }))
  }

  if (records.length === 0) {
    return (
      <section style={{ border: '1px solid #E8E8E8', padding: 40, textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: '#6B6B6B' }}>방문 기록이 아직 없습니다.</p>
      </section>
    )
  }

  const lastVisit = s(records[0], 'visit_date')

  // CSV 내보내기
  function handleCSV() {
    const headers = ['날짜', '몸무게', '관리내역', '스파/팩', '사용제품', '얼굴', '몸', '다리', '꼬리', '위생', '피부', '엉킴', '눈', '귀', '치아', '발톱', '내부메모']
    const rows = records.map((r) => {
      const gs = parseGroomingStyle(r)
      const cond = parseCondition(s(r, 'condition_status'))
      const svc = s(r, 'service') || s(r, 'service_type')
      const spa = s(r, 'spa_level')
      return [
        s(r, 'visit_date'),
        s(r, 'weight'),
        svc,
        spa,
        s(r, 'care_actions'),
        gs.face ?? '',
        gs.body ?? '',
        gs.legs ?? '',
        gs.tail ?? '',
        gs.sanitary ?? '',
        s(r, 'skin_status'),
        s(r, 'coat_status'),
        cond.eyes ?? '',
        cond.ears ?? '',
        cond.teeth ?? '',
        cond.nail ?? '',
        s(r, 'special_notes'),
      ].map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
    })

    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    a.href = url
    a.download = `${petName}_케어기록_${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#0A0A0A' }}>케어 히스토리</h2>
          <p style={{ fontSize: 12, color: '#6B6B6B', marginTop: 2 }}>
            총 {records.length}회 방문 · 마지막 방문 {formatDateFull(lastVisit)}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCSV}
          style={{
            border: '1px solid #0A0A0A',
            background: '#FFFFFF',
            color: '#0A0A0A',
            fontSize: 11,
            letterSpacing: '0.1em',
            fontWeight: 400,
            padding: '8px 16px',
            cursor: 'pointer',
          }}
        >
          CSV 내보내기
        </button>
      </div>

      {/* 테이블 */}
      <div style={{ overflowX: 'auto', border: '1px solid #E8E8E8' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 1400 }}>
          {/* 2단 헤더 */}
          <thead>
            {/* 1행: 그룹 헤더 */}
            <tr>
              <th style={{ ...HD, ...STICKY, width: 60 }} rowSpan={2}>날짜</th>
              <th style={{ ...HD, ...STICKY2, width: 50 }} rowSpan={2}>kg</th>
              <th style={{ ...GH }} colSpan={3}>오늘의 관리</th>
              <th style={{ ...GH }} colSpan={5}>미용 스타일</th>
              <th style={{ ...GH }} colSpan={6}>특이사항</th>
              <th style={{ ...HD }} rowSpan={2}>내부메모</th>
            </tr>
            {/* 2행: 세부 컬럼 */}
            <tr>
              <th style={HD}>서비스</th>
              <th style={HD}>스파/팩</th>
              <th style={HD}>사용제품</th>
              <th style={HD}>얼굴</th>
              <th style={HD}>몸</th>
              <th style={HD}>다리</th>
              <th style={HD}>꼬리</th>
              <th style={HD}>위생</th>
              <th style={HD}>피부</th>
              <th style={HD}>엉킴</th>
              <th style={HD}>눈</th>
              <th style={HD}>귀</th>
              <th style={HD}>치아</th>
              <th style={HD}>발톱</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => {
              const gs = parseGroomingStyle(r)
              const cond = parseCondition(s(r, 'condition_status'))
              const svc = s(r, 'service') || s(r, 'service_type')
              const spa = s(r, 'spa_level')
              const recordId = idStr(r, 'id')
              const rowKey = recordId || String(i)
              const isHover = hoverId === rowKey
              const baseBg = i % 2 === 1 ? '#FAFAFA' : '#FFFFFF'
              const oddBg = isHover ? '#FAFAF8' : baseBg
              const cell = { ...TD, background: oddBg }
              const hasIssue = (v: string) => v && !['좋음', '깨끗함', '없음', '적당함', '양호'].includes(v)

              return (
                <tr
                  key={rowKey}
                  onClick={() => recordId && router.push(`/session/edit/${recordId}`)}
                  onMouseEnter={() => setHoverId(rowKey)}
                  onMouseLeave={() => setHoverId((cur) => (cur === rowKey ? null : cur))}
                  style={{ cursor: recordId ? 'pointer' : 'default' }}
                >
                  <td style={{ ...cell, ...STICKY, background: oddBg, fontWeight: 500 }}>
                    {s(r, 'visit_date') ? formatDate(s(r, 'visit_date')) : '-'}
                  </td>
                  <td style={{ ...cell, ...STICKY2, background: oddBg }}>
                    {s(r, 'weight') || '-'}
                  </td>
                  <td style={cell}>{svc || '-'}</td>
                  <td style={{ ...cell, color: spa ? GOLD : undefined, fontWeight: spa ? 500 : 400 }}>
                    {spa || '-'}
                  </td>
                  <td style={{ ...cell, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(() => {
                      const items = extractKeyProducts(s(r, 'care_actions'))
                      if (items.length === 0) return '-'
                      return (
                        <span>
                          {items.map((it, idx) => (
                            <span key={it.label} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <span style={{ color: '#8A8A7A' }}>{it.label}:</span> {it.value}
                              {idx < items.length - 1 ? null : null}
                            </span>
                          ))}
                        </span>
                      )
                    })()}
                  </td>
                  <td style={cell}>{gs.face || '-'}</td>
                  <td style={cell}>{gs.body || '-'}</td>
                  <td style={cell}>{gs.legs || '-'}</td>
                  <td style={cell}>{gs.tail || '-'}</td>
                  <td style={cell}>{gs.sanitary || '-'}</td>
                  <td style={{ ...cell, color: hasIssue(s(r, 'skin_status')) ? GOLD : undefined }}>
                    {s(r, 'skin_status') || '-'}
                  </td>
                  <td style={{ ...cell, color: hasIssue(s(r, 'coat_status')) ? GOLD : undefined }}>
                    {s(r, 'coat_status') || '-'}
                  </td>
                  <td style={{ ...cell, color: hasIssue(cond.eyes ?? '') ? GOLD : undefined }}>
                    {cond.eyes || '-'}
                  </td>
                  <td style={{ ...cell, color: hasIssue(cond.ears ?? '') ? GOLD : undefined }}>
                    {cond.ears || '-'}
                  </td>
                  <td style={{ ...cell, color: hasIssue(cond.teeth ?? '') ? GOLD : undefined }}>
                    {cond.teeth || '-'}
                  </td>
                  <td style={{ ...cell, color: hasIssue(cond.nail ?? '') ? GOLD : undefined }}>
                    {cond.nail || '-'}
                  </td>
                  <td style={{ ...cell, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s(r, 'special_notes') || '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
