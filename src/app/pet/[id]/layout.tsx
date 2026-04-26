import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

// 인증 보호 — /pet/[id] 와 /pet/[id]/consulting 모두 커버
// 미인증 사용자는 로그인 페이지로 이동
export default async function PetLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')
  return <>{children}</>
}
