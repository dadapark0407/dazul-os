'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  isAutoFollowupEnabled,
  setAutoFollowupEnabled,
} from '@/lib/autoFollowup'
import { ALL_NAV_ITEMS } from '@/lib/navigation'
import {
  LayoutDashboard, PawPrint, Calendar, ClipboardList,
  BarChart2, Package, Users, CreditCard, Megaphone, Bell,
  Settings, ChevronRight, FileText, MessageSquare, Tag, UserPlus,
} from 'lucide-react'

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, PawPrint, Calendar, ClipboardList,
  BarChart2, Package, Users, CreditCard, Megaphone, Bell,
  Settings, FileText, MessageSquare, Tag, UserPlus,
}

const CATEGORY_LABELS: Record<string, string> = {
  main: '메인',
  analytics: '분석',
  management: '운영 관리',
  marketing: '마케팅',
  settings: '시스템 설정',
}

// TODO: 역할 기반 인증 추가 필요 (director 이상)

const FOLLOWUP_RULES = [
  { trigger: '모든 방문', type: '재방문', timing: '4주 뒤 (서비스별 조정)' },
  { trigger: '피부 이슈 감지', type: '피부 체크', timing: '2주 뒤' },
  { trigger: '높은 스트레스 / 예민', type: '컨디션 체크', timing: '1주 뒤' },
  { trigger: '모질 문제 감지', type: '모질 체크', timing: '3주 뒤' },
]

export default function AdminSettingsPage() {
  const [autoFollowup, setAutoFollowup] = useState(true)
  const [loaded, setLoaded] = useState(false)

  // 살롱 설정 상태
  const [salonId, setSalonId] = useState<string | null>(null)
  const [salonName, setSalonName] = useState('')
  const [phone, setPhone] = useState('')
  const [instagram, setInstagram] = useState('')
  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [salonLoading, setSalonLoading] = useState(true)
  const [salonSaving, setSalonSaving] = useState(false)
  const [salonMessage, setSalonMessage] = useState('')
  const [salonError, setSalonError] = useState('')
  const [tableExists, setTableExists] = useState(true)

  useEffect(() => {
    setAutoFollowup(isAutoFollowupEnabled())
    setLoaded(true)

    // salon_settings 로드
    async function loadSalon() {
      setSalonLoading(true)
      const { data, error } = await supabase
        .from('salon_settings')
        .select('*')
        .limit(1)
        .maybeSingle()

      if (error) {
        console.warn('salon_settings 조회 실패:', error.message)
        setTableExists(false)
        setSalonLoading(false)
        return
      }

      if (data) {
        setSalonId(data.id)
        setSalonName(data.salon_name ?? '')
        setPhone(data.phone ?? '')
        setInstagram(data.instagram ?? '')
        setAddress(data.address ?? '')
        setDescription(data.description ?? '')
      }
      setSalonLoading(false)
    }

    loadSalon()
  }, [])

  function handleToggleAutoFollowup() {
    const next = !autoFollowup
    setAutoFollowup(next)
    setAutoFollowupEnabled(next)
  }

  async function handleSaveSalon() {
    setSalonSaving(true)
    setSalonMessage('')
    setSalonError('')

    const payload = {
      salon_name: salonName.trim() || 'DAZUL',
      phone: phone.trim() || null,
      instagram: instagram.trim() || null,
      address: address.trim() || null,
      description: description.trim() || null,
      updated_at: new Date().toISOString(),
    }

    if (salonId) {
      const { error } = await supabase
        .from('salon_settings')
        .update(payload)
        .eq('id', salonId)

      if (error) {
        setSalonError(`저장 실패: ${error.message}`)
        setSalonSaving(false)
        return
      }
    } else {
      const { data, error } = await supabase
        .from('salon_settings')
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        setSalonError(`저장 실패: ${error.message}`)
        setSalonSaving(false)
        return
      }
      setSalonId(data.id)
    }

    setSalonMessage('저장되었습니다.')
    setSalonSaving(false)
    setTimeout(() => setSalonMessage(''), 3000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">설정</h1>
        <p className="mt-1 text-sm text-neutral-500">
          살롱 프로필, 리포트, 알림, 자동화 설정을 관리합니다
        </p>
      </div>

      {/* ─── 살롱 프로필 (DB 연동) ─── */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <h2 className="text-lg font-bold text-neutral-900">살롱 프로필</h2>
        <p className="mt-1 text-sm text-neutral-500">
          살롱 기본 정보 · 리포트 공유 페이지에 표시됩니다
        </p>

        {!tableExists ? (
          <div className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">
              salon_settings 테이블이 아직 없습니다.
            </p>
            <p className="mt-1 text-xs text-amber-600">
              Supabase SQL Editor에서 salon_settings 테이블을 생성하세요.
            </p>
          </div>
        ) : salonLoading ? (
          <div className="mt-4 rounded-xl bg-neutral-50 p-6 text-center">
            <p className="text-sm text-neutral-500">불러오는 중...</p>
          </div>
        ) : (
          <>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                  살롱 이름 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={salonName}
                  onChange={(e) => setSalonName(e.target.value)}
                  placeholder="살롱 이름 입력"
                  className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                  대표 연락처
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="예: 010-1234-5678"
                  className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Instagram
                </label>
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="예: @dazul_pet"
                  className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                  주소
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="살롱 주소 입력"
                  className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                  소개글
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="살롱 소개글을 입력하세요"
                  className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
                />
              </div>
            </div>

            {salonError && (
              <p className="mt-3 text-sm text-red-600">{salonError}</p>
            )}
            {salonMessage && (
              <p className="mt-3 text-sm text-green-600">{salonMessage}</p>
            )}

            <div className="mt-5">
              <button
                type="button"
                onClick={handleSaveSalon}
                disabled={salonSaving}
                className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
              >
                {salonSaving ? '저장 중...' : '살롱 정보 저장'}
              </button>
            </div>
          </>
        )}
      </section>

      {/* ─── 자동 팔로업 설정 ─── */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">자동 팔로업 생성</h2>
            <p className="mt-1 text-sm text-neutral-500">
              방문 기록 저장 시 건강 상태와 서비스 유형을 분석하여 후속 관리 항목을 자동 생성합니다.
            </p>
          </div>
          {loaded && (
            <button
              type="button"
              onClick={handleToggleAutoFollowup}
              className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                autoFollowup ? 'bg-green-500' : 'bg-neutral-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  autoFollowup ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          )}
        </div>

        <div className={`mt-4 transition-opacity ${autoFollowup ? 'opacity-100' : 'opacity-40'}`}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            자동 생성 규칙
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                  <th className="pb-2 pr-4">트리거</th>
                  <th className="pb-2 pr-4">유형</th>
                  <th className="pb-2">기한</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {FOLLOWUP_RULES.map((rule) => (
                  <tr key={rule.type}>
                    <td className="py-2.5 pr-4 text-neutral-700">{rule.trigger}</td>
                    <td className="py-2.5 pr-4">
                      <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                        {rule.type}
                      </span>
                    </td>
                    <td className="py-2.5 text-neutral-600">{rule.timing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-xl bg-neutral-50 p-4">
            <p className="text-xs leading-5 text-neutral-500">
              <strong>중복 방지:</strong> 같은 방문 기록에 대해 동일 유형의 팔로업은 한 번만 생성됩니다.
              <br />
              <strong>수동 편집:</strong> 자동 생성된 팔로업은 후속 관리 페이지에서 수정/삭제할 수 있습니다.
              <br />
              <strong>적용 범위:</strong> 이 설정은 이 브라우저에만 적용됩니다. (향후 계정별 설정 예정)
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              autoFollowup ? 'bg-green-500' : 'bg-neutral-300'
            }`}
          />
          <span className="text-sm font-medium text-neutral-600">
            {autoFollowup ? '활성 — 방문 기록 저장 시 자동 생성됨' : '비활성 — 수동으로만 팔로업 생성'}
          </span>
        </div>
      </section>

      {/* ─── 추가 메뉴 (숨겨진 기능) ─── */}
      <HiddenNavSection />
    </div>
  )
}

// ─── 숨겨진 네비게이션 섹션 ───

function HiddenNavSection() {
  const grouped = useMemo(() => {
    const hidden = ALL_NAV_ITEMS.filter((item) => item.hidden)
    const map: Record<string, typeof hidden> = {}
    for (const item of hidden) {
      const cat = item.category || 'etc'
      if (!map[cat]) map[cat] = []
      map[cat].push(item)
    }
    return map
  }, [])

  if (Object.keys(grouped).length === 0) return null

  return (
    <section>
      <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-dz-muted">
        추가 메뉴
      </h2>
      <p className="mt-1 text-[12px] text-dz-muted/50">
        사이드바에서 숨겨진 기능입니다. 아래에서 바로 이동할 수 있습니다.
      </p>

      <div className="mt-4 space-y-5">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-dz-accent/70">
              {CATEGORY_LABELS[category] ?? category}
            </p>
            <div className="overflow-hidden border border-dz-border/50 bg-white">
              {items.map((item, idx) => {
                const Icon = ICON_MAP[item.icon]
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`flex items-center gap-4 px-5 py-4 transition-all duration-400 hover:bg-dz-surface group ${
                      idx < items.length - 1 ? 'border-b border-dz-border/30' : ''
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-dz-border/50 bg-dz-surface transition-colors group-hover:border-dz-accent/30">
                      {Icon && <Icon className="h-4 w-4 text-dz-accent" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-light tracking-wide text-dz-primary">{item.label}</p>
                      <p className="text-[10px] text-dz-muted/40">{item.href}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-dz-border transition-colors group-hover:text-dz-accent" />
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
