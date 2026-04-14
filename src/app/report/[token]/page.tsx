import { createClient } from '@/utils/supabase/server'
import ReportClient from '@/components/report/ReportClient'

type PageProps = {
  params: Promise<{ token: string }>
}

type Pet = { id: string; name: string | null; breed: string | null }

async function fetchGuardianReport(token: string) {
  const supabase = await createClient()

  const { data: guardian, error: gErr } = await supabase
    .from('guardians')
    .select('id, name, phone, share_token')
    .eq('share_token', token)
    .maybeSingle()

  if (gErr || !guardian) return null

  const { data: petsData } = await supabase
    .from('pets')
    .select('id, name, breed')
    .eq('guardian_id', guardian.id)
    .order('name')

  const pets: Pet[] = (petsData ?? []) as Pet[]
  const petIds = pets.map((p) => p.id).filter(Boolean)

  let records: Record<string, unknown>[] = []
  if (petIds.length > 0) {
    const { data: recordsData } = await supabase
      .from('visit_records')
      .select('*')
      .in('pet_id', petIds)
      .order('visit_date', { ascending: false })
    records = recordsData ?? []
  }

  const { data: salonData } = await supabase
    .from('salon_settings')
    .select('salon_name, phone, instagram, address')
    .limit(1)
    .maybeSingle()

  const salon = {
    name: salonData?.salon_name ?? 'DAZUL',
    phone: salonData?.phone ?? null,
    instagram: salonData?.instagram ?? null,
    address: salonData?.address ?? null,
  }

  const petMap: Record<string, Pet> = {}
  for (const p of pets) petMap[p.id] = p

  return { guardian, pets, records, salon, petMap }
}

export default async function ReportPage({ params }: PageProps) {
  const { token: rawToken } = await params
  const token = rawToken?.trim()
  const data = token ? await fetchGuardianReport(token) : null

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4">
        <div className="max-w-sm text-center">
          <p className="font-heading text-2xl font-light tracking-[0.4em] text-dz-primary">
            DAZUL
          </p>
          <div className="mx-auto my-6 h-px w-12 bg-dz-accent/40" />
          <p className="text-sm text-dz-muted">유효하지 않은 공유 링크입니다.</p>
          <p className="mt-2 text-xs text-dz-border">
            살롱에 다시 공유를 요청해주세요.
          </p>
        </div>
      </main>
    )
  }

  return (
    <ReportClient
      guardianName={data.guardian.name ?? '보호자'}
      pets={data.pets}
      records={data.records}
      salon={data.salon}
      petMap={data.petMap}
    />
  )
}
