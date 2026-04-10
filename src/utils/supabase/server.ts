// =============================================================
// DAZUL OS — Supabase server client shim
// page.tsx에서 `await createClient()` 패턴으로 사용되는 래퍼
// 내부적으로 @/lib/supabase의 싱글턴 클라이언트를 반환
// =============================================================

import { supabase } from '@/lib/supabase'

/**
 * createClient()
 * Next.js 서버 컴포넌트에서 `const supabase = await createClient()` 형태로 사용.
 * @supabase/ssr 미사용 프로젝트에서 동일한 API 인터페이스를 제공하는 shim.
 */
export async function createClient() {
  return supabase
}
