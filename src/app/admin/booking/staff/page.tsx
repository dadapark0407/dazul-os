// =============================================================
// DAZUL OS — 직원(미용사) 관리 페이지 (서버 컴포넌트)
// =============================================================

import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import StaffManager from '@/components/booking/StaffManager'
import type { Staff } from '@/lib/booking/actions'

export default async function StaffSettingsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('staff')
    .select('id, name, signature_color, display_order, is_active, branch_id')
    .order('display_order', { ascending: true })

  const staff = (data ?? []) as Staff[]

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <h1
          style={{
            fontSize: 22,
            letterSpacing: '0.08em',
            fontWeight: 600,
            color: '#1A1A1A',
          }}
        >
          직원 관리
        </h1>
        <Link
          href="/admin/booking"
          style={{
            fontSize: 13,
            letterSpacing: '0.05em',
            color: '#666',
            textDecoration: 'none',
          }}
        >
          ← 예약 화면으로
        </Link>
      </div>

      <StaffManager initialStaff={staff} />
    </div>
  )
}
