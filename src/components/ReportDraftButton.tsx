'use client'

import { useState } from 'react'
import {
  generateReportDraft,
  type ReportDraftInput,
} from '@/lib/reportDraft'

/**
 * 서버 컴포넌트(상세 페이지)에서 사용할 수 있는 리포트 생성 버튼
 * input을 props로 받아서 클릭 시 생성 + 미리보기 표시
 */
export default function ReportDraftButton({ input }: { input: ReportDraftInput }) {
  const [draft, setDraft] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleGenerate() {
    const result = generateReportDraft(input)
    setDraft(result.fullText)
    setIsOpen(true)
  }

  async function handleCopy() {
    if (!draft) return
    try {
      await navigator.clipboard.writeText(draft)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
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
      <button
        type="button"
        onClick={handleGenerate}
        className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
      >
        <span>✨</span>
        리포트 초안 생성
      </button>
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
            내용을 확인한 뒤 복사하여 보호자에게 전달하세요
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleGenerate}
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
        rows={16}
        className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-7 text-neutral-800 outline-none focus:border-neutral-400 focus:bg-white"
      />

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-neutral-400">{draft.length}자</p>
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
