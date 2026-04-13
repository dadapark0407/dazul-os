'use client'

import { useState } from 'react'
import {
  generateReportDraft,
  type ReportDraftInput,
} from '@/lib/reportDraft'

// TODO: AI API 연동 시 "AI로 생성" 버튼 추가
// TODO: message_templates 연동 시 템플릿 선택 드롭다운 추가

type Props = {
  /** 현재 폼/레코드 데이터를 반환하는 함수 */
  getInput: () => ReportDraftInput
  /** 생성된 리포트를 외부로 전달 (선택) */
  onDraftGenerated?: (draft: string) => void
}

export default function ReportDraftGenerator({ getInput, onDraftGenerated }: Props) {
  const [draft, setDraft] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleGenerate() {
    const input = getInput()
    const result = generateReportDraft(input)
    setDraft(result.fullText)
    setIsOpen(true)
    onDraftGenerated?.(result.fullText)
  }

  function handleRegenerate() {
    const input = getInput()
    const result = generateReportDraft(input)
    setDraft(result.fullText)
    onDraftGenerated?.(result.fullText)
  }

  async function handleCopy() {
    if (!draft) return
    try {
      await navigator.clipboard.writeText(draft)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 클립보드 API 미지원 — fallback
      const textarea = document.createElement('textarea')
      textarea.value = draft
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!isOpen) {
    return (
      <section className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              리포트 초안 생성
            </h2>
            <p className="mt-1 text-xs text-neutral-400">
              입력된 기록을 기반으로 보호자 공유용 리포트 초안을 생성합니다
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700"
          >
            <span className="text-base">✨</span>
            리포트 초안 생성
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            리포트 초안
          </h2>
          <p className="mt-1 text-xs text-neutral-400">
            내용을 수정한 뒤 복사하여 보호자에게 전달하세요
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRegenerate}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            다시 생성
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              copied
                ? 'bg-green-50 text-green-700'
                : 'bg-neutral-900 text-white hover:bg-neutral-700'
            }`}
          >
            {copied ? '복사됨 ✓' : '복사하기'}
          </button>
        </div>
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={18}
        className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-7 text-neutral-800 outline-none focus:border-neutral-400 focus:bg-white"
      />

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-neutral-400">
          {draft.length}자 · 수정 후 복사하여 사용하세요
        </p>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-xs font-medium text-neutral-400 hover:text-neutral-600"
        >
          접기
        </button>
      </div>
    </section>
  )
}
