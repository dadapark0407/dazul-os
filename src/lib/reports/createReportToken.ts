import { createClient } from '@/utils/supabase/server'

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

export async function getOrCreateReportToken(visitRecordId: string) {
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
      visit_record_id: visitRecordId,
    })
    .select()
    .single()

  if (insertError) {
    throw new Error(`Unable to create report token: ${insertError.message}`)
  }

  return data
}
