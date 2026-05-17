import { redirect } from 'next/navigation'
import { isOwnerUnlocked } from '@/lib/owner-pin'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const unlocked = await isOwnerUnlocked()
  if (!unlocked) {
    redirect('/admin/settings?dashboard_locked=1')
  }
  return <>{children}</>
}
