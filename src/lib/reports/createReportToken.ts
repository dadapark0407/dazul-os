// @deprecated — guardian.share_token 기반으로 전환됨. 이 파일은 하위 호환용으로 유지.
import { createClient } from '@/utils/supabase/server'

// report_tokens 실제 DB 컬럼:
// id, token, session_id (nullable), visit_record_id (integer), expires_at, is_active, created_at

export async function getReportToken(token: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('report_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load report token: ${error.message}`)
  }

  return data
}

export async function getOrCreateReportToken(visitRecordId: string | number) {
  const supabase = await createClient()

  const { data: existingToken, error: lookupError } = await supabase
    .from('report_tokens')
    .select('*')
    .eq('visit_record_id', visitRecordId)
    .maybeSingle()

  if (lookupError) {
    throw new Error(`Unable to look up report token: ${lookupError.message}`)
  }

  if (existingToken) {
    return existingToken
  }

  const token = crypto.randomUUID()

  const { data, error: insertError } = await supabase
    .from('report_tokens')
    .insert({
      token,
      visit_record_id: Number(visitRecordId),
      is_active: true,
    })
    .select()
    .single()

  if (insertError) {
    throw new Error(`Unable to create report token: ${insertError.message}`)
  }

  return data
}
