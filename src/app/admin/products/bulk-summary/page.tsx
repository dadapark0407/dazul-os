'use client'

/**
 * 제품 ai_summary 일괄 채우기
 * ─────────────────────────────────
 * - 대상: products.ai_summary 가 비어있는 활성 제품
 * - 초안: src/data/ai-summary-drafts.ts 의 사전 생성 초안 (웹검색 기반)
 * - 저장: 체크박스로 선택한 항목만 UPDATE, 각 저장에 대해 audit_logs 기록
 * - [검색실패] 초안은 기본 체크 해제 (사용자가 직접 편집 후 체크 가능)
 * - 프로덕션 DB 는 사용자가 저장 버튼을 눌러야만 변경됨
 */

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AI_SUMMARY_DRAFTS } from '@/data/ai-summary-drafts'

type EmptyProduct = {
  id: string
  name: string | null
  brand: string | null
  category_name: string | null
  ai_summary: string | null
}

type Row = {
  id: string
  name: string
  brand: string | null
  category_name: string | null
  draft: string // 편집 가능한 초안
  originalDraft: string // 원본 (변경 여부 표시용)
  url: string | null
  status: 'ok' | 'insufficient' | 'failed' | 'missing_draft'
  checked: boolean
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  saveError?: string
}

const GOLD = '#C9A96E'
const BORDER = '#E8E5E0'
const BG_SOFT = '#FAFAF8'

function classifyDraft(summary: string): Row['status'] {
  if (summary.startsWith('[검색실패]')) return 'failed'
  if (summary.startsWith('[정보부족]')) return 'insufficient'
  return 'ok'
}

export default function BulkSummaryPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [emptyProducts, setEmptyProducts] = useState<EmptyProduct[]>([])
  const [rows, setRows] = useState<Row[]>([])

  const [filter, setFilter] = useState<'all' | 'ok' | 'insufficient' | 'failed' | 'missing_draft'>('all')
  const [saving, setSaving] = useState(false)
  const [finalMessage, setFinalMessage] = useState<string | null>(null)

  // ─── 초기 로드 ───
  useEffect(() => {
    async function load() {
      setLoading(true)

      // 1) 인증
      const { data: userRes } = await supabase.auth.getUser()
      if (!userRes.user) {
        setAuthError('로그인이 필요합니다.')
        setLoading(false)
        return
      }
      setUserEmail(userRes.user.email ?? '')

      // 2) 비어있는 제품 + 카테고리명
      const { data, error } = await supabase
        .from('products')
        .select('id, name, brand, ai_summary, category_id, product_categories(name)')
        .is('deleted_at', null)
        .order('name')

      if (error) {
        setAuthError(`제품 조회 실패: ${error.message}`)
        setLoading(false)
        return
      }

      const empty: EmptyProduct[] = (data ?? [])
        .filter((p) => {
          const s = (p.ai_summary as string | null) ?? ''
          return s.trim() === ''
        })
        .map((p) => {
          // Supabase 조인 결과는 배열 또는 객체로 올 수 있음
          const pc = p.product_categories as { name: string } | { name: string }[] | null
          const category_name = Array.isArray(pc) ? pc[0]?.name ?? null : pc?.name ?? null
          return {
            id: p.id as string,
            name: (p.name as string | null) ?? null,
            brand: (p.brand as string | null) ?? null,
            category_name,
            ai_summary: (p.ai_summary as string | null) ?? null,
          }
        })

      setEmptyProducts(empty)

      // 3) 초안 매칭 → Row 배열
      const draftMap = new Map(AI_SUMMARY_DRAFTS.map((d) => [d.id, d]))
      const initialRows: Row[] = empty.map((p) => {
        const draft = draftMap.get(p.id)
        if (!draft) {
          return {
            id: p.id,
            name: p.name ?? '(제품명 없음)',
            brand: p.brand,
            category_name: p.category_name,
            draft: '',
            originalDraft: '',
            url: null,
            status: 'missing_draft',
            checked: false,
            saveState: 'idle',
          }
        }
        const status = classifyDraft(draft.summary)
        return {
          id: p.id,
          name: p.name ?? draft.name,
          brand: p.brand ?? draft.brand,
          category_name: p.category_name,
          draft: draft.summary,
          originalDraft: draft.summary,
          url: draft.url,
          status,
          checked: status === 'ok', // 정상 초안만 기본 체크
          saveState: 'idle',
        }
      })

      setRows(initialRows)
      setLoading(false)
    }
    load()
  }, [])

  const filteredRows = useMemo(() => {
    if (filter === 'all') return rows
    return rows.filter((r) => r.status === filter)
  }, [rows, filter])

  const stats = useMemo(() => {
    return {
      total: rows.length,
      ok: rows.filter((r) => r.status === 'ok').length,
      insufficient: rows.filter((r) => r.status === 'insufficient').length,
      failed: rows.filter((r) => r.status === 'failed').length,
      missing_draft: rows.filter((r) => r.status === 'missing_draft').length,
      checked: rows.filter((r) => r.checked).length,
    }
  }, [rows])

  function toggleRow(id: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r)))
  }
  function updateDraft(id: string, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, draft: value } : r)))
  }
  function selectVisible(state: boolean) {
    const visibleIds = new Set(filteredRows.map((r) => r.id))
    setRows((prev) => prev.map((r) => (visibleIds.has(r.id) ? { ...r, checked: state } : r)))
  }

  async function handleSave() {
    const toSave = rows.filter((r) => r.checked && r.draft.trim() !== '')
    if (toSave.length === 0) {
      alert('저장할 항목이 없습니다.')
      return
    }

    // [검색실패] 텍스트 그대로 저장 방지
    const hasRawFailedText = toSave.some(
      (r) => r.draft.trim().startsWith('[검색실패]') || r.draft.trim().startsWith('[정보부족]'),
    )
    if (hasRawFailedText) {
      const ok = confirm(
        '[검색실패] 또는 [정보부족] 태그가 포함된 초안이 있습니다.\n그대로 저장하면 보호자에게 노출됩니다. 계속할까요?',
      )
      if (!ok) return
    }

    const confirmMsg = `${toSave.length}개 제품의 ai_summary를 저장합니다. 계속할까요?`
    if (!confirm(confirmMsg)) return

    setSaving(true)
    setFinalMessage(null)

    let success = 0
    let fail = 0

    for (const row of toSave) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, saveState: 'saving' } : r)))

      const newSummary = row.draft.trim()

      const { data: updated, error: upErr } = await supabase
        .from('products')
        .update({ ai_summary: newSummary })
        .eq('id', row.id)
        .select('id')

      if (upErr || !updated || updated.length === 0) {
        fail++
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? {
                  ...r,
                  saveState: 'error',
                  saveError: upErr?.message ?? '업데이트된 행이 없습니다 (권한/RLS 확인).',
                }
              : r,
          ),
        )
        continue
      }

      // audit_logs — 실패해도 저장 자체는 성공으로 카운트
      const urlPart = row.url ? ` (출처: ${row.url})` : ' (출처: 없음)'
      const description = `[제품 ai_summary] ${row.name} (id=${row.id}) → "${newSummary}"${urlPart}`
      try {
        await supabase.from('audit_logs').insert({
          action: 'updated',
          appointment_id: null,
          staff_actor_id: null,
          staff_actor_name: userEmail || '미지정',
          description,
        })
      } catch {
        // 로그 실패는 무시
      }

      success++
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, saveState: 'saved', checked: false } : r)))
    }

    setSaving(false)
    setFinalMessage(`저장 완료: 성공 ${success} / 실패 ${fail}`)
  }

  // ─── 렌더 ───
  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-neutral-900">제품 안내 문구 일괄 채우기</h1>
        <div className="rounded-lg bg-white px-6 py-10 text-center" style={{ border: `1px solid ${BORDER}` }}>
          <p className="text-sm text-neutral-600">불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-neutral-900">제품 안내 문구 일괄 채우기</h1>
        <div
          className="rounded-lg bg-white px-6 py-10 text-center"
          style={{ border: `1px solid ${BORDER}` }}
        >
          <p className="text-sm text-red-600">{authError}</p>
          <button
            onClick={() => router.push('/admin')}
            className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            관리자로 이동
          </button>
        </div>
      </div>
    )
  }

  if (emptyProducts.length === 0) {
    return (
      <div className="space-y-4">
        <Link href="/admin/products" className="text-sm font-medium text-neutral-500 hover:text-neutral-700">
          ← 제품 목록
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">제품 안내 문구 일괄 채우기</h1>
        <div className="rounded-lg bg-white px-6 py-10 text-center" style={{ border: `1px solid ${BORDER}` }}>
          <p className="text-sm text-neutral-600">비어있는 안내 문구가 없습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/products" className="text-sm font-medium text-neutral-500 hover:text-neutral-700">
          ← 제품 목록
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-neutral-900">제품 안내 문구 일괄 채우기</h1>
        <p className="mt-1 text-xs text-neutral-500">
          비어있는 <code className="rounded bg-neutral-100 px-1">ai_summary</code>만 대상. 체크한 항목만 저장됩니다.
          저장 이력은 <code className="rounded bg-neutral-100 px-1">audit_logs</code>에 기록됩니다.
        </p>
      </div>

      {/* ─── 요약 통계 ─── */}
      <div
        className="grid grid-cols-2 gap-2 rounded-lg bg-white p-4 sm:grid-cols-5"
        style={{ border: `1px solid ${BORDER}`, background: BG_SOFT }}
      >
        <Stat label="비어있음" value={stats.total} />
        <Stat label="정상 초안" value={stats.ok} color="#2E7D32" />
        <Stat label="정보부족" value={stats.insufficient} color="#B26A00" />
        <Stat label="검색실패" value={stats.failed} color="#B71C1C" />
        <Stat label="선택" value={stats.checked} color={GOLD} />
      </div>

      {/* ─── 필터 & 액션 ─── */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>
          전체 {stats.total}
        </FilterButton>
        <FilterButton active={filter === 'ok'} onClick={() => setFilter('ok')}>
          정상 {stats.ok}
        </FilterButton>
        <FilterButton active={filter === 'insufficient'} onClick={() => setFilter('insufficient')}>
          정보부족 {stats.insufficient}
        </FilterButton>
        <FilterButton active={filter === 'failed'} onClick={() => setFilter('failed')}>
          검색실패 {stats.failed}
        </FilterButton>
        {stats.missing_draft > 0 && (
          <FilterButton active={filter === 'missing_draft'} onClick={() => setFilter('missing_draft')}>
            초안없음 {stats.missing_draft}
          </FilterButton>
        )}

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => selectVisible(true)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            보이는 것 전체 선택
          </button>
          <button
            onClick={() => selectVisible(false)}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            선택 해제
          </button>
        </div>
      </div>

      {/* ─── 행 목록 ─── */}
      <div className="space-y-2">
        {filteredRows.map((row) => (
          <RowCard key={row.id} row={row} onToggle={() => toggleRow(row.id)} onEdit={(v) => updateDraft(row.id, v)} />
        ))}
        {filteredRows.length === 0 && (
          <div
            className="rounded-lg bg-white px-6 py-8 text-center text-sm text-neutral-500"
            style={{ border: `1px solid ${BORDER}` }}
          >
            해당하는 항목이 없습니다.
          </div>
        )}
      </div>

      {/* ─── 하단 저장바 ─── */}
      <div
        className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6"
        style={{ borderColor: BORDER }}
      >
        <div className="text-sm text-neutral-700">
          <span className="font-semibold" style={{ color: GOLD }}>
            {stats.checked}개
          </span>{' '}
          선택됨
          {finalMessage && <span className="ml-3 text-neutral-500">· {finalMessage}</span>}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || stats.checked === 0}
          className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-40"
        >
          {saving ? '저장 중...' : `${stats.checked}개 저장`}
        </button>
      </div>
    </div>
  )
}

// ─── 서브 컴포넌트 ─────────────────────────────────

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-0.5 text-xl font-semibold" style={{ color: color ?? '#0A0A0A' }}>
        {value}
      </div>
    </div>
  )
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? 'bg-neutral-900 text-white'
          : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
      }`}
    >
      {children}
    </button>
  )
}

function StatusBadge({ status }: { status: Row['status'] }) {
  const map: Record<Row['status'], { label: string; bg: string; color: string }> = {
    ok: { label: '정상', bg: '#E8F5E9', color: '#2E7D32' },
    insufficient: { label: '정보부족', bg: '#FFF4E5', color: '#B26A00' },
    failed: { label: '검색실패', bg: '#FFEBEE', color: '#B71C1C' },
    missing_draft: { label: '초안없음', bg: '#F5F5F5', color: '#666' },
  }
  const s = map[status]
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}

function RowCard({
  row,
  onToggle,
  onEdit,
}: {
  row: Row
  onToggle: () => void
  onEdit: (v: string) => void
}) {
  const bgByStatus: Partial<Record<Row['status'], string>> = {
    failed: '#FFF8F8',
    missing_draft: '#FAFAFA',
  }
  const bg = row.saveState === 'saved' ? '#F0F9F1' : bgByStatus[row.status] ?? '#FFFFFF'

  return (
    <div className="rounded-lg p-3" style={{ background: bg, border: `1px solid ${BORDER}` }}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={row.checked}
          onChange={onToggle}
          disabled={row.saveState === 'saving' || row.saveState === 'saved'}
          className="mt-1 h-4 w-4 shrink-0 accent-neutral-900"
        />

        <div className="flex-1 min-w-0">
          {/* 헤더: 제품명 · 브랜드 · 카테고리 · 상태 */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-semibold text-neutral-900">{row.name}</span>
            {row.brand && <span className="text-xs text-neutral-500">· {row.brand}</span>}
            {row.category_name && (
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-neutral-600"
                style={{ background: '#F0EDE8' }}
              >
                {row.category_name}
              </span>
            )}
            <StatusBadge status={row.status} />
            {row.draft !== row.originalDraft && row.status !== 'missing_draft' && (
              <span className="text-[10px] font-medium" style={{ color: GOLD }}>
                편집됨
              </span>
            )}
          </div>

          {/* 초안 (편집 가능) */}
          <textarea
            value={row.draft}
            onChange={(e) => onEdit(e.target.value)}
            rows={2}
            placeholder={row.status === 'missing_draft' ? '초안 없음 — 직접 입력' : ''}
            disabled={row.saveState === 'saving' || row.saveState === 'saved'}
            className="mt-2 w-full rounded-md border px-3 py-2 text-sm text-neutral-800 outline-none focus:border-neutral-500 disabled:bg-neutral-50"
            style={{ borderColor: BORDER, background: '#FFFFFF' }}
          />

          {/* 출처 + 저장 상태 */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {row.url ? (
              <a
                href={row.url}
                target="_blank"
                rel="noopener noreferrer"
                className="max-w-full truncate underline decoration-dotted hover:text-neutral-900"
                style={{ color: GOLD }}
                title={row.url}
              >
                출처 링크 ↗
              </a>
            ) : (
              <span className="text-neutral-400">출처 없음</span>
            )}

            {row.saveState === 'saving' && <span className="text-neutral-500">저장 중...</span>}
            {row.saveState === 'saved' && <span className="text-green-700">저장 완료</span>}
            {row.saveState === 'error' && (
              <span className="text-red-600">저장 실패: {row.saveError}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
