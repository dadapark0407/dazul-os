// =============================================================
// DAZUL OS — 직원(미용사) 관리 페이지 (서버 컴포넌트)
// =============================================================

import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import StaffManager from '@/components/booking/StaffManager'
import StaffOffManager from '@/components/booking/StaffOffManager'
import { getUpcomingStaffOffs, type Staff } from '@/lib/booking/actions'

export default async function StaffSettingsPage() {
  const supabase = await createClient()
  // 직원 + 미래 휴무 병렬 조회
  const [{ data: staffData }, offs] = await Promise.all([
    supabase
      .from('staff')
      .select('id, name, signature_color, display_order, is_active, branch_id')
      .order('display_order', { ascending: true }),
    getUpcomingStaffOffs(),
  ])

  const staff = (staffData ?? []) as Staff[]
  const activeStaff = staff.filter((s) => s.is_active)

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

      {/* 휴무 관리 */}
      <div className="mt-10">
        <h2
          style={{
            fontSize: 18,
            letterSpacing: '0.08em',
            fontWeight: 600,
            color: '#1A1A1A',
            marginBottom: 16,
          }}
        >
          휴무 관리
        </h2>
        <StaffOffManager staff={activeStaff} initialOffs={offs} />
      </div>
    </div>
  )
}
