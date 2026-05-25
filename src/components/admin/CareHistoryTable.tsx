'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

// =============================================================
// DAZUL OS — 케어 히스토리 누적 테이블 (Numbers 스타일)
// =============================================================

type R = Record<string, unknown>

function s(obj: R, key: string): string {
  const v = obj[key]
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v === 'bigint') return String(v)
  return ''
}

/** 몸무게 포맷: 값 있으면 'N kg', 없으면 빈 문자열 */
function fmtWeight(obj: R): string {
  const raw = s(obj, 'weight')
  if (!raw) return ''
  // 이미 'kg' 포함되어 있으면 그대로
  if (/kg/i.test(raw)) return raw
  return `${raw} kg`
}

/** id 등 숫자/문자 혼합 필드용 */
function idStr(obj: R, key: string): string {
  const v = obj[key]
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' || typeof v === 'bigint') return String(v)
  return ''
}

// spa_level 한글 라벨 변환 (표시용 축약 — DB는 원본 그대로)
const SPA_LABEL_MAP: Record<string, string> = {
  basic: '베이직',
  premium: '에센셜',
  essential: '에센셜',
  deep: '시그니처',
  signature: '시그니처',
  prestige: '프레스티지',
}
function fmtSpa(raw: string): string {
  return SPA_LABEL_MAP[raw] ?? raw
}

// 서비스명 축약 (표시용 — DB는 원본 그대로)
const SVC_LABEL_MAP: Record<string, string> = {
  '전체미용': '미용',
  '목욕관리': '목욕',
}
function fmtSvc(raw: string): string {
  return SVC_LABEL_MAP[raw] ?? raw
}

function parseGroomingStyle(obj: R): Record<string, string> {
  const gs = obj.grooming_style
  if (gs && typeof gs === 'object' && !Array.isArray(gs)) return gs as Record<string, string>
  return {}
}

// skin_status 등 "항목1, 항목2(메모), ..." 형식 파싱
function parseItemsWithMemos(raw: string): { items: string[]; memos: Record<string, string> } {
  const items: string[] = []
  const memos: Record<string, string> = {}
  if (!raw) return { items, memos }
  for (const part of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^(.+?)\((.+)\)$/)
    if (m) {
      const key = m[1].trim()
      items.push(key)
      memos[key] = m[2].trim()
    } else {
      items.push(part)
    }
  }
  return { items, memos }
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
const STICKY = { position: 'sticky' as const, left: 0, zIndex: 2, background: '#FAFAF8', borderRight: '1px solid #E8E5E0', boxShadow: '2px 0 4px rgba(0,0,0,0.04)' }
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
  const [modal, setModal] = useState<{ rec: R; type: 'products' | 'style' | 'health' } | null>(null)

  // care_actions 에서 샴푸/스파/팩 카테고리별 제품명 추출
  function extractProductsByCategory(raw: string): { 샴푸: string[]; 스파: string[]; 팩: string[] } {
    const out: { 샴푸: string[]; 스파: string[]; 팩: string[] } = { 샴푸: [], 스파: [], 팩: [] }
    if (!raw) return out
    for (const itemRaw of raw.split(',')) {
      const label = itemRaw.trim()
      if (!label) continue
      const productName = label.replace(/\s*\([^)]*\)\s*$/, '').trim()
      const cat = productCategoryMap[productName]
      if (cat === '샴푸' || cat === '스파' || cat === '팩') {
        out[cat].push(productName)
      }
    }
    return out
  }

  // care_actions 에서 모든 카테고리별 제품명 추출 (팝업용)
  function extractAllProducts(raw: string): Record<string, string[]> {
    const out: Record<string, string[]> = {}
    if (!raw) return out
    for (const itemRaw of raw.split(',')) {
      const label = itemRaw.trim()
      if (!label) continue
      const productName = label.replace(/\s*\([^)]*\)\s*$/, '').trim()
      const cat = productCategoryMap[productName] || '기타'
      if (!out[cat]) out[cat] = []
      out[cat].push(productName)
    }
    return out
  }

  // 미용 스타일 부위 라벨
  const STYLE_LABELS: Array<[string, string]> = [
    ['face', '얼굴'],
    ['body', '몸'],
    ['legs', '다리'],
    ['tail', '꼬리'],
    ['sanitary', '위생'],
    ['ears', '귀'],
    ['head', '머리'],
    ['mustache', '수염'],
  ]

  // 팝업용 날짜 헤더
  function fmtPopupDate(v: string, suffix = '케어 기록'): string {
    const d = new Date(v)
    if (isNaN(d.getTime())) return v
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()} ${suffix}`
  }

  // 클릭 가능한 셀의 추가 스타일
  const CLICKABLE = { cursor: 'pointer' as const }

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
        fmtWeight(r),
        svc,
        spa ? fmtSpa(spa) : '',
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
        {/* sticky 컬럼 !important 오버라이드 (인라인 스타일은 !important 불가) */}
        <style>{`
          .dz-sticky-header { background: #0A0A0A !important; border-right: 1px solid #E8E5E0 !important; }
          .dz-sticky-even   { background: #FFFFFF !important; border-right: 1px solid #E8E5E0 !important; }
          .dz-sticky-odd    { background: #FAFAF8 !important; border-right: 1px solid #E8E5E0 !important; }
        `}</style>
        <table style={{ borderCollapse: 'collapse', minWidth: 1400 }}>
          {/* 2단 헤더 */}
          <thead>
            {/* 1행: 그룹 헤더 */}
            <tr>
              <th className="dz-sticky-header" style={{ ...HD, ...STICKY, width: 60 }} rowSpan={2}>날짜</th>
              <th className="dz-sticky-header" style={{ ...HD, ...STICKY2, width: 50 }} rowSpan={2}>kg</th>
              <th style={{ ...GH }} colSpan={3}>오늘의 관리</th>
              <th style={{ ...GH }} colSpan={5}>미용 스타일</th>
              <th style={{ ...GH }} colSpan={6}>특이사항</th>
              <th style={{ ...HD }} rowSpan={2}>내부메모</th>
            </tr>
            {/* 2행: 세부 컬럼 */}
            <tr>
              <th style={{ ...HD, width: 60 }}>서비스</th>
              <th style={{ ...HD, minWidth: 100 }}>스파/팩</th>
              <th style={{ ...HD, minWidth: 160 }}>사용제품</th>
              <th style={HD}>얼굴</th>
              <th style={HD}>몸</th>
              <th style={HD}>다리</th>
              <th style={HD}>꼬리</th>
              <th style={HD}>위생</th>
              <th style={{ ...HD, minWidth: 500, maxWidth: 500 }}>피부</th>
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
              // sticky 컬럼 전용 배경 (흰색이면 스크롤 시 텍스트가 묻혀서 크림톤 사용)
              const stickyBaseBg = i % 2 === 1 ? '#F5F4F0' : '#FAFAF8'
              const stickyBg = isHover ? '#EFEDE8' : stickyBaseBg
              const hasIssue = (v: string) => v && !['좋음', '깨끗함', '없음', '적당함', '양호'].includes(v)

              return (
                <tr
                  key={rowKey}
                  onClick={() => recordId && router.push(`/session/edit/${recordId}`)}
                  onMouseEnter={() => setHoverId(rowKey)}
                  onMouseLeave={() => setHoverId((cur) => (cur === rowKey ? null : cur))}
                  style={{ cursor: recordId ? 'pointer' : 'default' }}
                >
                  <td className={i % 2 === 1 ? 'dz-sticky-odd' : 'dz-sticky-even'} style={{ ...cell, ...STICKY, background: stickyBg, fontWeight: 500 }}>
                    {s(r, 'visit_date') ? formatDate(s(r, 'visit_date')) : '-'}
                  </td>
                  <td className={i % 2 === 1 ? 'dz-sticky-odd' : 'dz-sticky-even'} style={{ ...cell, ...STICKY2, background: stickyBg }}>
                    {fmtWeight(r) || '-'}
                  </td>
                  <td style={{ ...cell, width: 60 }}>{svc ? fmtSvc(svc) : '-'}</td>
                  <td
                    style={{ ...cell, ...CLICKABLE, minWidth: 100, overflow: 'visible', whiteSpace: 'normal' }}
                    onClick={(e) => { e.stopPropagation(); setModal({ rec: r, type: 'products' }) }}
                  >
                    {(() => {
                      const cats = extractProductsByCategory(s(r, 'care_actions'))
                      const extras = [...cats['스파'], ...cats['팩']]
                      if (!spa && extras.length === 0) return '-'
                      return (
                        <div>
                          {spa && (
                            <span style={{ color: GOLD, fontWeight: 500 }}>{fmtSpa(spa)}</span>
                          )}
                          {extras.map((name, i) => (
                            <div
                              key={`${name}-${i}`}
                              style={{ fontSize: 11, color: '#8A8A7A', marginTop: i === 0 && spa ? 2 : 0 }}
                            >
                              {name}
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </td>
                  <td
                    style={{ ...cell, ...CLICKABLE, minWidth: 160, overflow: 'visible', whiteSpace: 'normal' }}
                    onClick={(e) => { e.stopPropagation(); setModal({ rec: r, type: 'products' }) }}
                  >
                    {(() => {
                      const shampoos = extractProductsByCategory(s(r, 'care_actions'))['샴푸']
                      if (shampoos.length === 0) return '-'
                      return (
                        <span>
                          {shampoos.map((name, i) => (
                            <span key={`${name}-${i}`} style={{ display: 'block', whiteSpace: 'normal' }}>
                              {name}
                            </span>
                          ))}
                        </span>
                      )
                    })()}
                  </td>
                  <td
                    style={{ ...cell, ...CLICKABLE, minWidth: 60 }}
                    onClick={(e) => { e.stopPropagation(); setModal({ rec: r, type: 'style' }) }}
                  >{gs.face || '-'}</td>
                  <td
                    style={{ ...cell, ...CLICKABLE, minWidth: 60 }}
                    onClick={(e) => { e.stopPropagation(); setModal({ rec: r, type: 'style' }) }}
                  >{gs.body || '-'}</td>
                  <td
                    style={{ ...cell, ...CLICKABLE, minWidth: 60 }}
                    onClick={(e) => { e.stopPropagation(); setModal({ rec: r, type: 'style' }) }}
                  >{gs.legs || '-'}</td>
                  <td
                    style={{ ...cell, ...CLICKABLE, minWidth: 60 }}
                    onClick={(e) => { e.stopPropagation(); setModal({ rec: r, type: 'style' }) }}
                  >{gs.tail || '-'}</td>
                  <td
                    style={{ ...cell, ...CLICKABLE, minWidth: 60 }}
                    onClick={(e) => { e.stopPropagation(); setModal({ rec: r, type: 'style' }) }}
                  >{gs.sanitary || '-'}</td>
                  <td
                    style={{ ...cell, ...CLICKABLE, minWidth: 500, maxWidth: 500, whiteSpace: 'normal', wordBreak: 'keep-all', color: hasIssue(s(r, 'skin_status')) ? GOLD : undefined }}
                    onClick={(e) => { e.stopPropagation(); setModal({ rec: r, type: 'health' }) }}
                  >
                    {s(r, 'skin_status') || '-'}
                  </td>
                  <td
                    style={{ ...cell, ...CLICKABLE, minWidth: 60, color: hasIssue(s(r, 'coat_status')) ? GOLD : undefined }}
                    onClick={(e) => { e.stopPropagation(); setModal({ rec: r, type: 'health' }) }}
                  >
                    {s(r, 'coat_status') || '-'}
                  </td>
                  <td
                    style={{ ...cell, ...CLICKABLE, minWidth: 60, color: hasIssue(cond.eyes ?? '') ? GOLD : undefined }}
                    onClick={(e) => { e.stopPropagation(); setModal({ rec: r, type: 'health' }) }}
                  >
                    {cond.eyes || '-'}
                  </td>
                  <td
                    style={{ ...cell, ...CLICKABLE, minWidth: 60, color: hasIssue(cond.ears ?? '') ? GOLD : undefined }}
                    onClick={(e) => { e.stopPropagation(); setModal({ rec: r, type: 'health' }) }}
                  >
                    {cond.ears || '-'}
                  </td>
                  <td
                    style={{ ...cell, ...CLICKABLE, minWidth: 60, color: hasIssue(cond.teeth ?? '') ? GOLD : undefined }}
                    onClick={(e) => { e.stopPropagation(); setModal({ rec: r, type: 'health' }) }}
                  >
                    {cond.teeth || '-'}
                  </td>
                  <td
                    style={{ ...cell, ...CLICKABLE, minWidth: 60, color: hasIssue(cond.nail ?? '') ? GOLD : undefined }}
                    onClick={(e) => { e.stopPropagation(); setModal({ rec: r, type: 'health' }) }}
                  >
                    {cond.nail || '-'}
                  </td>
                  <td style={{ ...cell, maxWidth: 200, overflow: 'visible', whiteSpace: 'normal' }}>
                    {s(r, 'special_notes') || '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <div
          onClick={() => setModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E8E5E0',
              maxWidth: 480,
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              padding: 24,
              position: 'relative',
              borderRadius: 0,
            }}
          >
            <button
              type="button"
              onClick={() => setModal(null)}
              aria-label="닫기"
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'none',
                border: 'none',
                fontSize: 18,
                color: '#8A8A7A',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
            <p style={{ fontSize: 12, letterSpacing: '0.1em', color: '#8A8A7A', marginBottom: 20 }}>
              {fmtPopupDate(
                s(modal.rec, 'visit_date'),
                modal.type === 'health' ? '건강 체크' : '케어 기록',
              )}
            </p>

            {modal.type === 'health' ? (
              (() => {
                const GOOD_VALUES = new Set(['좋음', '깨끗함', '없음', '적당함', '양호'])
                const coatRaw = s(modal.rec, 'coat_status').replace(/^\s*엉킴\s*:\s*/, '').trim()
                const cond = parseCondition(s(modal.rec, 'condition_status'))
                const sections: Array<[string, string]> = [
                  ['피부', s(modal.rec, 'skin_status')],
                  ['엉킴', coatRaw],
                  ['눈', cond.eyes ?? ''],
                  ['귀', cond.ears ?? ''],
                  ['치아', cond.teeth ?? ''],
                  ['발톱', cond.nail ?? ''],
                ]
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {sections.map(([label, raw]) => {
                      const { items, memos } = parseItemsWithMemos(raw)
                      return (
                        <div key={label}>
                          <p style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', marginBottom: 6 }}>
                            {label}
                          </p>
                          {items.length === 0 ? (
                            <p style={{ fontSize: 13, color: '#8A8A7A' }}>-</p>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {items.map((it, i) => {
                                const good = GOOD_VALUES.has(it)
                                const memo = memos[it]
                                return (
                                  <div key={`${it}-${i}`} style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        padding: '4px 10px',
                                        fontSize: 13,
                                        fontWeight: good ? 400 : 500,
                                        background: good ? '#F0EDE8' : 'rgba(201,169,110,0.15)',
                                        color: good ? '#6B6B6B' : '#C9A96E',
                                        borderRadius: 0,
                                        lineHeight: 1.4,
                                      }}
                                    >
                                      {it}
                                    </span>
                                    {memo && (
                                      <span style={{ fontSize: 11, color: '#8A8A7A', marginTop: 2, paddingLeft: 2 }}>
                                        {memo}
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })()
            ) : modal.type === 'products' ? (
              (() => {
                const grouped = extractAllProducts(s(modal.rec, 'care_actions'))
                const order = ['샴푸', '린스', '스파', '팩', '피부케어', '피모케어', '기타']
                const cats = order.filter((c) => (grouped[c]?.length ?? 0) > 0)
                if (cats.length === 0) {
                  return <p style={{ fontSize: 13, color: '#8A8A7A' }}>등록된 제품이 없습니다.</p>
                }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {cats.map((cat) => (
                      <div key={cat}>
                        <p style={{ fontSize: 11, letterSpacing: '0.15em', color: '#C9A96E', textTransform: 'uppercase' as const, marginBottom: 6 }}>
                          {cat}
                        </p>
                        {grouped[cat].map((name, i) => (
                          <p key={`${name}-${i}`} style={{ fontSize: 14, color: '#1A1A1A', lineHeight: 1.6 }}>
                            {name}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                )
              })()
            ) : (
              (() => {
                const gs = parseGroomingStyle(modal.rec)
                const items = STYLE_LABELS.filter(([key]) => {
                  const v = gs[key]
                  return v && String(v).trim()
                })
                if (items.length === 0) {
                  return <p style={{ fontSize: 13, color: '#8A8A7A' }}>미용 스타일 기록이 없습니다.</p>
                }
                const memo = s(modal.rec, 'special_notes')
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {items.map(([key, label]) => (
                      <div key={key}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 4 }}>
                          {label}
                        </p>
                        <p style={{ fontSize: 14, color: '#6B6B6B', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {gs[key]}
                        </p>
                      </div>
                    ))}
                    {memo && (
                      <div style={{ borderTop: '1px solid #E8E5E0', paddingTop: 12, marginTop: 4 }}>
                        <p style={{ fontSize: 11, letterSpacing: '0.15em', color: '#C9A96E', textTransform: 'uppercase' as const, marginBottom: 6 }}>
                          Memo
                        </p>
                        <p style={{ fontSize: 14, color: '#1A1A1A', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {memo}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })()
            )}

            {(() => {
              const rid = idStr(modal.rec, 'id')
              if (!rid) return null
              return (
                <button
                  type="button"
                  onClick={() => {
                    setModal(null)
                    router.push(`/session/edit/${rid}`)
                  }}
                  style={{
                    marginTop: 24,
                    width: '100%',
                    border: '1px solid #C9A96E',
                    color: '#C9A96E',
                    background: '#FFFFFF',
                    padding: '8px 20px',
                    fontSize: 14,
                    letterSpacing: '0.05em',
                    borderRadius: 0,
                    cursor: 'pointer',
                  }}
                >
                  수정하기
                </button>
              )
            })()}
          </div>
        </div>
      )}
    </section>
  )
}
