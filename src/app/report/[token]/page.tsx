import { createClient } from '@/utils/supabase/server'

type PageProps = {
  params: {
    token: string
  }
}

function formatDate(value?: string | null) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function renderField(label: string, value: string | null | undefined) {
  return (
    <div className="space-y-1 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{label}</p>
      <p className="text-sm text-gray-800">{value || '-'}</p>
    </div>
  )
}

async function fetchReportData(token: string) {
  const supabase = await createClient()

  const { data: reportToken, error: tokenError } = await supabase
    .from('report_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (tokenError || !reportToken) {
    return { reportToken: null, visitRecord: null }
  }

  const { data: visitRecord, error: visitError } = await supabase
    .from('visit_records')
    .select('*')
    .eq('id', reportToken.visit_record_id)
    .maybeSingle()

  if (visitError || !visitRecord) {
    return { reportToken: null, visitRecord: null }
  }

  return { reportToken, visitRecord }
}

export default async function ReportPage({ params }: PageProps) {
  const token = params.token?.trim()
  const { reportToken, visitRecord } = token
    ? await fetchReportData(token)
    : { reportToken: null, visitRecord: null }

  if (!reportToken || !visitRecord) {
    return (
      <main className="min-h-screen bg-neutral-50 px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-100 bg-white p-10 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-red-500">공유 링크 오류</p>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">유효하지 않은 공유 보고서입니다.</h1>
          <p className="mt-3 text-sm leading-7 text-gray-600">
            링크가 잘못되었거나 만료되었을 수 있어요. 기록 작성자에게 다시 공유를 요청해주세요.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">방문 기록 공유 보고서</p>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">방문 기록</h1>
          <p className="mt-3 text-sm leading-7 text-gray-600">
            아래 기록은 공유용 공개 링크를 통해 열람된 내용입니다.
          </p>
        </div>

        <section className="grid gap-4 lg:grid-cols-2">
          {renderField('방문일', formatDate(visitRecord.visit_date))}
          {renderField('서비스', visitRecord.service_type)}
          {renderField('오늘 케어 요약', visitRecord.care_summary)}
          {renderField('진행한 케어 내용', visitRecord.care_actions)}
          {renderField('문제 → 조치', visitRecord.care_notes)}
          {renderField('다음 케어 가이드', visitRecord.next_care_guide)}
          {renderField('다음 방문 추천', visitRecord.next_visit_recommendation)}
          {renderField('특이사항', visitRecord.special_notes)}
          {renderField('피부 상태', visitRecord.skin_status)}
          {renderField('모질 상태', visitRecord.coat_status)}
          {renderField('컨디션', visitRecord.condition_status)}
          {renderField('스트레스', visitRecord.stress_status)}
        </section>

        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">기록 메모</p>
          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-6 text-sm leading-7 text-gray-700">
            {visitRecord.note || '메모가 없습니다.'}
          </div>
        </div>
      </div>
    </main>
  )
}
