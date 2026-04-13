'use client'

import { useEffect, useState } from 'react'
import {
  isAutoFollowupEnabled,
  setAutoFollowupEnabled,
} from '@/lib/autoFollowup'

// TODO: 역할 기반 인증 추가 필요 (director 이상)
// TODO: 설정 값 저장 — settings 테이블 또는 KV 스토어 연동 예정
// TODO: 현재 자동 팔로업 설정만 localStorage 기반 — 나머지는 DB 연동 대기

const SETTINGS_SECTIONS = [
  {
    title: '살롱 프로필',
    description: '살롱 기본 정보와 운영 설정',
    items: [
      { label: '살롱 이름', value: 'DAZUL', placeholder: '살롱 이름 입력' },
      { label: '대표 연락처', value: '', placeholder: '전화번호 입력' },
      { label: '주소', value: '', placeholder: '살롱 주소 입력' },
      { label: '운영 시간', value: '', placeholder: '예: 10:00 - 19:00' },
    ],
  },
  {
    title: '리포트 설정',
    description: '보호자에게 공유하는 리포트 관련 설정',
    items: [
      { label: '리포트 만료 기간', value: '', placeholder: '예: 30일' },
      { label: '리포트 기본 언어', value: '한국어', placeholder: '' },
      { label: '리포트 하단 안내 문구', value: '', placeholder: '보호자에게 보여질 안내 문구' },
    ],
  },
  {
    title: '알림 설정',
    description: '방문 알림 및 후속 관리 알림 설정',
    items: [
      { label: '자동 리마인더', value: '비활성', placeholder: '' },
      { label: '알림 채널', value: '', placeholder: '예: SMS, 카카오톡' },
      { label: '후속 관리 알림 기한', value: '', placeholder: '예: 방문 후 7일' },
    ],
  },
]

const FOLLOWUP_RULES = [
  { trigger: '모든 방문', type: '재방문', timing: '4주 뒤 (서비스별 조정)' },
  { trigger: '피부 이슈 감지', type: '피부 체크', timing: '2주 뒤' },
  { trigger: '높은 스트레스 / 예민', type: '컨디션 체크', timing: '1주 뒤' },
  { trigger: '모질 문제 감지', type: '모질 체크', timing: '3주 뒤' },
]

export default function AdminSettingsPage() {
  const [autoFollowup, setAutoFollowup] = useState(true)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setAutoFollowup(isAutoFollowupEnabled())
    setLoaded(true)
  }, [])

  function handleToggleAutoFollowup() {
    const next = !autoFollowup
    setAutoFollowup(next)
    setAutoFollowupEnabled(next)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">설정</h1>
        <p className="mt-1 text-sm text-neutral-500">
          살롱 프로필, 리포트, 알림, 자동화 설정을 관리합니다
        </p>
      </div>

      {/* 자동 팔로업 설정 — 활성 기능 */}
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

      {/* 기존 설정 섹션들 (준비 중) */}
      <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-5 py-4">
        <p className="text-sm font-medium text-amber-800">
          아래 설정 항목은 현재 준비 중입니다.
        </p>
        <p className="mt-1 text-xs text-amber-600">
          구조 확인용이며, DB 연동 후 실제 저장이 활성화됩니다.
        </p>
      </div>

      <div className="space-y-6">
        {SETTINGS_SECTIONS.map((section) => (
          <section
            key={section.title}
            className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200"
          >
            <h2 className="text-lg font-bold text-neutral-900">{section.title}</h2>
            <p className="mt-1 text-sm text-neutral-500">{section.description}</p>

            <div className="mt-5 space-y-4">
              {section.items.map((item) => (
                <div key={item.label}>
                  <label className="mb-1.5 block text-sm font-medium text-neutral-700">
                    {item.label}
                  </label>
                  <input
                    type="text"
                    defaultValue={item.value}
                    placeholder={item.placeholder}
                    disabled
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500"
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-xl bg-neutral-200 px-6 py-3 text-sm font-semibold text-neutral-400"
        >
          저장 (준비 중)
        </button>
      </div>
    </div>
  )
}
