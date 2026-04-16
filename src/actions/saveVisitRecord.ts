'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// =============================================================
// DAZUL OS — 방문 기록 Server Action
//
// 실제 DB 스키마: visit_records (건강 정보 포함), session_photos,
// report_tokens, guardians.share_token
//
// sessions/health_check 별도 테이블 없음 — visit_records에 통합
// =============================================================

// ─── 타입 정의 ───

export type MainService = 'bath' | 'full_grooming'
export type SpaLevel = 'basic' | 'essential' | 'signature' | 'prestige' | null

export type HealthCheck = {
  skin: string[]        // ['좋음'] or ['건조', '민감', ...]
  skinMemo: string
  tangles: string[]     // ['없음'] or ['귀티', '머리', ...]
  eyes: string[]        // ['깨끗함'] or ['붉음', '눈물많음']
  ears: string[]        // ['깨끗함'] or ['노란귀지', '갈색귀지']
  teeth: 'clean' | 'needs_care' | null
  teethMemo: string
  nail: 'good' | 'needs_care' | null
}

export type CareTip = {
  emoji: string
  title: string
  desc: string
}

export type NoteEntry = {
  category: string
  severity: string
  content: string
  isPinned: boolean
  followUpNeeded: boolean
  followUpDate: string
}

export type SaveVisitPayload = {
  petId: string
  guardianId: string | null
  petName: string
  guardianName: string
  staffName: string
  mainService: string
  spaLevel: SpaLevel
  addServices: string[]
  products: string
  styleNotes: string
  healthCheck: HealthCheck
  healthSummary: string
  careTips: CareTip[]
  nextVisitDate: string | null
  nextVisitRecommendation: string | null
  sessionDate: string
  sessionType: string
  weight: string
  comment: string
  notes: NoteEntry[]
  // photos는 Server Action에서 File 직접 받을 수 없으므로
  // 클라이언트에서 별도 업로드 후 URL 배열로 전달
  photoUrls?: string[]
}

export type SaveVisitResult = {
  success: boolean
  visitRecordId?: string | number
  shareUrl?: string
  error?: string
}

export type ReportData = {
  visitRecordId: string | number
  visitDate: string | null
  petName: string | null
  petBreed: string | null
  guardianName: string | null
  guardianPhone: string | null
  mainService: string | null
  spaLevel: string | null
  nextVisitDate: string | null
  nextVisitRecommendation: string | null
  comment: string | null
  healthCheck: {
    skin: string | null
    coat: string | null
    condition: string | null
    stress: string | null
    tangles: string | null
    eyes: string | null
    ears: string | null
    teeth: string | null
    nail: string | null
  }
  healthSummary: string | null
  careSummary: string | null
  careActions: string | null
  careNotes: string | null
  nextCareGuide: string | null
  careTips: CareTip[]
  specialNotes: string | null
  note: string | null
  notes: NoteEntry[]
  photos: { id: string; publicUrl: string; sortOrder: number }[]
  shareToken: string | null
}

// ─── 헬퍼: Supabase 서버 클라이언트 ───

async function getSupabase() {
  return await createClient()
}

// ─── 헬퍼: 건강 체크 → DB 컬럼 매핑 ───

function healthCheckToRow(hc: HealthCheck): Record<string, string | null> {
  const skinArr = hc.skin.filter((s) => s !== '좋음')
  const skinStr = hc.skin.includes('좋음') && skinArr.length === 0
    ? '좋음'
    : skinArr.join(', ') + (hc.skinMemo ? ` (${hc.skinMemo})` : '')

  const tanglesStr = hc.tangles.includes('없음')
    ? '없음'
    : hc.tangles.length > 0
      ? hc.tangles.join(', ')
      : null

  const eyesStr = hc.eyes.length > 0 ? hc.eyes.join(', ') : null
  const earsStr = hc.ears.length > 0 ? hc.ears.join(', ') : null

  const teethStr = hc.teeth === 'clean'
    ? '깨끗함'
    : hc.teeth === 'needs_care'
      ? `관리필요${hc.teethMemo ? ` (${hc.teethMemo})` : ''}`
      : null

  const nailStr = hc.nail === 'good'
    ? '적당함'
    : hc.nail === 'needs_care'
      ? '관리필요'
      : null

  return {
    skin_status: skinStr || null,
    coat_status: tanglesStr ? `엉킴: ${tanglesStr}` : null,
    tangles_status: tanglesStr,
    eyes_status: eyesStr,
    ears_status: earsStr,
    teeth_status: hc.teeth,
    nail_status: hc.nail,
    // condition_status, stress_status는 이 폼에서 직접 매핑하지 않음
  }
}

// ─── 사진 업로드 ───

async function uploadPhoto(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  visitRecordId: string | number,
  publicUrl: string,
  index: number
): Promise<{ id?: string; error?: string }> {
  const { data, error } = await supabase
    .from('session_photos')
    .insert({
      visit_record_id: visitRecordId,
      storage_path: publicUrl, // 클라이언트에서 이미 업로드된 URL
      public_url: publicUrl,
      sort_order: index,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { id: data?.id }
}

// ─── 토큰 생성 ───

function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)]
  }
  return token
}

// ─── 메인: 방문 기록 저장 ───

export async function saveVisitRecord(
  payload: SaveVisitPayload
): Promise<SaveVisitResult> {
  try {
    const supabase = await getSupabase()

    // 서비스 문자열 조합
    const serviceParts = [payload.mainService]
    if (payload.spaLevel) {
      const spaLabels: Record<string, string> = {
        basic: '베이직', essential: '에센셜', signature: '시그니처', prestige: '프레스티지',
      }
      serviceParts.push(`스파 ${spaLabels[payload.spaLevel] ?? payload.spaLevel}`)
    }
    if (payload.addServices.length > 0) serviceParts.push(...payload.addServices)

    // 건강 체크 → DB 컬럼
    const healthCols = healthCheckToRow(payload.healthCheck)

    // 메모 합치기
    const pinnedNotes = payload.notes
      .filter((n) => n.isPinned && n.content.trim())
      .map((n) => `[📌 ${n.category}] ${n.content}`)
    const regularNotes = payload.notes
      .filter((n) => !n.isPinned && n.content.trim())
      .map((n) => `[${n.category}] ${n.content}`)
    const allNotes = [...pinnedNotes, ...regularNotes]

    // visit_records INSERT
    const visitPayload: Record<string, unknown> = {
      pet_id: payload.petId,
      guardian_id: payload.guardianId || null,
      pet_name: payload.petName || null,
      guardian_name: payload.guardianName || null,
      staff_name: payload.staffName || null,
      visit_date: payload.sessionDate,
      service_type: serviceParts.join(', '),
      service: payload.mainService,
      main_service: payload.mainService === '목욕관리' ? 'bath' : payload.mainService === '전체미용' ? 'full_grooming' : null,
      spa_level: payload.spaLevel,
      weight: payload.weight ? parseFloat(payload.weight) : null,
      session_type: payload.sessionType || null,
      add_services: payload.addServices.length > 0 ? payload.addServices : null,

      // 건강 상태
      ...healthCols,
      health_summary: payload.healthSummary || null,
      care_tips: payload.careTips.length > 0 ? payload.careTips : null,

      // 케어 기록
      care_summary: payload.styleNotes || null,
      care_actions: payload.products || null,
      special_notes: allNotes.length > 0 ? allNotes.join('\n') : null,
      next_visit_recommendation: payload.nextVisitRecommendation || null,
      next_visit_date: payload.nextVisitDate || null,
      note: payload.comment || null,
      comment: payload.comment || null,
    }

    const { data: insertedRows, error: insertError } = await supabase
      .from('visit_records')
      .insert(visitPayload)
      .select('id')

    if (insertError) {
      return { success: false, error: `방문 기록 저장 실패: ${insertError.message}` }
    }

    const visitRecordId = insertedRows?.[0]?.id
    if (!visitRecordId) {
      return { success: false, error: '방문 기록 ID를 받지 못했습니다.' }
    }

    // 사진 등록 (이미 업로드된 URL)
    if (payload.photoUrls && payload.photoUrls.length > 0) {
      const photoResults = await Promise.allSettled(
        payload.photoUrls.map((url, idx) => uploadPhoto(supabase, visitRecordId, url, idx))
      )
      for (const result of photoResults) {
        if (result.status === 'rejected' || (result.status === 'fulfilled' && result.value.error)) {
          console.warn('사진 등록 실패 (무시됨):', result.status === 'rejected' ? result.reason : result.value.error)
        }
      }
    }

    // 팔로업 메모 (추적 관찰 필요한 노트)
    for (const n of payload.notes.filter((n) => n.followUpNeeded && n.content.trim())) {
      try {
        await supabase.from('followups').insert({
          pet_id: payload.petId,
          guardian_id: payload.guardianId || null,
          related_record_id: visitRecordId,
          type: n.category === '케어' ? '피부 체크' : '컨디션 체크',
          status: 'pending',
          due_date: n.followUpDate || null,
          note: n.content,
        })
      } catch {
        // followups 테이블이 없을 수 있음
      }
    }

    // 공유 URL (보호자 share_token 기반)
    let shareUrl = ''
    if (payload.guardianId) {
      try {
        const { data: gData } = await supabase
          .from('guardians')
          .select('share_token')
          .eq('id', payload.guardianId)
          .maybeSingle()

        if (gData?.share_token) {
          const origin = process.env.NEXT_PUBLIC_APP_URL
            || process.env.NEXT_PUBLIC_SITE_URL
            || ''
          shareUrl = `${origin}/report/${gData.share_token}`
          revalidatePath(`/report/${gData.share_token}`)
        }
      } catch {
        // 무시
      }
    }

    return {
      success: true,
      visitRecordId,
      shareUrl,
    }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : '저장 중 예상치 못한 오류가 발생했습니다.',
    }
  }
}

// ─── 토큰 해석 ───

export async function resolveToken(
  token: string
): Promise<{ visitRecordId?: string | number; guardianId?: string; error?: string }> {
  const supabase = await getSupabase()

  // 1) report_tokens에서 찾기
  const { data: rt } = await supabase
    .from('report_tokens')
    .select('visit_record_id, expires_at, is_active')
    .eq('token', token)
    .maybeSingle()

  if (rt) {
    if (rt.is_active === false) return { error: '비활성화된 토큰입니다.' }
    if (rt.expires_at && new Date(rt.expires_at) < new Date()) return { error: '만료된 토큰입니다.' }
    if (rt.visit_record_id) return { visitRecordId: rt.visit_record_id }
  }

  // 2) guardians.share_token에서 찾기 (보호자 전체 기록 조회용)
  const { data: guardian } = await supabase
    .from('guardians')
    .select('id')
    .eq('share_token', token)
    .maybeSingle()

  if (guardian) return { guardianId: guardian.id }

  return { error: '유효하지 않은 토큰입니다.' }
}

// ─── 리포트 데이터 조회 ───

export async function getReportData(
  token: string
): Promise<{ data?: ReportData; records?: ReportData[]; error?: string }> {
  const resolved = await resolveToken(token)

  if (resolved.error) return { error: resolved.error }

  const supabase = await getSupabase()

  // 보호자 share_token → 전체 기록
  if (resolved.guardianId) {
    const { data: pets } = await supabase
      .from('pets')
      .select('id, name, breed')
      .eq('guardian_id', resolved.guardianId)

    const petIds = (pets ?? []).map((p) => p.id)

    if (petIds.length === 0) return { error: '연결된 반려견이 없습니다.' }

    const { data: records } = await supabase
      .from('visit_records')
      .select('*')
      .in('pet_id', petIds)
      .order('visit_date', { ascending: false })

    const { data: guardian } = await supabase
      .from('guardians')
      .select('name, phone, share_token')
      .eq('id', resolved.guardianId)
      .maybeSingle()

    const results: ReportData[] = (records ?? []).map((vr) => {
      const pet = pets?.find((p) => p.id === vr.pet_id) ?? null
      return mapToReportData(vr, pet, guardian)
    })

    return { records: results }
  }

  // 단일 visit_record
  if (resolved.visitRecordId) {
    const { data: vr } = await supabase
      .from('visit_records')
      .select('*')
      .eq('id', resolved.visitRecordId)
      .maybeSingle()

    if (!vr) return { error: '방문 기록을 찾을 수 없습니다.' }

    let pet = null
    if (vr.pet_id) {
      const { data } = await supabase.from('pets').select('id, name, breed').eq('id', vr.pet_id).maybeSingle()
      pet = data
    }

    let guardian = null
    const guardianId = vr.guardian_id
    if (guardianId) {
      const { data } = await supabase.from('guardians').select('name, phone, share_token').eq('id', guardianId).maybeSingle()
      guardian = data
    }

    // 사진
    let photos: { id: string; publicUrl: string; sortOrder: number }[] = []
    try {
      const { data: photoData } = await supabase
        .from('session_photos')
        .select('id, public_url, sort_order')
        .eq('visit_record_id', resolved.visitRecordId)
        .order('sort_order')
      photos = (photoData ?? []).map((p) => ({
        id: p.id,
        publicUrl: p.public_url ?? '',
        sortOrder: p.sort_order ?? 0,
      }))
    } catch {
      // session_photos 테이블이 없을 수 있음
    }

    const reportData = mapToReportData(vr, pet, guardian, photos)
    return { data: reportData }
  }

  return { error: '토큰 해석 실패' }
}

// ─── 내부: DB 행 → ReportData 변환 ───

function mapToReportData(
  vr: Record<string, unknown>,
  pet: { id?: string; name?: string; breed?: string } | null,
  guardian: { name?: string; phone?: string; share_token?: string } | null,
  photos: { id: string; publicUrl: string; sortOrder: number }[] = []
): ReportData {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

  return {
    visitRecordId: vr.id as string | number,
    visitDate: str(vr.visit_date),
    petName: str(vr.pet_name) ?? pet?.name ?? null,
    petBreed: pet?.breed ?? null,
    guardianName: str(vr.guardian_name) ?? guardian?.name ?? null,
    guardianPhone: guardian?.phone ?? null,
    mainService: str(vr.main_service) ?? str(vr.service),
    spaLevel: str(vr.spa_level),
    nextVisitDate: str(vr.next_visit_date),
    nextVisitRecommendation: str(vr.next_visit_recommendation),
    comment: str(vr.comment) ?? str(vr.note),
    healthCheck: {
      skin: str(vr.skin_status),
      coat: str(vr.coat_status),
      condition: str(vr.condition_status),
      stress: str(vr.stress_status),
      tangles: str(vr.tangles_status) ?? str(vr.coat_status),
      eyes: str(vr.eyes_status),
      ears: str(vr.ears_status),
      teeth: str(vr.teeth_status),
      nail: str(vr.nail_status),
    },
    healthSummary: str(vr.health_summary),
    careSummary: str(vr.care_summary),
    careActions: str(vr.care_actions),
    careNotes: str(vr.care_notes),
    nextCareGuide: str(vr.next_care_guide),
    careTips: Array.isArray(vr.care_tips) ? vr.care_tips as CareTip[] : [],
    specialNotes: str(vr.special_notes),
    note: str(vr.note),
    notes: [], // 메모는 special_notes에 합쳐져 있음
    photos,
    shareToken: guardian?.share_token ?? null,
  }
}
