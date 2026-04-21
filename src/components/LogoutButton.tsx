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
      style={{
        background: 'transparent',
        border: 'none',
        color: '#8A8A7A',
        fontSize: 11,
        letterSpacing: '0.1em',
        padding: '4px 8px',
        cursor: 'pointer',
      }}
    >
      로그아웃
    </button>
  )
}
