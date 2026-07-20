'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

type ServiceType = 'grooming' | 'bath' | 'spa' | 'care' | 'other'
type SaleStatus = 'submitted' | 'approved' | 'rejected'
type StatusFilter = 'all' | SaleStatus
type Tab = 'review' | 'settlement'

interface Groomer {
  id: string
  name: string
}

interface Sale {
  id: string
  date: string
  groomer_id: string
  breed: string
  pet_name: string
  amount: number
  service_type: ServiceType
  source: string
  status: SaleStatus
  reject_reason: string | null
  settlement_id: string | null
  memo: string | null
}

interface Settlement {
  id: string
  groomer_id: string
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
  payment_reference: string | null
  created_at: string
}

interface SettlementItem {
  id: string
  sale_id: string
  date_snapshot: string
  pet_name_snapshot: string
  breed_snapshot: string
  amount_snapshot: number
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
  draft:   { label: '정산 중',   bg: '#F5F2EE', color: '#888' },
  paid:    { label: '지급완료',  bg: '#EAF4EC', color: '#2E7D32' },
}

function currentCycle(): { start: string; end: string } {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate()
  if (d >= 21) {
    const endM = m === 12 ? 1 : m + 1, endY = m === 12 ? y + 1 : y
    return { start: `${y}-${String(m).padStart(2,'0')}-21`, end: `${endY}-${String(endM).padStart(2,'0')}-20` }
  }
  const startM = m === 1 ? 12 : m - 1, startY = m === 1 ? y - 1 : y
  return { start: `${startY}-${String(startM).padStart(2,'0')}-21`, end: `${y}-${String(m).padStart(2,'0')}-20` }
}

function fmt(n: number) { return n.toLocaleString('ko-KR') }
function formatAmount(v: string): string {
  const digits = v.replace(/[^0-9]/g, '')
  return digits ? Number(digits).toLocaleString('ko-KR') : ''
}
function parseAmount(v: string): number { return Number(v.replace(/[^0-9]/g, '')) }

function rpcErrorMessage(msg: string): string {
  if (msg.includes('no_approved_sales')) return '정산할 승인된 매출이 없습니다. 기간·미용사를 확인해 주세요.'
  if (msg.includes('unauthorized')) return '정산 권한이 없습니다.'
  return '정산 생성에 실패했습니다. 다시 시도해 주세요.'
}

export default function AdminSettlementPage() {
  const router = useRouter()
  const supabase = createClient()

  const [adminUser, setAdminUser] = useState<{ id: string; email: string; note: string | null } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [denied, setDenied] = useState(false)
  const [tab, setTab] = useState<Tab>('review')

  const cycle = currentCycle()

  // ── 매출 검토 ──
  const [dateStart, setDateStart] = useState(cycle.start)
  const [dateEnd, setDateEnd] = useState(cycle.end)
  const [groomerFilter, setGroomerFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('submitted')
  const [groomers, setGroomers] = useState<Groomer[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [salesLoading, setSalesLoading] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [editId, setEditId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editBreed, setEditBreed] = useState('')
  const [editPetName, setEditPetName] = useState('')
  const [editAmountStr, setEditAmountStr] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectSaving, setRejectSaving] = useState(false)
  const [bulkApproving, setBulkApproving] = useState(false)

  // paid 정산에 바인딩된 매출 판별용 맵
  // 미래에 draft 정산 취소 기능을 추가하더라도, paid 정산 바인딩 매출은 이 맵으로 하드락 유지
  const [settlementStatusMap, setSettlementStatusMap] = useState<Map<string, string>>(new Map())

  // ── 정산 관리 ──
  const [createGroomerId, setCreateGroomerId] = useState<string>('')
  const [createFrom, setCreateFrom] = useState(cycle.start)
  const [createTo, setCreateTo] = useState(cycle.end)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [settlementsLoading, setSettlementsLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<SettlementItem[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [showItems, setShowItems] = useState(false)

  // 지급 처리 폼
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payMethod, setPayMethod] = useState('')
  const [payRef, setPayRef] = useState('')
  const [payProcessing, setPayProcessing] = useState(false)

  // ── 인증 ──
  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/settlement/login'); return }
      const { data: adminRow } = await supabase
        .from('freelance_settlement_admins').select('user_id, note').eq('user_id', user.id).maybeSingle()
      if (!adminRow) { setDenied(true); setAuthChecked(true); return }
      setAdminUser({ id: user.id, email: user.email ?? '', note: adminRow.note })
      setAuthChecked(true)
    }
    checkAuth()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 미용사 목록 ──
  useEffect(() => {
    if (!adminUser) return
    supabase.from('freelance_groomers').select('id, name').eq('is_active', true).then(({ data }) => {
      const list = data ?? []
      setGroomers(list)
      if (list.length > 0) setCreateGroomerId(list[0].id)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminUser])

  // ── 매출 조회 + paid 정산 맵 갱신 ──
  const fetchSales = useCallback(async () => {
    if (!adminUser) return
    setSalesLoading(true)
    setChecked(new Set())

    let q = supabase
      .from('freelance_sales')
      .select('id, date, groomer_id, breed, pet_name, amount, service_type, source, status, reject_reason, settlement_id, memo')
      .is('deleted_at', null)
      .gte('date', dateStart)
      .lte('date', dateEnd)
      .order('date', { ascending: false })
    if (statusFilter !== 'all') q = q.eq('status', statusFilter)
    if (groomerFilter !== 'all') q = q.eq('groomer_id', groomerFilter)

    const { data } = await q
    const salesList = (data as Sale[]) ?? []
    setSales(salesList)

    // 바인딩된 정산들의 status를 별도 조회 → paid 하드락 판별용
    const boundIds = [...new Set(salesList.filter(s => s.settlement_id).map(s => s.settlement_id!))]
    if (boundIds.length > 0) {
      const { data: stData } = await supabase
        .from('freelance_settlements')
        .select('id, status')
        .in('id', boundIds)
      const map = new Map((stData ?? []).map(st => [st.id, st.status]))
      setSettlementStatusMap(map)
    } else {
      setSettlementStatusMap(new Map())
    }

    setSalesLoading(false)
  }, [adminUser, supabase, dateStart, dateEnd, statusFilter, groomerFilter])

  useEffect(() => { if (tab === 'review') fetchSales() }, [fetchSales, tab])

  // ── 정산 목록 ──
  const fetchSettlements = useCallback(async () => {
    if (!adminUser) return
    setSettlementsLoading(true)
    const { data } = await supabase
      .from('freelance_settlements')
      .select('id, groomer_id, period_from, period_to, total_amount, supply_amount, commission_rate, before_tax_amount, withholding_amount, payout_amount, status, paid_at, payment_method, payment_reference, created_at')
      .order('created_at', { ascending: false })
    setSettlements((data as Settlement[]) ?? [])
    setSettlementsLoading(false)
  }, [adminUser, supabase])

  useEffect(() => { if (tab === 'settlement') fetchSettlements() }, [fetchSettlements, tab])

  // ── 정산 상세 items ──
  function toggleExpand(settlementId: string) {
    if (expandedId === settlementId) {
      setExpandedId(null)
      setPayingId(null)
      setShowItems(false)
      setExpandedItems([])
    } else {
      setExpandedId(settlementId)
      setPayingId(null)
      setShowItems(false)
      setExpandedItems([])
    }
  }

  async function loadItems(settlementId: string) {
    setShowItems(true)
    setItemsLoading(true)
    const { data } = await supabase
      .from('freelance_settlement_items')
      .select('id, sale_id, date_snapshot, pet_name_snapshot, breed_snapshot, amount_snapshot')
      .eq('settlement_id', settlementId)
      .order('date_snapshot', { ascending: true })
    setExpandedItems((data as SettlementItem[]) ?? [])
    setItemsLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/settlement/login')
  }

  // ── paid 잠금 판정 ──
  // settlement_id 존재 여부만으로 잠금하면 나중에 draft 정산 취소 시 잠금이 풀릴 수 있음.
  // paid 정산 바인딩 매출은 이 체크로 settlement_id가 null이 되더라도 별도 hard lock 구현 필요.
  // 현재는 settlementStatusMap을 이용해 paid 여부를 명시적으로 확인함.
  // TODO: 미래에 draft 정산 취소 기능 추가 시 — paid 정산(status='paid')은 취소 대상에서 반드시 제외할 것.
  function canAct(s: Sale): boolean {
    const settlementStatus = s.settlement_id ? settlementStatusMap.get(s.settlement_id) : undefined
    const isPaidLocked = settlementStatus === 'paid'
    return s.status === 'submitted' && !isPaidLocked
  }

  function lockLabel(s: Sale): string {
    const settlementStatus = s.settlement_id ? settlementStatusMap.get(s.settlement_id) : undefined
    if (settlementStatus === 'paid') return '지급완료 정산 · 수정 불가'
    if (s.settlement_id) return '정산 확정'
    return '승인 완료'
  }

  // ── 단건 승인 ──
  async function approveSale(id: string) {
    await supabase.from('freelance_sales').update({
      status: 'approved', approved_by: adminUser!.id, approved_at: new Date().toISOString(),
    }).eq('id', id).eq('status', 'submitted')
    await fetchSales()
  }

  // ── 일괄 승인 ──
  async function bulkApprove() {
    if (checked.size === 0) return
    setBulkApproving(true)
    for (const id of Array.from(checked)) {
      await supabase.from('freelance_sales').update({
        status: 'approved', approved_by: adminUser!.id, approved_at: new Date().toISOString(),
      }).eq('id', id).eq('status', 'submitted')
    }
    setBulkApproving(false)
    await fetchSales()
  }

  // ── 수정 저장 ──
  async function handleEditSave() {
    const amt = parseAmount(editAmountStr)
    if (!editBreed.trim()) { setEditError('견종을 입력해 주세요.'); return }
    if (!editPetName.trim()) { setEditError('이름을 입력해 주세요.'); return }
    if (!amt || amt <= 0) { setEditError('금액을 입력해 주세요.'); return }
    setEditSaving(true); setEditError('')
    const original = sales.find(s => s.id === editId)!
    const changes: Record<string, { before: unknown; after: unknown }> = {}
    if (original.date !== editDate) changes.date = { before: original.date, after: editDate }
    if (original.breed !== editBreed.trim()) changes.breed = { before: original.breed, after: editBreed.trim() }
    if (original.pet_name !== editPetName.trim()) changes.pet_name = { before: original.pet_name, after: editPetName.trim() }
    if (original.amount !== amt) changes.amount = { before: original.amount, after: amt }
    await supabase.from('freelance_sales').update({
      date: editDate, breed: editBreed.trim(), pet_name: editPetName.trim(), amount: amt,
    }).eq('id', editId!)
    if (Object.keys(changes).length > 0) {
      const logRows = Object.entries(changes).map(([field, { before, after }]) => ({
        sale_id: editId, field, old_value: String(before), new_value: String(after), changed_by: adminUser!.id,
      }))
      await supabase.from('freelance_sale_logs').insert(logRows)
    }
    setEditId(null); setEditSaving(false)
    await fetchSales()
  }

  // ── 반려 ──
  async function handleReject() {
    if (!rejectReason.trim()) return
    setRejectSaving(true)
    await supabase.from('freelance_sales').update({
      status: 'rejected', reject_reason: rejectReason.trim(),
    }).eq('id', rejectId!).eq('status', 'submitted')
    await supabase.from('freelance_sale_logs').insert({
      sale_id: rejectId, field: 'status', old_value: 'submitted', new_value: 'rejected', changed_by: adminUser!.id,
    })
    setRejectId(null); setRejectReason(''); setRejectSaving(false)
    await fetchSales()
  }

  // ── 정산 생성 ──
  async function handleCreateSettlement() {
    if (!createGroomerId) return
    setCreating(true); setCreateError('')
    const { error } = await supabase.rpc('create_settlement', {
      p_groomer_id: createGroomerId,
      p_period_from: createFrom,
      p_period_to: createTo,
    })
    setCreating(false)
    if (error) { setCreateError(rpcErrorMessage(error.message)); return }
    await fetchSettlements()
  }

  // ── 정산완료 처리 ──
  async function handleMarkPaid(settlementId: string) {
    setPayProcessing(true)
    await supabase.from('freelance_settlements').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      store_confirmed_by: adminUser!.id,
      payment_method: payMethod.trim() || null,
      payment_reference: payRef.trim() || null,
    }).eq('id', settlementId).eq('status', 'draft')
    setPayingId(null); setPayMethod(''); setPayRef(''); setPayProcessing(false)
    await fetchSettlements()
    // 정산 status 변경 후 salesMap도 갱신 필요 — review 탭에서 다시 조회 시 반영됨
  }

  function startEdit(s: Sale) {
    setEditId(s.id); setEditDate(s.date); setEditBreed(s.breed)
    setEditPetName(s.pet_name); setEditAmountStr(s.amount.toLocaleString('ko-KR')); setEditError('')
  }
  function groomerName(id: string) { return groomers.find(g => g.id === id)?.name ?? id.slice(0, 8) }

  const total = sales.reduce((sum, s) => sum + s.amount, 0)
  const checkedSubmitted = sales.filter(s => checked.has(s.id) && s.status === 'submitted')

  const inputStyle: React.CSSProperties = {
    padding: '8px 10px', fontSize: 13, border: '1px solid #E8E5E0',
    borderRadius: 0, background: '#FAFAF8', color: '#1A1A1A', outline: 'none', boxSizing: 'border-box',
  }

  if (!authChecked) return (
    <div style={{ minHeight: '100dvh', background: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 13, color: '#AAA' }}>확인 중…</span>
    </div>
  )

  if (denied) return (
    <div style={{ minHeight: '100dvh', background: '#FAFAF8', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ maxWidth: 360, width: '100%', background: '#FFFFFF', border: '1px solid #E8E5E0', padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 8 }}>접근 권한 없음</p>
        <p style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 24 }}>정산 관리자로 등록되지 않은 계정입니다.</p>
        <a href="/admin/settlement/login" style={{ fontSize: 13, color: '#888', textDecoration: 'underline' }}>다른 계정으로 로그인</a>
      </div>
    </div>
  )

  return (
    <div style={{ background: '#FAFAF8', minHeight: '100dvh', paddingBottom: 60 }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0 20px' }}>
          <span style={{ fontSize: 15, letterSpacing: '0.35em', fontWeight: 600, color: '#1A1A1A' }}>DAZUL</span>
          <span style={{ fontSize: 11, color: '#C9A96E', letterSpacing: '0.12em' }}>정산 관리</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>{adminUser!.note ?? adminUser!.email}</span>
          <button onClick={handleLogout} style={{ fontSize: 12, color: '#AAA', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>로그아웃</button>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E8E5E0', marginBottom: 20 }}>
          {(['review', 'settlement'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 20px', fontSize: 13, fontWeight: tab === t ? 600 : 400,
              color: tab === t ? '#1A1A1A' : '#AAA', background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid #1A1A1A' : '2px solid transparent',
              cursor: 'pointer', marginBottom: -1,
            }}>
              {t === 'review' ? '매출 검토' : '정산 관리'}
            </button>
          ))}
        </div>

        {/* ════ 매출 검토 탭 ════ */}
        {tab === 'review' && (
          <>
            <div style={{ background: '#FFFFFF', border: '1px solid #E8E5E0', padding: '16px 20px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>시작일</label>
                <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} style={{ ...inputStyle, width: 140 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>종료일</label>
                <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} style={{ ...inputStyle, width: 140 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>미용사</label>
                <select value={groomerFilter} onChange={e => setGroomerFilter(e.target.value)} style={{ ...inputStyle, width: 120, cursor: 'pointer' }}>
                  <option value="all">전체</option>
                  {groomers.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>상태</label>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} style={{ ...inputStyle, width: 120, cursor: 'pointer' }}>
                  <option value="submitted">검토 대기</option>
                  <option value="approved">승인</option>
                  <option value="rejected">반려</option>
                  <option value="all">전체</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#888' }}>
                {salesLoading ? '조회 중…' : `${sales.length}건 · 합계 ${fmt(total)}원`}
              </span>
              {checkedSubmitted.length > 0 && (
                <button onClick={bulkApprove} disabled={bulkApproving} style={{
                  padding: '8px 18px', fontSize: 13, fontWeight: 600,
                  background: bulkApproving ? '#E8E5E0' : '#1A1A1A',
                  color: bulkApproving ? '#AAA' : '#FFFFFF',
                  border: 'none', borderRadius: 0, cursor: bulkApproving ? 'default' : 'pointer',
                }}>
                  {bulkApproving ? '처리 중…' : `선택 ${checkedSubmitted.length}건 일괄 승인`}
                </button>
              )}
            </div>

            {!salesLoading && sales.length === 0 && (
              <div style={{ background: '#FFFFFF', border: '1px solid #E8E5E0', padding: '40px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#BBB' }}>해당 조건의 매출이 없습니다.</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sales.map(s => {
                const st = STATUS_STYLE[s.status]
                const isEditing = editId === s.id
                const isChecked = checked.has(s.id)
                const actable = canAct(s)
                return (
                  <div key={s.id} style={{ background: '#FFFFFF', border: isChecked ? '1px solid #C9A96E' : '1px solid #E8E5E0', padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                      {actable ? (
                        <input type="checkbox" checked={isChecked} onChange={e => {
                          const next = new Set(checked); e.target.checked ? next.add(s.id) : next.delete(s.id); setChecked(next)
                        }} style={{ marginTop: 2, accentColor: '#C9A96E', flexShrink: 0 }} />
                      ) : <span style={{ width: 16, flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{groomerName(s.groomer_id)}</span>
                          <span style={{ fontSize: 12, color: '#888' }}>{s.pet_name}</span>
                          <span style={{ fontSize: 12, color: '#AAA' }}>{s.breed}</span>
                          <span style={{ fontSize: 11, color: '#AAA' }}>{SERVICE_LABELS[s.service_type]}</span>
                          {s.source !== 'manual' && (
                            <span style={{ fontSize: 11, color: '#C9A96E', border: '1px solid #E8D8B8', padding: '1px 5px' }}>{s.source}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 12, color: '#888' }}>{s.date}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>{fmt(s.amount)}원</span>
                        </div>
                        {s.memo && !isEditing && <p style={{ fontSize: 11, color: '#AAA', marginTop: 3 }}>{s.memo}</p>}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', background: st.bg, color: st.color, flexShrink: 0 }}>{st.label}</span>
                    </div>

                    {s.status === 'rejected' && s.reject_reason && !isEditing && (
                      <div style={{ background: '#FDF1F0', border: '1px solid #F5C6C2', padding: '6px 10px', marginBottom: 8, marginLeft: 26 }}>
                        <p style={{ fontSize: 12, color: '#C62828' }}>반려 사유: {s.reject_reason}</p>
                      </div>
                    )}

                    {isEditing && (
                      <div style={{ borderTop: '1px solid #F0EDE8', paddingTop: 12, marginTop: 4, marginLeft: 26 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 8 }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>날짜</label>
                            <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>금액 (원)</label>
                            <input type="text" inputMode="decimal" value={editAmountStr} onChange={e => setEditAmountStr(formatAmount(e.target.value))} style={{ ...inputStyle, width: '100%', textAlign: 'right' }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>견종</label>
                            <input type="text" value={editBreed} onChange={e => setEditBreed(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>이름</label>
                            <input type="text" value={editPetName} onChange={e => setEditPetName(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                          </div>
                        </div>
                        {editError && <p style={{ fontSize: 12, color: '#CC3333', marginBottom: 8 }}>{editError}</p>}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={handleEditSave} disabled={editSaving} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: editSaving ? '#E8E5E0' : '#1A1A1A', color: editSaving ? '#AAA' : '#FFFFFF', border: 'none', borderRadius: 0, cursor: editSaving ? 'default' : 'pointer' }}>
                            {editSaving ? '저장 중…' : '저장'}
                          </button>
                          <button onClick={() => setEditId(null)} style={{ padding: '8px 14px', fontSize: 13, color: '#888', background: 'none', border: '1px solid #E8E5E0', borderRadius: 0, cursor: 'pointer' }}>취소</button>
                        </div>
                      </div>
                    )}

                    {!isEditing && actable && (
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                        <button onClick={() => approveSale(s.id)} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: '#2E7D32', color: '#FFFFFF', border: 'none', borderRadius: 0, cursor: 'pointer' }}>승인</button>
                        <button onClick={() => startEdit(s)} style={{ padding: '6px 12px', fontSize: 12, color: '#555', background: 'none', border: '1px solid #E8E5E0', borderRadius: 0, cursor: 'pointer' }}>수정</button>
                        <button onClick={() => { setRejectId(s.id); setRejectReason('') }} style={{ padding: '6px 12px', fontSize: 12, color: '#C62828', background: 'none', border: '1px solid #F5C6C2', borderRadius: 0, cursor: 'pointer' }}>반려</button>
                      </div>
                    )}
                    {!isEditing && !actable && s.status !== 'rejected' && (
                      <div style={{ textAlign: 'right', marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: '#CCC' }}>{lockLabel(s)}</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ════ 정산 관리 탭 ════ */}
        {tab === 'settlement' && (
          <>
            {/* 정산 생성 */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E8E5E0', padding: '20px 20px', marginBottom: 20 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 16 }}>정산 생성</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>미용사</label>
                  <select value={createGroomerId} onChange={e => setCreateGroomerId(e.target.value)} style={{ ...inputStyle, width: 140, cursor: 'pointer' }}>
                    {groomers.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>시작일</label>
                  <input type="date" value={createFrom} onChange={e => setCreateFrom(e.target.value)} style={{ ...inputStyle, width: 140 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>종료일</label>
                  <input type="date" value={createTo} onChange={e => setCreateTo(e.target.value)} style={{ ...inputStyle, width: 140 }} />
                </div>
                <button onClick={handleCreateSettlement} disabled={creating || !createGroomerId} style={{
                  padding: '8px 20px', fontSize: 13, fontWeight: 600,
                  background: creating || !createGroomerId ? '#E8E5E0' : '#C9A96E',
                  color: creating || !createGroomerId ? '#AAA' : '#FFFFFF',
                  border: 'none', borderRadius: 0, cursor: creating || !createGroomerId ? 'default' : 'pointer',
                }}>
                  {creating ? '생성 중…' : '정산 생성'}
                </button>
              </div>
              {createError && <p style={{ fontSize: 12, color: '#CC3333', marginTop: 10 }}>{createError}</p>}
            </div>

            <p style={{ fontSize: 12, color: '#AAA', marginBottom: 10 }}>
              {settlementsLoading ? '조회 중…' : `정산 ${settlements.length}건`}
            </p>

            {!settlementsLoading && settlements.length === 0 && (
              <div style={{ background: '#FFFFFF', border: '1px solid #E8E5E0', padding: '40px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#BBB' }}>생성된 정산이 없습니다.</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {settlements.map(st => {
                const isExpanded = expandedId === st.id
                const stBadge = SETTLEMENT_STATUS_LABEL[st.status] ?? { label: st.status, bg: '#F5F2EE', color: '#888' }
                const isPaid = st.status === 'paid'
                const isThisPaying = payingId === st.id
                return (
                  <div key={st.id} style={{ border: '1px solid #E8E5E0', overflow: 'hidden' }}>
                    <button onClick={() => toggleExpand(st.id)} style={{
                      width: '100%', background: '#FFFFFF', border: 'none', cursor: 'pointer',
                      padding: '16px 18px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{groomerName(st.groomer_id)}</span>
                      <span style={{ fontSize: 12, color: '#888' }}>{st.period_from} ~ {st.period_to}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', background: stBadge.bg, color: stBadge.color }}>{stBadge.label}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 700, color: '#C9A96E' }}>{fmt(st.payout_amount)}원</span>
                      <span style={{ fontSize: 12, color: '#AAA' }}>{isExpanded ? '▲' : '▼'}</span>
                    </button>

                    {isExpanded && (
                      <div>
                        {/* 계산 명세 카드 */}
                        <div style={{ background: '#FAFAF8', border: '1px solid #E8E5E0', borderTop: 'none', padding: '18px 20px' }}>
                          {/* 상단: 기간 매출 합계 */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                            <span style={{ fontSize: 13, color: '#4A463F' }}>기간 매출 합계</span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{fmt(st.total_amount)}원</span>
                          </div>
                          {/* 세부 금액 — 항상 표시 */}
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
                          {/* 구분선 + 최종 지급액 */}
                          <div style={{ borderTop: '1px solid #E8E5E0', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#C9A96E' }}>최종 지급액</span>
                            <span style={{ fontSize: 18, fontWeight: 700, color: '#C9A96E' }}>{fmt(st.payout_amount)}원</span>
                          </div>
                        </div>

                        {/* 스냅샷 명세 */}
                        <div style={{ background: '#FFFFFF', padding: '0 18px 16px' }}>
                          <button
                            onClick={() => showItems ? setShowItems(false) : loadItems(st.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0 8px' }}
                          >
                            {showItems ? '매출 내역 닫기 ▲' : '매출 내역 보기 ▼'}
                          </button>

                          {showItems && (
                            <>
                              <div style={{ borderTop: '1px solid #F0EDE8', marginBottom: 8 }} />
                              {itemsLoading ? (
                                <p style={{ fontSize: 12, color: '#AAA', textAlign: 'center', padding: '12px 0' }}>불러오는 중…</p>
                              ) : expandedItems.map(item => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #F5F2EE' }}>
                                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <span style={{ fontSize: 12, color: '#888' }}>{item.date_snapshot}</span>
                                    <span style={{ fontSize: 12, color: '#1A1A1A' }}>{item.pet_name_snapshot}</span>
                                    <span style={{ fontSize: 11, color: '#AAA' }}>{item.breed_snapshot}</span>
                                  </div>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>{fmt(item.amount_snapshot)}원</span>
                                </div>
                              ))}
                              {!itemsLoading && expandedItems.length === 0 && (
                                <p style={{ fontSize: 12, color: '#BBB', textAlign: 'center', padding: '12px 0' }}>명세 없음</p>
                              )}
                            </>
                          )}

                          {/* 상태 액션 영역 */}
                          <div style={{ borderTop: '1px solid #F0EDE8', paddingTop: 16, marginTop: 8 }}>
                            {isPaid ? (
                              /* paid: 지급 정보 표시, 버튼 없음 (최종 잠금) */
                              <div style={{ background: '#F5F2EE', padding: '12px 14px' }}>
                                <p style={{ fontSize: 12, fontWeight: 600, color: '#2E7D32', marginBottom: 6 }}>지급완료</p>
                                {st.paid_at && <p style={{ fontSize: 12, color: '#888' }}>지급일: {st.paid_at.slice(0, 10)}</p>}
                                {st.payment_method && <p style={{ fontSize: 12, color: '#888' }}>지급 방식: {st.payment_method}</p>}
                                {st.payment_reference && <p style={{ fontSize: 12, color: '#888' }}>메모: {st.payment_reference}</p>}
                              </div>
                            ) : (
                              /* draft: 정산완료 처리 */
                              isThisPaying ? (
                                <div>
                                  <p style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>지급 정보 입력 (선택)</p>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                                    <input
                                      type="text" value={payMethod} onChange={e => setPayMethod(e.target.value)}
                                      placeholder="지급 방식 (예: 계좌이체)"
                                      style={{ ...inputStyle, width: '100%' }}
                                    />
                                    <input
                                      type="text" value={payRef} onChange={e => setPayRef(e.target.value)}
                                      placeholder="메모 (예: 하나은행 110-xxx)"
                                      style={{ ...inputStyle, width: '100%' }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                      onClick={() => handleMarkPaid(st.id)}
                                      disabled={payProcessing}
                                      style={{ flex: 1, padding: '10px', fontSize: 13, fontWeight: 600, background: payProcessing ? '#E8E5E0' : '#1A1A1A', color: payProcessing ? '#AAA' : '#FFFFFF', border: 'none', borderRadius: 0, cursor: payProcessing ? 'default' : 'pointer' }}
                                    >
                                      {payProcessing ? '처리 중…' : '정산완료 확정'}
                                    </button>
                                    <button onClick={() => { setPayingId(null); setPayMethod(''); setPayRef('') }} style={{ padding: '10px 16px', fontSize: 13, color: '#888', background: 'none', border: '1px solid #E8E5E0', borderRadius: 0, cursor: 'pointer' }}>
                                      취소
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setPayingId(st.id)}
                                  style={{ width: '100%', padding: '11px', fontSize: 13, fontWeight: 600, background: '#C9A96E', color: '#FFFFFF', border: 'none', borderRadius: 0, cursor: 'pointer' }}
                                >
                                  정산완료 처리
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* 반려 모달 */}
      {rejectId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', zIndex: 100 }}
          onClick={() => !rejectSaving && setRejectId(null)}>
          <div style={{ background: '#FFFFFF', width: '100%', maxWidth: 360, padding: '28px 24px' }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1A1A', marginBottom: 8 }}>반려 사유 입력</p>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>미용사에게 표시됩니다. 필수 입력.</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="예: POS 금액 불일치 (POS 85,000원)" rows={3}
              style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid #E8E5E0', borderRadius: 0, background: '#FAFAF8', color: '#1A1A1A', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleReject} disabled={rejectSaving || !rejectReason.trim()} style={{ flex: 1, padding: '12px', fontSize: 14, fontWeight: 600, background: rejectSaving || !rejectReason.trim() ? '#E8E5E0' : '#C62828', color: rejectSaving || !rejectReason.trim() ? '#AAA' : '#FFFFFF', border: 'none', borderRadius: 0, cursor: rejectSaving || !rejectReason.trim() ? 'default' : 'pointer' }}>
                {rejectSaving ? '처리 중…' : '반려'}
              </button>
              <button onClick={() => setRejectId(null)} disabled={rejectSaving} style={{ flex: 1, padding: '12px', fontSize: 14, background: 'none', border: '1px solid #E8E5E0', borderRadius: 0, cursor: 'pointer', color: '#555' }}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
