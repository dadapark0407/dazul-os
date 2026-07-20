import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DAZUL 정산',
}

export default function SettlementLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', background: '#FAFAF8' }}>
      {children}
    </div>
  )
}
