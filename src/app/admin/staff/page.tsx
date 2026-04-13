'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ROLE_LABELS, type Role } from '@/lib/roles'

// TODO: 이 페이지는 owner 역할만 접근 가능하도록 제한 필요
// TODO: getCurrentUserRole() 연동 후 접근 제어 적용

type StaffMember = {
  id: string
  user_id?: string | null
  name: string | null
  role: string | null
  is_active?: boolean | null
  created_at?: string | null
  updated_at?: string | null
}

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [tableExists, setTableExists] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      const { data, error } = await supabase
        .from('staff_profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        console.error('staff_profiles fetch error:', error)
        setTableExists(false)
        setLoading(false)
        return
      }

      setStaff(data ?? [])
      setLoading(false)
    }

    fetchData()
  }, [])

  const filtered = staff.filter((s) => {
    if (roleFilter !== 'all' && s.role !== roleFilter) return false
    if (search) {
      const q = search.toLowerCase()
      const name = (s.name ?? '').toLowerCase()
      const role = (s.role ?? '').toLowerCase()
      if (!name.includes(q) && !role.includes(q)) return false
    }
    return true
  })

  function getRoleLabel(role: string | null): string {
    if (!role) return '-'
    return ROLE_LABELS[role as Role] ?? role
  }

  // 테이블 미존재 안내
  if (!loading && !tableExists) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">스태프 관리</h1>
          <p className="mt-1 text-sm text-neutral-500">역할별 스태프 관리</p>
        </div>

        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <p className="text-base font-semibold text-neutral-700">
            staff_profiles 테이블이 아직 준비되지 않았습니다
          </p>
          <p className="mt-3 text-sm leading-6 text-neutral-500">
            Supabase에 staff_profiles 테이블을 생성하면 이 페이지에서 바로 사용할 수 있습니다.
          </p>

          <div className="mx-auto mt-6 max-w-lg rounded-xl bg-neutral-50 p-5 text-left">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              추천 스키마
            </p>
            <pre className="overflow-x-auto text-xs leading-5 text-neutral-700">
{`create table if not exists staff_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  role text not null default 'staff',
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 역할 값: owner, director, manager, staff`}
            </pre>
          </div>

          <div className="mx-auto mt-6 max-w-lg text-left">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              역할 계층
            </p>
            <ul className="space-y-1.5 text-sm text-neutral-600">
              <li><strong>대표 (owner)</strong> — 모든 기능 + 설정 + 스태프 관리</li>
              <li><strong>부원장 (director)</strong> — 대부분 기능 + 일부 설정</li>
              <li><strong>매니저 (manager)</strong> — 운영 기능 (기록, 제품, 팔로업)</li>
              <li><strong>스태프 (staff)</strong> — 기본 기록 작성 + 조회</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">스태프 관리</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {loading ? '불러오는 중...' : `총 ${staff.length}명`}
          </p>
        </div>
        {/* TODO: 새 스태프 추가 페이지 or 모달 */}
      </div>

      {/* 검색 + 역할 필터 */}
      <div className="space-y-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이름, 역할 검색..."
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-500"
        />
        <div className="flex gap-2 overflow-x-auto">
          {[
            { key: 'all', label: '전체' },
            { key: 'owner', label: '대표' },
            { key: 'director', label: '부원장' },
            { key: 'manager', label: '매니저' },
            { key: 'staff', label: '스태프' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setRoleFilter(tab.key)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
                roleFilter === tab.key
                  ? 'border-neutral-900 bg-neutral-900 text-white'
                  : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-neutral-600">불러오는 중...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm text-neutral-600">
            {search || roleFilter !== 'all'
              ? '조건에 맞는 스태프가 없습니다.'
              : '등록된 스태프가 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((s) => {
            const isActive = s.is_active !== false

            return (
              <Link
                key={s.id}
                href={`/admin/staff/${s.id}`}
                className={`block rounded-2xl bg-white p-5 shadow-sm ring-1 transition hover:ring-neutral-300 ${
                  isActive ? 'ring-neutral-200' : 'ring-neutral-200 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-neutral-900">
                      {s.name ?? '이름 없음'}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                        {getRoleLabel(s.role)}
                      </span>
                      {isActive ? (
                        <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          활성
                        </span>
                      ) : (
                        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-500">
                          비활성
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-neutral-400">→</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
