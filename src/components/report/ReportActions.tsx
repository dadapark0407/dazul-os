'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        width: '100%',
        border: '1px solid #E8E8E8',
        background: '#FFFFFF',
        color: '#6B6B6B',
        fontSize: 11,
        letterSpacing: '0.1em',
        padding: 14,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {copied ? '복사됨 ✓' : '🔗 링크 복사'}
    </button>
  )
}

export function AdminMenu({ recordId }: { recordId: string | number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
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
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        style={{
          fontSize: 11,
          color: '#888',
          border: '1px solid #E8E8E8',
          background: '#FFFFFF',
          padding: '6px 12px',
          cursor: 'pointer',
        }}
      >
        ···
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: 4,
            background: '#FFFFFF',
            border: '1px solid #E8E8E8',
            zIndex: 10,
            minWidth: 120,
          }}
        >
          <button
            type="button"
            onClick={() => { setOpen(false); router.push(`/admin/records/${recordId}/edit`) }}
            style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 12, padding: '10px 14px', color: '#0A0A0A', background: 'none', border: 'none', borderBottom: '1px solid #E8E8E8', cursor: 'pointer' }}
          >
            기록 수정
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setShowDeleteConfirm(true) }}
            style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 12, padding: '10px 14px', color: '#C9A96E', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            기록 삭제
          </button>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div style={{ background: '#FFFFFF', maxWidth: 340, width: '100%', padding: 28 }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#0A0A0A', marginBottom: 8 }}>기록 삭제</p>
            <p style={{ fontSize: 12, color: '#6B6B6B', lineHeight: 1.6, marginBottom: 20 }}>
              이 기록을 삭제하면 복구할 수 없습니다.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                style={{ flex: 1, border: '1px solid #0A0A0A', background: '#FFFFFF', color: '#0A0A0A', fontSize: 11, letterSpacing: '0.1em', padding: 12, cursor: 'pointer' }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                style={{ flex: 1, background: '#0A0A0A', color: '#FFFFFF', fontSize: 11, letterSpacing: '0.1em', padding: 12, border: 'none', cursor: 'pointer', opacity: deleting ? 0.5 : 1 }}
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
