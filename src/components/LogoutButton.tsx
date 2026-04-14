'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="text-[11px] font-light tracking-[0.1em] text-white/40 transition-all duration-400 hover:text-dz-accent lg:text-white/40"
    >
      로그아웃
    </button>
  )
}
