'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type ServiceType = 'grooming' | 'bath' | 'spa' | 'care' | 'other'
type SaleStatus = 'submitted' | 'approved' | 'rejected'
type Tab = 'sales' | 'settlement'

interface Sale {
  id: string
  date: string
  breed: string
  pet_name: string
  amount: number
  service_type: ServiceType
  memo: string | null
  status: SaleStatus
  reject_reason: string | null
  settlement_id: string | null
  created_at: string
}

interface Settlement {
  id: string
  period_from: string
  period_to: string
  total_amount: number
  supply_amount: number
  commission_rate: number
  before_tax_amount: number
  withholding_amount: number
  payout_amount: number
  status: string
  paid_at: string | null
  payment_method: string | null
  created_at: string
}

interface SettlementItem {
  id: string
  date_snapshot: string
  pet_name_snapshot: string
  breed_snapshot: string
  amount_snapshot: number
}

type RowKind = 'sale' | 'sum' | 'unrecognized'

interface ParsedRow {
  localId: string
  kind: RowKind
  date: string
  dateLabel: string
  pet_name: string
  amount: number
  amountStr: string
  deleted: boolean
  rawLine?: string
}

interface ValidationMsg {
  dateLabel: string
  match: boolean
  inputSum: number
  calcSum: number
}

const SERVICE_LABELS: Record<ServiceType, string> = {
  grooming: '미용', bath: '목욕', spa: '스파', care: '케어', other: '기타',
}

const STATUS_STYLE: Record<SaleStatus, { label: string; bg: string; color: string }> = {
  submitted: { label: '검토 대기', bg: '#F5F2EE', color: '#888' },
  approved:  { label: '승인',      bg: '#EAF4EC', color: '#2E7D32' },
  rejected:  { label: '반려',      bg: '#FDECEA', color: '#C62828' },
}

const SETTLEMENT_STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: '정산 중',  bg: '#F5F2EE', color: '#888' },
  paid:  { label: '지급완료', bg: '#EAF4EC', color: '#2E7D32' },
}

function todayKST(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

function formatAmount(v: string): string {
  const digits = v.replace(/[^0-9]/g, '')
  return digits ? Number(digits).toLocaleString('ko-KR') : ''
}

function parseAmount(v: string): number {
  return Number(v.replace(/[^0-9]/g, ''))
}

function fmt(n: number) { return n.toLocaleString('ko-KR') }

export default function SettlementPage() {
  const router = useRouter()
  const supabase = createClient()

  const [groomer, setGroomer] = useState<{ id: string; name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('sales')

  // ── 매출 입력 상태 ──
  const [sales, setSales] = useState<Sale[]>([])
  const [date, setDate] = useState(todayKST())
  const [breed, setBreed] = useState('')
  const [petName, setPetName] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editBreed, setEditBreed] = useState('')
  const [editPetName, setEditPetName] = useState('')
  const [editAmountStr, setEditAmountStr] = useState('')
  const [editMemo, setEditMemo] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── 붙여넣기 ──
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [parseWarnings, setParseWarnings] = useState<string[]>([])
  const [validationMsgs, setValidationMsgs] = useState<ValidationMsg[]>([])
  const [bulkSaving, setBulkSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // ── 정산 상태 ──
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [settlementsLoading, setSettlementsLoading] = useState(false)
  const [showItemsSet, setShowItemsSet] = useState<Set<string>>(new Set())
  const [expandedItemsMap, setExpandedItemsMap] = useState<Map<string, SettlementItem[]>>(new Map())
  const [loadingItemsSet, setLoadingItemsSet] = useState<Set<string>>(new Set())

  // paid 정산 하드락용 맵 (본인 정산만 RLS로 내려옴)
  // 미래에 draft 정산 취소 기능 추가 시 — paid 정산은 취소 대상에서 반드시 제외할 것.
  const [settlementStatusMap, setSettlementStatusMap] = useState<Map<string, string>>(new Map())

  const fetchSales = useCallback(async (groomerId: string) => {
    const { data } = await supabase
      .from('freelance_sales')
      .select('id, date, breed, pet_name, amount, service_type, memo, status, reject_reason, settlement_id, created_at')
      .eq('groomer_id', groomerId)
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    const salesList = (data as Sale[]) ?? []
    setSales(salesList)

    // paid 정산 바인딩 매출 하드락 — settlement_id 존재만으로는 부족, paid 여부 명시 확인
    const boundIds = [...new Set(salesList.filter(s => s.settlement_id).map(s => s.settlement_id!))]
    if (boundIds.length > 0) {
      const { data: stData } = await supabase
        .from('freelance_settlements').select('id, status').in('id', boundIds)
      setSettlementStatusMap(new Map((stData ?? []).map(st => [st.id, st.status])))
    } else {
      setSettlementStatusMap(new Map())
    }
  }, [supabase])

  const fetchSettlements = useCallback(async () => {
    setSettlementsLoading(true)
    const { data } = await supabase
      .from('freelance_settlements')
      .select('id, period_from, period_to, total_amount, supply_amount, commission_rate, before_tax_amount, withholding_amount, payout_amount, status, paid_at, payment_method, created_at')
      .order('created_at', { ascending: false })
    setSettlements((data as Settlement[]) ?? [])
    setSettlementsLoading(false)
  }, [supabase])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/settlement/login'); return }
      const { data: g } = await supabase
        .from('freelance_groomers').select('id, name').eq('email', user.email!).maybeSingle()
      if (!g) { router.push('/settlement/login?error=not_registered'); return }
      setGroomer(g)
      await fetchSales(g.id)
      setLoading(false)
    }
    init()
  }, [router, supabase, fetchSales])

  useEffect(() => {
    if (tab === 'settlement' && groomer) fetchSettlements()
  }, [tab, groomer, fetchSettlements])

  async function loadItems(settlementId: string) {
    setShowItemsSet(prev => new Set(prev).add(settlementId))
    setLoadingItemsSet(prev => new Set(prev).add(settlementId))
    const { data } = await supabase
      .from('freelance_settlement_items')
      .select('id, date_snapshot, pet_name_snapshot, breed_snapshot, amount_snapshot')
      .eq('settlement_id', settlementId)
      .order('date_snapshot', { ascending: true })
    setExpandedItemsMap(prev => new Map(prev).set(settlementId, (data as SettlementItem[]) ?? []))
    setLoadingItemsSet(prev => { const next = new Set(prev); next.delete(settlementId); return next })
  }

  function toggleItems(settlementId: string) {
    if (showItemsSet.has(settlementId)) {
      setShowItemsSet(prev => { const next = new Set(prev); next.delete(settlementId); return next })
    } else {
      loadItems(settlementId)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/settlement/login')
  }

  async function handleSave() {
    const amt = parseAmount(amountStr)
    if (!breed.trim()) { setFormError('견종을 입력해 주세요.'); return }
    if (!petName.trim()) { setFormError('이름을 입력해 주세요.'); return }
    if (!amt || amt <= 0) { setFormError('금액을 입력해 주세요.'); return }
    setSaving(true); setFormError('')
    const { error } = await supabase.from('freelance_sales').insert({
      groomer_id: groomer!.id, date, breed: breed.trim(), pet_name: petName.trim(),
      amount: amt, service_type: 'other', memo: memo.trim() || null, status: 'submitted', source: 'manual',
    })
    setSaving(false)
    if (error) { setFormError('저장에 실패했습니다. 다시 시도해 주세요.'); return }
    setBreed(''); setPetName(''); setAmountStr(''); setMemo('')
    await fetchSales(groomer!.id)
  }

  function startEdit(s: Sale) {
    setEditId(s.id); setEditDate(s.date ?? ''); setEditBreed(s.breed ?? '')
    setEditPetName(s.pet_name ?? ''); setEditAmountStr(s.amount.toLocaleString('ko-KR'))
    setEditMemo(s.memo ?? ''); setEditError('')
  }

  async function handleEditSave() {
    const amt = parseAmount(editAmountStr)
    if (!editPetName.trim()) { setEditError('이름을 입력해 주세요.'); return }
    if (!amt || amt <= 0) { setEditError('금액을 입력해 주세요.'); return }
    setEditSaving(true); setEditError('')
    const updatePayload: Record<string, unknown> = {
      date: editDate, breed: editBreed.trim() || null, pet_name: editPetName.trim(),
      amount: amt, memo: editMemo.trim() || null,
    }
    const sale = sales.find(s => s.id === editId)
    if (sale?.status === 'rejected') { updatePayload.status = 'submitted'; updatePayload.reject_reason = null }
    const { error } = await supabase.from('freelance_sales').update(updatePayload).eq('id', editId!)
    setEditSaving(false)
    if (error) { setEditError('수정에 실패했습니다.'); return }
    setEditId(null)
    await fetchSales(groomer!.id)
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    await supabase.from('freelance_sales').update({ deleted_at: new Date().toISOString() }).eq('id', deleteId)
    setDeleting(false); setDeleteId(null)
    await fetchSales(groomer!.id)
  }

  // ── 붙여넣기 파서 ──
  function kstYear(): number {
    const now = new Date()
    return new Date(now.getTime() + 9 * 60 * 60 * 1000).getFullYear()
  }

  function parsePasteText(text: string): { rows: ParsedRow[]; warnings: string[] } {
    const lines = text.split('\n')
    const rows: ParsedRow[] = []
    const warnings: string[] = []
    let currentDate = ''
    let currentDateLabel = ''
    let idSeq = 0
    const year = kstYear()

    for (const rawLine of lines) {
      const line = rawLine.trim() // trim으로 "6/22 " 같은 뒤 공백 처리
      if (!line) continue

      // 날짜 줄: "6/22", "6월 22일", "6월22일" 등
      const dateMatch = line.match(/^(\d{1,2})[\/월]\s*(\d{1,2})일?$/)
      if (dateMatch) {
        const m = dateMatch[1].padStart(2, '0')
        const d = dateMatch[2].padStart(2, '0')
        currentDate = `${year}-${m}-${d}`
        currentDateLabel = `${dateMatch[1]}/${dateMatch[2]}`
        continue
      }

      // 합계 줄: 숫자와 콤마만 (이름 없음) — 콤마 있는 것(460,000)·없는 것(460000) 모두 처리
      if (/^[\d,]+$/.test(line)) {
        const amount = parseInt(line.replace(/,/g, ''), 10)
        if (amount > 0 && currentDate) {
          rows.push({ localId: String(idSeq++), kind: 'sum', date: currentDate, dateLabel: currentDateLabel, pet_name: '', amount, amountStr: amount.toLocaleString('ko-KR'), deleted: false, rawLine: line })
        }
        continue
      }

      if (!currentDate) {
        warnings.push(`날짜 미지정: "${line}"`)
        continue
      }

      // 매출 줄: 마지막 공백 토큰이 숫자 — 콤마·무콤마 모두 처리
      const parts = line.split(/\s+/)
      if (parts.length >= 2) {
        const lastPart = parts[parts.length - 1]
        const amountNum = parseInt(lastPart.replace(/,/g, ''), 10)
        if (!isNaN(amountNum) && amountNum > 0) {
          const petName = parts.slice(0, -1).join(' ')
          rows.push({ localId: String(idSeq++), kind: 'sale', date: currentDate, dateLabel: currentDateLabel, pet_name: petName, amount: amountNum, amountStr: amountNum.toLocaleString('ko-KR'), deleted: false })
          continue
        }
      }

      warnings.push(`인식 불가: "${line}"`)
    }
    return { rows, warnings }
  }

  function calcValidation(rows: ParsedRow[]): ValidationMsg[] {
    const dates = [...new Set(rows.filter(r => !r.deleted).map(r => r.date))]
    return dates.flatMap(date => {
      const dateRows = rows.filter(r => r.date === date && !r.deleted)
      const sumRow = dateRows.find(r => r.kind === 'sum')
      if (!sumRow) return []
      const calcSum = dateRows.filter(r => r.kind === 'sale').reduce((s, r) => s + r.amount, 0)
      return [{ dateLabel: sumRow.dateLabel, match: calcSum === sumRow.amount, inputSum: sumRow.amount, calcSum }]
    })
  }

  function handlePreview() {
    const { rows, warnings } = parsePasteText(pasteText)
    setPreview(rows)
    setParseWarnings(warnings)
    setValidationMsgs(calcValidation(rows))
    setShowPreview(true)
  }

  async function handleBulkSave() {
    const toSave = preview.filter(r => r.kind === 'sale' && !r.deleted && r.amount > 0)
    if (toSave.length === 0) return
    setBulkSaving(true)
    await supabase.from('freelance_sales').insert(
      toSave.map(r => ({
        groomer_id: groomer!.id,
        date: r.date,
        pet_name: r.pet_name,
        breed: null,
        amount: r.amount,
        service_type: 'other',
        source: 'manual',
        status: 'submitted',
        memo: null,
      }))
    )
    setBulkSaving(false)
    setPasteText(''); setPreview([]); setParseWarnings([]); setValidationMsgs([])
    setShowPreview(false); setShowPaste(false)
    await fetchSales(groomer!.id)
  }

  function canEdit(s: Sale) {
    // paid 정산에 바인딩된 매출은 하드락 — settlement_id 존재 여부 외에 paid 여부도 명시 확인
    // 미래에 draft 정산 취소로 settlement_id가 null이 되더라도 paid lock은 별도 구현 필요
    const isPaidLocked = !!s.settlement_id && settlementStatusMap.get(s.settlement_id) === 'paid'
    return (s.status === 'submitted' || s.status === 'rejected') && !s.settlement_id && !isPaidLocked
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 13, color: '#AAA' }}>불러오는 중…</span>
    </div>
  )

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 13px', fontSize: 14, border: '1px solid #E8E5E0',
    borderRadius: 0, background: '#FAFAF8', color: '#1A1A1A', outline: 'none', boxSizing: 'border-box',
  }
  const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none', cursor: 'pointer' }

  return (
    <div style={{ background: '#FAFAF8', minHeight: '100dvh', paddingBottom: 48 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0 16px' }}>
          <div>
            <div style={{ fontSize: 15, letterSpacing: '0.35em', fontWeight: 600, color: '#1A1A1A' }}>DAZUL</div>
            <div style={{ fontSize: 11, color: '#C9A96E', letterSpacing: '0.12em', marginTop: 2 }}>매출 관리</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#555' }}>{groomer!.name}</span>
            <button onClick={handleLogout} style={{ fontSize: 12, color: '#AAA', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>로그아웃</button>
          </div>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E8E5E0', marginBottom: 20 }}>
          {(['sales', 'settlement'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '10px 20px', fontSize: 13, fontWeight: tab === t ? 600 : 400,
                color: tab === t ? '#1A1A1A' : '#AAA',
                background: 'none', border: 'none',
                borderBottom: tab === t ? '2px solid #C9A96E' : '2px solid transparent',
                cursor: 'pointer', marginBottom: -1,
              }}
            >
              {t === 'sales' ? '매출 입력' : '내 정산'}
            </button>
          ))}
        </div>

        {/* ════ 매출 입력 탭 ════ */}
        {tab === 'sales' && (
          <>
            {/* 입력 폼 */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E8E5E0', padding: '24px 20px', marginBottom: 20 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 20 }}>매출 입력</p>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 5 }}>날짜</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 5 }}>견종</label>
                  <input type="text" value={breed} onChange={e => setBreed(e.target.value)} placeholder="푸들" style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 5 }}>이름</label>
                  <input type="text" value={petName} onChange={e => setPetName(e.target.value)} placeholder="보리" style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 5 }}>금액 (원)</label>
                <input type="text" inputMode="decimal" value={amountStr} onChange={e => setAmountStr(formatAmount(e.target.value))} placeholder="0" style={{ ...inputStyle, textAlign: 'right' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 5 }}>메모 (선택)</label>
                <input type="text" value={memo} onChange={e => setMemo(e.target.value)} placeholder="특이사항" style={inputStyle} />
              </div>
              {formError && <p style={{ fontSize: 12, color: '#CC3333', marginBottom: 12 }}>{formError}</p>}
              <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: '13px', fontSize: 14, fontWeight: 600, background: saving ? '#E8E5E0' : '#C9A96E', color: saving ? '#AAA' : '#FFFFFF', border: 'none', borderRadius: 0, cursor: saving ? 'default' : 'pointer', letterSpacing: '0.03em' }}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>

            {/* 안내 */}
            <div style={{ background: '#F5F2EE', border: '1px solid #E8E5E0', padding: '12px 16px', marginBottom: 20 }}>
              <p style={{ fontSize: 12, color: '#888', lineHeight: 1.7 }}>
                검토 대기 · 매장 확인 후 승인 예정
              </p>
            </div>

            {/* 여러 건 붙여넣기 */}
            <div style={{ marginBottom: 20 }}>
              <button
                onClick={() => { setShowPaste(v => !v); setShowPreview(false) }}
                style={{ width: '100%', padding: '11px 14px', fontSize: 13, background: '#FFFFFF', border: '1px solid #E8E5E0', borderRadius: 0, cursor: 'pointer', color: '#555', textAlign: 'left' as const }}
              >
                여러 건 붙여넣기 {showPaste ? '▲' : '▼'}
              </button>

              {showPaste && (
                <div style={{ border: '1px solid #E8E5E0', borderTop: 'none', background: '#FFFFFF', padding: '16px' }}>
                  <textarea
                    value={pasteText}
                    onChange={e => { setPasteText(e.target.value); setShowPreview(false) }}
                    placeholder={'6/22\n코코 160,000\n부끄 170,000\n460,000'}
                    rows={8}
                    style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid #E8E5E0', borderRadius: 0, background: '#FAFAF8', color: '#1A1A1A', outline: 'none', resize: 'vertical', boxSizing: 'border-box' as const, fontFamily: 'monospace', marginBottom: 10 }}
                  />
                  <button
                    onClick={handlePreview}
                    disabled={!pasteText.trim()}
                    style={{ width: '100%', padding: '11px', fontSize: 13, fontWeight: 600, background: !pasteText.trim() ? '#E8E5E0' : '#1A1A1A', color: !pasteText.trim() ? '#AAA' : '#FFFFFF', border: 'none', borderRadius: 0, cursor: !pasteText.trim() ? 'default' : 'pointer' }}
                  >
                    미리보기
                  </button>

                  {showPreview && (
                    <div style={{ marginTop: 16 }}>
                      {/* 합계 검증 */}
                      {validationMsgs.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          {validationMsgs.map(v => (
                            <div key={v.dateLabel} style={{ fontSize: 12, padding: '4px 0', color: v.match ? '#2E7D32' : '#C62828' }}>
                              {v.match
                                ? `✓ ${v.dateLabel} 합계 일치 (${fmt(v.inputSum)}원)`
                                : `⚠ ${v.dateLabel} 합계 불일치 (입력 ${fmt(v.inputSum)}원 / 실제 합 ${fmt(v.calcSum)}원)`}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 인식 불가 경고 */}
                      {parseWarnings.length > 0 && (
                        <div style={{ background: '#FDF1F0', border: '1px solid #F5C6C2', padding: '8px 12px', marginBottom: 10 }}>
                          <p style={{ fontSize: 12, color: '#C62828', marginBottom: 4 }}>인식 불가 {parseWarnings.length}줄 (저장 제외)</p>
                          {parseWarnings.map((w, i) => <p key={i} style={{ fontSize: 11, color: '#C62828' }}>{w}</p>)}
                        </div>
                      )}

                      {/* 미리보기 표 */}
                      <div style={{ border: '1px solid #E8E5E0', marginBottom: 12 }}>
                        {preview.map((row, idx) => (
                          <div key={row.localId} style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px',
                            borderBottom: idx < preview.length - 1 ? '1px solid #F5F2EE' : 'none',
                            background: row.deleted ? '#F9F9F9' : row.kind === 'sum' ? '#F5F2EE' : '#FFFFFF',
                            opacity: row.deleted ? 0.45 : 1,
                          }}>
                            <span style={{ fontSize: 11, color: '#AAA', width: 32, flexShrink: 0 }}>{row.dateLabel}</span>
                            {row.kind === 'sale' ? (
                              <>
                                <input
                                  value={row.pet_name}
                                  onChange={e => {
                                    const next = [...preview]; next[idx] = { ...row, pet_name: e.target.value }; setPreview(next)
                                  }}
                                  disabled={row.deleted}
                                  style={{ flex: 1, fontSize: 13, padding: '3px 6px', border: '1px solid #E8E5E0', borderRadius: 0, background: 'transparent', outline: 'none', minWidth: 0 }}
                                />
                                <input
                                  value={row.amountStr}
                                  onChange={e => {
                                    const str = formatAmount(e.target.value)
                                    const amt = parseAmount(str)
                                    const next = [...preview]; next[idx] = { ...row, amountStr: str, amount: amt }
                                    setPreview(next); setValidationMsgs(calcValidation(next))
                                  }}
                                  disabled={row.deleted}
                                  style={{ width: 85, fontSize: 13, padding: '3px 6px', border: '1px solid #E8E5E0', borderRadius: 0, background: 'transparent', outline: 'none', textAlign: 'right' as const }}
                                />
                                <button
                                  onClick={() => {
                                    const next = [...preview]; next[idx] = { ...row, deleted: !row.deleted }
                                    setPreview(next); setValidationMsgs(calcValidation(next))
                                  }}
                                  style={{ fontSize: 11, color: row.deleted ? '#2E7D32' : '#C62828', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}
                                >
                                  {row.deleted ? '복원' : '제외'}
                                </button>
                              </>
                            ) : (
                              <span style={{ flex: 1, fontSize: 12, color: '#AAA', fontStyle: 'italic' }}>
                                합계(저장 안 함) — {fmt(row.amount)}원
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* N건 저장 버튼 */}
                      {(() => {
                        const saveCount = preview.filter(r => r.kind === 'sale' && !r.deleted).length
                        return (
                          <button
                            onClick={handleBulkSave}
                            disabled={bulkSaving || saveCount === 0}
                            style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 600, background: bulkSaving || saveCount === 0 ? '#E8E5E0' : '#C9A96E', color: bulkSaving || saveCount === 0 ? '#AAA' : '#FFFFFF', border: 'none', borderRadius: 0, cursor: bulkSaving || saveCount === 0 ? 'default' : 'pointer' }}
                          >
                            {bulkSaving ? '저장 중…' : `${saveCount}건 저장`}
                          </button>
                        )
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 매출 목록 */}
            <p style={{ fontSize: 12, color: '#AAA', marginBottom: 12 }}>총 {sales.length}건</p>
            {sales.length === 0 && (
              <div style={{ background: '#FFFFFF', border: '1px solid #E8E5E0', padding: '32px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#BBB' }}>입력된 매출이 없습니다.</p>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sales.map(s => {
                const st = STATUS_STYLE[s.status]
                const locked = !canEdit(s)
                const isEditing = editId === s.id
                return (
                  <div key={s.id} style={{ background: '#FFFFFF', border: '1px solid #E8E5E0', padding: '18px 18px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{s.pet_name}</span>
                        <span style={{ fontSize: 12, color: '#888', marginLeft: 6 }}>{s.breed}</span>
                        <span style={{ fontSize: 12, color: '#AAA', marginLeft: 6 }}>{SERVICE_LABELS[s.service_type]}</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: s.status === 'rejected' ? 10 : 0 }}>
                      <span style={{ fontSize: 12, color: '#888' }}>{s.date}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>{fmt(s.amount)}원</span>
                    </div>
                    {s.memo && !isEditing && <p style={{ fontSize: 12, color: '#AAA', marginTop: 4 }}>{s.memo}</p>}
                    {s.status === 'rejected' && s.reject_reason && !isEditing && (
                      <div style={{ background: '#FDF1F0', border: '1px solid #F5C6C2', padding: '8px 12px', marginTop: 8 }}>
                        <p style={{ fontSize: 12, color: '#C62828', lineHeight: 1.5 }}>반려 사유: {s.reject_reason}</p>
                      </div>
                    )}
                    {isEditing && (
                      <div style={{ marginTop: 14, borderTop: '1px solid #F0EDE8', paddingTop: 14 }}>
                        <div style={{ marginBottom: 8 }}>
                          <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>날짜</label>
                          <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={inputStyle} />
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>이름</label>
                          <input type="text" value={editPetName} onChange={e => setEditPetName(e.target.value)} style={inputStyle} />
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>금액 (원)</label>
                          <input type="text" inputMode="decimal" value={editAmountStr} onChange={e => setEditAmountStr(formatAmount(e.target.value))} style={{ ...inputStyle, textAlign: 'right' }} />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>메모</label>
                          <input type="text" value={editMemo} onChange={e => setEditMemo(e.target.value)} style={inputStyle} />
                        </div>
                        {s.status === 'rejected' && <p style={{ fontSize: 11, color: '#C9A96E', marginBottom: 10 }}>저장 시 재제출됩니다.</p>}
                        {editError && <p style={{ fontSize: 12, color: '#CC3333', marginBottom: 10 }}>{editError}</p>}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={handleEditSave} disabled={editSaving} style={{ flex: 1, padding: '10px', fontSize: 13, fontWeight: 600, background: editSaving ? '#E8E5E0' : '#1A1A1A', color: editSaving ? '#AAA' : '#FFFFFF', border: 'none', borderRadius: 0, cursor: editSaving ? 'default' : 'pointer' }}>
                            {editSaving ? '저장 중…' : s.status === 'rejected' ? '수정 후 재제출' : '저장'}
                          </button>
                          <button onClick={() => setEditId(null)} style={{ padding: '10px 16px', fontSize: 13, color: '#888', background: 'none', border: '1px solid #E8E5E0', borderRadius: 0, cursor: 'pointer' }}>취소</button>
                        </div>
                      </div>
                    )}
                    {!isEditing && (
                      <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        {locked ? (
                          <span style={{ fontSize: 11, color: '#CCC' }}>{s.settlement_id ? '정산 확정' : '승인됨 · 수정 불가'}</span>
                        ) : (
                          <>
                            <button onClick={() => startEdit(s)} style={{ fontSize: 12, color: '#555', background: 'none', border: '1px solid #E8E5E0', borderRadius: 0, padding: '5px 12px', cursor: 'pointer' }}>수정</button>
                            <button onClick={() => setDeleteId(s.id)} style={{ fontSize: 12, color: '#C62828', background: 'none', border: '1px solid #F5C6C2', borderRadius: 0, padding: '5px 12px', cursor: 'pointer' }}>삭제</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ════ 내 정산 탭 ════ */}
        {tab === 'settlement' && (
          <>
            <p style={{ fontSize: 12, color: '#AAA', marginBottom: 12 }}>
              {settlementsLoading ? '조회 중…' : `정산 ${settlements.length}건`}
            </p>

            {!settlementsLoading && settlements.length === 0 && (
              <div style={{ background: '#FFFFFF', border: '1px solid #E8E5E0', padding: '40px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#BBB' }}>생성된 정산이 없습니다.</p>
                <p style={{ fontSize: 12, color: '#CCC', marginTop: 6 }}>매장에서 월말 정산 생성 후 표시됩니다.</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {settlements.map(st => {
                const stBadge = SETTLEMENT_STATUS_LABEL[st.status] ?? { label: st.status, bg: '#F5F2EE', color: '#888' }
                const itemsShown = showItemsSet.has(st.id)
                const itemsLoading = loadingItemsSet.has(st.id)
                const items = expandedItemsMap.get(st.id) ?? []
                return (
                  <div key={st.id} style={{ border: '1px solid #E8E5E0', overflow: 'hidden' }}>
                    {/* 정산 요약 헤더 */}
                    <div style={{ background: '#FFFFFF', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
                            {st.period_from} ~ {st.period_to}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', background: stBadge.bg, color: stBadge.color }}>
                            {stBadge.label}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, color: '#888' }}>매출 합계 {fmt(st.total_amount)}원</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#C9A96E' }}>{fmt(st.payout_amount)}원</div>
                        <div style={{ fontSize: 11, color: '#AAA' }}>최종 지급액</div>
                      </div>
                    </div>

                    {/* 계산 명세 — 항상 표시 */}
                    <div style={{ background: '#FAFAF8', borderTop: '1px solid #E8E5E0', padding: '18px 20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, color: '#4A463F' }}>기간 매출 합계</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{fmt(st.total_amount)}원</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, color: '#9A9488' }}>공급가액 (÷1.1)</span>
                          <span style={{ fontSize: 13, color: '#4A463F' }}>{fmt(st.supply_amount)}원</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, color: '#9A9488' }}>커미션 (×{Math.round(Number(st.commission_rate) * 100)}%)</span>
                          <span style={{ fontSize: 13, color: '#4A463F' }}>{fmt(st.before_tax_amount)}원</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, color: '#9A9488' }}>원천징수 (−3.3%)</span>
                          <span style={{ fontSize: 13, color: '#C62828' }}>−{fmt(st.withholding_amount)}원</span>
                        </div>
                      </div>
                      <div style={{ borderTop: '1px solid #E8E5E0', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#C9A96E' }}>최종 지급액</span>
                        <span style={{ fontSize: 18, fontWeight: 700, color: '#C9A96E' }}>{fmt(st.payout_amount)}원</span>
                      </div>
                    </div>

                    {/* 매출 내역 접기 */}
                    <div style={{ background: '#FFFFFF', padding: '0 18px 16px' }}>
                      <button
                        onClick={() => toggleItems(st.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0 8px' }}
                      >
                        {itemsShown ? '매출 내역 닫기 ▲' : '매출 내역 보기 ▼'}
                      </button>

                      {itemsShown && (
                        <>
                          <div style={{ borderTop: '1px solid #F0EDE8', marginBottom: 8 }} />
                          {itemsLoading ? (
                            <p style={{ fontSize: 12, color: '#AAA', textAlign: 'center', padding: '12px 0' }}>불러오는 중…</p>
                          ) : items.map(item => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #F5F2EE' }}>
                              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: '#888' }}>{item.date_snapshot}</span>
                                <span style={{ fontSize: 12, color: '#1A1A1A' }}>{item.pet_name_snapshot}</span>
                                <span style={{ fontSize: 11, color: '#AAA' }}>{item.breed_snapshot}</span>
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{fmt(item.amount_snapshot)}원</span>
                            </div>
                          ))}
                          {!itemsLoading && items.length === 0 && (
                            <p style={{ fontSize: 12, color: '#BBB', textAlign: 'center', padding: '12px 0' }}>명세 없음</p>
                          )}
                        </>
                      )}

                      {/* 지급완료 시 지급 정보 표시 (읽기 전용) */}
                      {st.status === 'paid' && (
                        <div style={{ borderTop: '1px solid #F0EDE8', paddingTop: 12, marginTop: 8 }}>
                          <div style={{ background: '#EAF4EC', padding: '10px 14px' }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: '#2E7D32', marginBottom: 4 }}>지급완료</p>
                            {st.paid_at && <p style={{ fontSize: 12, color: '#555' }}>지급일: {st.paid_at.slice(0, 10)}</p>}
                            {st.payment_method && <p style={{ fontSize: 12, color: '#555' }}>지급 방식: {st.payment_method}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* 삭제 확인 다이얼로그 */}
      {deleteId && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', zIndex: 100 }}
          onClick={() => !deleting && setDeleteId(null)}
        >
          <div style={{ background: '#FFFFFF', width: '100%', maxWidth: 320, padding: '28px 24px' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 8 }}>삭제하시겠어요?</p>
            <p style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 24 }}>삭제된 매출은 복구할 수 없습니다.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '12px', fontSize: 14, fontWeight: 600, background: deleting ? '#E8E5E0' : '#1A1A1A', color: deleting ? '#AAA' : '#FFFFFF', border: 'none', borderRadius: 0, cursor: deleting ? 'default' : 'pointer' }}>
                {deleting ? '삭제 중…' : '삭제'}
              </button>
              <button onClick={() => setDeleteId(null)} disabled={deleting} style={{ flex: 1, padding: '12px', fontSize: 14, background: 'none', border: '1px solid #E8E5E0', borderRadius: 0, cursor: 'pointer', color: '#555' }}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
