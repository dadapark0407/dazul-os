'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import DashboardPinModal, { isOwnerSessionUnlocked } from './DashboardPinModal'

type Props = {
  href: string
  className?: string
  style?: React.CSSProperties
  children: ReactNode
}

/**
 * 대시보드 진입 링크 — 클릭 시 PIN 확인 모달.
 * 세션 동안 인증되어 있으면 바로 이동.
 */
export default function DashboardLink({ href, className, style, children }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (isOwnerSessionUnlocked()) {
      router.push(href)
      return
    }
    setModalOpen(true)
  }

  return (
    <>
      <a href={href} onClick={handleClick} className={className} style={style}>
        {children}
      </a>
      <DashboardPinModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        redirectTo={href}
      />
    </>
  )
}
