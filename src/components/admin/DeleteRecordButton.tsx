'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function DeleteRecordButton({ recordId }: { recordId: string }) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const { error } = await supabase
      .from('visit_records')
      .delete()
      .eq('id', recordId)

    if (error) {
      alert(`삭제 실패: ${error.message}`)
      setDeleting(false)
      return
    }

    router.push('/admin/records')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        style={{
          border: '1px solid #E8E8E8',
          background: '#FFFFFF',
          color: '#C9A96E',
          fontSize: 12,
          letterSpacing: '0.08em',
          padding: '8px 16px',
          cursor: 'pointer',
        }}
      >
        삭제
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div style={{ background: '#FFFFFF', maxWidth: 360, width: '100%', padding: 28 }}>
            <p style={{ fontSize: 15, fontWeight: 500, color: '#0A0A0A', marginBottom: 8 }}>
              기록 삭제
            </p>
            <p style={{ fontSize: 12, color: '#6B6B6B', lineHeight: 1.6, marginBottom: 20 }}>
              이 기록을 삭제하면 복구할 수 없습니다.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                style={{
                  flex: 1, border: '1px solid #0A0A0A', background: '#FFFFFF',
                  color: '#0A0A0A', fontSize: 11, letterSpacing: '0.1em', padding: 12, cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1, background: '#0A0A0A', color: '#FFFFFF',
                  fontSize: 11, letterSpacing: '0.1em', padding: 12, border: 'none',
                  cursor: 'pointer', opacity: deleting ? 0.5 : 1,
                }}
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
