'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// 소프트 삭제 유지 기간 (일)
const RETENTION_DAYS = 30

type TabKey = 'guardians' | 'pets' | 'visit_records'

type TrashItem = {
  id: string | number
  label: string
  sub?: string
  deletedAt: string
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function daysRemaining(deletedAt: string): number {
  const d = new Date(deletedAt).getTime()
  if (Number.isNaN(d)) return 0
  const expireAt = d + RETENTION_DAYS * 24 * 60 * 60 * 1000
  const remaining = Math.ceil((expireAt - Date.now()) / (24 * 60 * 60 * 1000))
  return Math.max(0, remaining)
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'guardians', label: '보호자' },
  { key: 'pets', label: '반려견' },
  { key: 'visit_records', label: '케어 기록' },
]

export default function TrashPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('guardians')
  const [items, setItems] = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | number | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')

    if (activeTab === 'guardians') {
      const { data, error } = await supabase
        .from('guardians')
        .select('id, name, phone, deleted_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
      if (error) setErrorMsg(error.message)
      setItems(
        (data ?? []).map((r) => ({
          id: r.id,
          label: r.name ?? '이름 없음',
          sub: r.phone ?? '',
          deletedAt: r.deleted_at,
        }))
      )
    } else if (activeTab === 'pets') {
      const { data, error } = await supabase
        .from('pets')
        .select('id, name, breed, deleted_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
      if (error) setErrorMsg(error.message)
      setItems(
        (data ?? []).map((r) => ({
          id: r.id,
          label: r.name ?? '이름 없음',
          sub: r.breed ?? '',
          deletedAt: r.deleted_at,
        }))
      )
    } else {
      const { data, error } = await supabase
        .from('visit_records')
        .select('id, visit_date, pet_name, guardian_name, deleted_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
      if (error) setErrorMsg(error.message)
      setItems(
        (data ?? []).map((r) => ({
          id: r.id,
          label: `${formatDate(r.visit_date)} · ${r.pet_name ?? '-'}`,
          sub: r.guardian_name ?? '',
          deletedAt: r.deleted_at,
        }))
      )
    }

    setLoading(false)
  }, [activeTab])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  async function handleRestore(id: string | number) {
    setBusyId(id)
    setErrorMsg('')
    const { error } = await supabase
      .from(activeTab)
      .update({ deleted_at: null })
      .eq('id', id)
    setBusyId(null)
    if (error) {
      setErrorMsg(`복구 실패: ${error.message}`)
      return
    }
    fetchItems()
  }

  async function handlePurge(id: string | number) {
    if (!confirm('이 항목을 완전히 삭제하시겠습니까? 복구할 수 없습니다.')) return
    setBusyId(id)
    setErrorMsg('')
    const { error } = await supabase.from(activeTab).delete().eq('id', id)
    setBusyId(null)
    if (error) {
      setErrorMsg(`완전삭제 실패: ${error.message}`)
      return
    }
    fetchItems()
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">휴지통</h1>
        <p className="mt-1 text-sm" style={{ color: '#8A8A7A' }}>
          삭제된 항목은 {RETENTION_DAYS}일간 보관 후 자동으로 영구 삭제됩니다
        </p>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid #E8E5E0', paddingBottom: 12 }}>
        {TABS.map((t) => {
          const active = t.key === activeTab
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '4px 0',
                borderBottom: active ? '1px solid #0A0A0A' : '1px solid transparent',
                color: active ? '#1A1A1A' : '#8A8A7A',
                fontWeight: active ? 500 : 300,
                fontSize: 12,
                letterSpacing: '0.1em',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

      {loading ? (
        <p className="text-sm" style={{ color: '#8A8A7A' }}>불러오는 중...</p>
      ) : items.length === 0 ? (
        <div
          style={{
            border: '1px solid #E8E5E0',
            padding: 40,
            textAlign: 'center',
            background: '#FFFFFF',
          }}
        >
          <p className="text-sm" style={{ color: '#8A8A7A' }}>휴지통이 비어 있습니다.</p>
        </div>
      ) : (
        <ul className="space-y-0">
          {items.map((item) => {
            const days = daysRemaining(item.deletedAt)
            return (
              <li
                key={`${activeTab}-${item.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  borderBottom: '1px solid #E8E5E0',
                  padding: '16px 4px',
                }}
              >
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 14, color: '#8A8A7A', fontWeight: 400 }}>
                    {item.label}
                  </p>
                  {item.sub && (
                    <p className="mt-0.5 text-xs" style={{ color: '#8A8A7A' }}>{item.sub}</p>
                  )}
                  <p className="mt-1 text-xs" style={{ color: '#8A8A7A' }}>
                    삭제: {formatDate(item.deletedAt)}
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: '#C9A96E', letterSpacing: '0.05em' }}>
                    {days > 0 ? `${days}일 후 완전 삭제` : '곧 완전 삭제'}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRestore(item.id)}
                    disabled={busyId === item.id}
                    style={{
                      border: '1px solid #7A9E8A',
                      color: '#7A9E8A',
                      background: '#FFFFFF',
                      borderRadius: 0,
                      fontSize: 11,
                      letterSpacing: '0.1em',
                      padding: '8px 14px',
                      cursor: busyId === item.id ? 'not-allowed' : 'pointer',
                      opacity: busyId === item.id ? 0.5 : 1,
                    }}
                  >
                    복구
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePurge(item.id)}
                    disabled={busyId === item.id}
                    style={{
                      background: '#0A0A0A',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 0,
                      fontSize: 11,
                      letterSpacing: '0.1em',
                      padding: '8px 14px',
                      cursor: busyId === item.id ? 'not-allowed' : 'pointer',
                      opacity: busyId === item.id ? 0.5 : 1,
                    }}
                  >
                    완전삭제
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
