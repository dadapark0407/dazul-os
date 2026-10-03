'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { formatPhone } from '@/lib/phone'

// =============================================================
// DAZUL OS — 반려견 보호자 이전
//
// 변경 범위 (순서대로):
//   1. pets.guardian_id → 새 보호자
//   2. appointments: 해당 반려견의 오늘(KST) 이후 예정 예약만 (취소/노쇼/완료/삭제 제외)
//   3. recurring_schedules: 해당 반려견의 활성 스케줄
// visit_records, notification_logs, 과거 예약은 건드리지 않는다.
// =============================================================

const CLOSED_STATUSES = ['cancelled', 'noshow', 'completed']

export type GuardianOption = { id: string; name: string; phone: string | null; petNames: string[] }

export type TransferPreview = { appointments: number; schedules: number }

export type TransferResult = { ok: true } | { ok: false; error: string }

/** 오늘(KST) 00:00 의 UTC ISO 문자열 */
function kstTodayStartIso(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const startUtc = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 60 * 60 * 1000
  return new Date(startUtc).toISOString()
}

export async function searchTransferGuardians(query: string, excludeId: string): Promise<GuardianOption[]> {
  const q = query.trim()
  if (!q) return []
  const supabase = await createClient()

  // PostgREST or() 문법을 깨뜨리는 문자 제거
  const safe = q.replace(/[,()%*\\]/g, '')
  const conds: string[] = []
  if (safe) conds.push(`name.ilike.%${safe}%`)
  const digits = q.replace(/\D/g, '')
  if (digits.length >= 3) {
    conds.push(`phone.ilike.%${digits}%`)
    const hyphened = formatPhone(digits)
    if (hyphened !== digits) conds.push(`phone.ilike.%${hyphened}%`)
  }
  if (conds.length === 0) return []

  const { data } = await supabase
    .from('guardians')
    .select('id, name, phone')
    .or(conds.join(','))
    .is('deleted_at', null)
    .neq('id', excludeId)
    .order('name')
    .limit(10)

  const rows = data ?? []
  if (rows.length === 0) return []

  const { data: pets } = await supabase
    .from('pets')
    .select('guardian_id, name')
    .in('guardian_id', rows.map((g) => g.id))
    .is('deleted_at', null)

  return rows.map((g) => ({
    id: g.id,
    name: g.name ?? '이름 없음',
    phone: g.phone ?? null,
    petNames: (pets ?? []).filter((p) => p.guardian_id === g.id).map((p) => p.name),
  }))
}

export async function getTransferPreview(petId: string): Promise<TransferPreview> {
  const supabase = await createClient()
  const [appts, schedules] = await Promise.all([
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('pet_id', petId)
      .gte('start_at', kstTodayStartIso())
      .not('status', 'in', `(${CLOSED_STATUSES.join(',')})`)
      .is('deleted_at', null),
    supabase
      .from('recurring_schedules')
      .select('id', { count: 'exact', head: true })
      .eq('pet_id', petId)
      .eq('is_active', true),
  ])
  return { appointments: appts.count ?? 0, schedules: schedules.count ?? 0 }
}

export async function transferPet(petId: string, fromGuardianId: string, toGuardianId: string): Promise<TransferResult> {
  if (!petId || !toGuardianId || fromGuardianId === toGuardianId) {
    return { ok: false, error: '이전 대상이 올바르지 않습니다.' }
  }
  const supabase = await createClient()

  const { data: target } = await supabase
    .from('guardians')
    .select('id')
    .eq('id', toGuardianId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!target) return { ok: false, error: '대상 보호자를 찾을 수 없습니다. 변경된 내용은 없습니다.' }

  // 1. 반려견
  const { data: petRows, error: petErr } = await supabase
    .from('pets')
    .update({ guardian_id: toGuardianId })
    .eq('id', petId)
    .eq('guardian_id', fromGuardianId)
    .select('id')
  if (petErr || !petRows || petRows.length === 0) {
    return { ok: false, error: `반려견 이전 실패${petErr ? `: ${petErr.message}` : ''}. 변경된 내용은 없습니다.` }
  }

  // 2. 예정 예약
  const { data: apptRows, error: apptErr } = await supabase
    .from('appointments')
    .update({ guardian_id: toGuardianId })
    .eq('pet_id', petId)
    .gte('start_at', kstTodayStartIso())
    .not('status', 'in', `(${CLOSED_STATUSES.join(',')})`)
    .is('deleted_at', null)
    .select('id')
  if (apptErr) {
    revalidatePaths(fromGuardianId, toGuardianId)
    return {
      ok: false,
      error: `반려견은 이전되었으나 예정 예약 이전에 실패했습니다: ${apptErr.message}\n예약과 정기 스케줄은 기존 보호자에게 남아 있습니다.`,
    }
  }

  // 3. 정기 스케줄
  const { error: schedErr } = await supabase
    .from('recurring_schedules')
    .update({ guardian_id: toGuardianId })
    .eq('pet_id', petId)
    .eq('is_active', true)
  if (schedErr) {
    revalidatePaths(fromGuardianId, toGuardianId)
    return {
      ok: false,
      error: `반려견과 예정 예약 ${apptRows?.length ?? 0}건은 이전되었으나 정기 스케줄 이전에 실패했습니다: ${schedErr.message}\n정기 스케줄은 기존 보호자에게 남아 있습니다.`,
    }
  }

  revalidatePaths(fromGuardianId, toGuardianId)
  return { ok: true }
}

function revalidatePaths(fromId: string, toId: string) {
  revalidatePath(`/admin/guardians/${fromId}`)
  revalidatePath(`/admin/guardians/${toId}`)
}
