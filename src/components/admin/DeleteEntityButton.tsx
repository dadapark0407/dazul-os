'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/**
 * 범용 삭제 버튼 + 확인 모달
 * - `table` + `recordId` 로 DELETE
 * - 완료 후 `redirectPath` 로 이동
 * - 스타일: 샤넬 무드 (rounded-none, 베이지 보더)
 */
export default function DeleteEntityButton({
  table,
  recordId,
  title,
  warningText,
  redirectPath,
}: {
  table: string
  recordId: string
  title: string
  warningText: string
  redirectPath: string
}) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleDelete() {
    setDeleting(true)
    setErrorMsg('')
    const { error } = await supabase.from(table).delete().eq('id', recordId)

    if (error) {
      setErrorMsg(`삭제 실패: ${error.message}`)
      setDeleting(false)
      return
    }

    router.push(redirectPath)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8E5E0',
          color: '#8A8A7A',
          borderRadius: 0,
          fontSize: 11,
          letterSpacing: '0.1em',
          padding: '8px 16px',
          cursor: 'pointer',
        }}
      >
        삭제
      </button>

      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              background: '#FFFFFF',
              maxWidth: 420,
              width: '100%',
              padding: 28,
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', marginBottom: 10, letterSpacing: '0.08em' }}>
              {title}
            </p>
            <p style={{ fontSize: 14, color: '#1A1A1A', lineHeight: 1.8, marginBottom: 20 }}>
              {warningText}
            </p>
            {errorMsg && (
              <p style={{ fontSize: 12, color: '#c23131', marginBottom: 12 }}>{errorMsg}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false)
                  setErrorMsg('')
                }}
                disabled={deleting}
                style={{
                  flex: 1,
                  border: '1px solid #E8E5E0',
                  background: '#FFFFFF',
                  color: '#8A8A7A',
                  borderRadius: 0,
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  padding: 12,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1,
                  background: '#0A0A0A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 0,
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  padding: 12,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? '삭제 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
