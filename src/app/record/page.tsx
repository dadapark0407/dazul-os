'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type VisitRecord = {
  id: number
  created_at: string
  visit_date: string
  pet_name: string
  guardian_name: string | null
  staff_name: string
  service: string
  note: string | null
}

function formatDate(dateString: string) {
  if (!dateString) return '-'

  const date = new Date(dateString)

  if (Number.isNaN(date.getTime())) {
    return dateString
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export default function RecordPage() {
  const [records, setRecords] = useState<VisitRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedStaff, setSelectedStaff] = useState('전체')
  const [selectedService, setSelectedService] = useState('전체')

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('visit_records')
        .select('*')
        .order('visit_date', { ascending: false })
        .order('id', { ascending: false })

      if (error) {
        console.error('기록 불러오기 오류:', error)
        setErrorMessage(`기록을 불러오는 중 오류가 발생했어요: ${error.message}`)
        setLoading(false)
        return
      }

      setRecords(data ?? [])
      setLoading(false)
    }

    fetchRecords()
  }, [])

  const staffOptions = useMemo(() => {
    const names = records
      .map((record) => record.staff_name)
      .filter(Boolean)

    return ['전체', ...Array.from(new Set(names))]
  }, [records])

  const serviceOptions = ['전체', '목욕관리', '미용', '스파', '팩', '스파+팩']

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const keyword = searchKeyword.trim().toLowerCase()

      const matchesKeyword =
        keyword === '' ||
        record.pet_name.toLowerCase().includes(keyword) ||
        (record.guardian_name ?? '').toLowerCase().includes(keyword)

      const matchesStaff =
        selectedStaff === '전체' || record.staff_name === selectedStaff

      const matchesService =
        selectedService === '전체' || record.service === selectedService

      return matchesKeyword && matchesStaff && matchesService
    })
  }, [records, searchKeyword, selectedStaff, selectedService])

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">방문 기록</h1>
            <p className="mt-1 text-sm text-neutral-600">
              아이들의 케어 기록을 차분하게 확인해보세요
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/record/new"
              className="rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white"
            >
              새 기록 작성
            </Link>

            <Link
              href="/"
              className="rounded-2xl border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-700"
            >
              홈으로
            </Link>
          </div>
        </div>

        <section className="mb-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700">
                이름 검색
              </label>
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="반려견 이름 또는 보호자명"
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-neutral-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700">
                담당자
              </label>
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-neutral-500"
              >
                {staffOptions.map((staff) => (
                  <option key={staff} value={staff}>
                    {staff}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700">
                서비스
              </label>
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-neutral-500"
              >
                {serviceOptions.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 text-sm text-neutral-500">
            총 {filteredRecords.length}개의 기록이 보여요
          </div>
        </section>

        {loading && (
          <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
            <p className="text-sm text-neutral-600">기록을 불러오는 중이에요</p>
          </div>
        )}

        {!loading && errorMessage && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && filteredRecords.length === 0 && (
          <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm ring-1 ring-neutral-200">
            <p className="text-base font-medium text-neutral-800">
              조건에 맞는 방문 기록이 없어요
            </p>
          </div>
        )}

        {!loading && !errorMessage && filteredRecords.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {filteredRecords.map((record) => (
              <Link
                key={record.id}
                href={`/record/${record.id}`}
                className="block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 transition hover:ring-neutral-300"
              >
                <article>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold text-neutral-900">
                          {record.pet_name}
                        </h2>
                        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
                          {record.service}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-neutral-600">
                        방문일 {formatDate(record.visit_date)}
                      </p>
                    </div>

                    <div className="text-sm text-neutral-500">
                      담당자 {record.staff_name}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-xl bg-neutral-50 px-4 py-3">
                      <p className="text-xs font-medium text-neutral-500">보호자명</p>
                      <p className="mt-1 text-sm font-medium text-neutral-800">
                        {record.guardian_name || '-'}
                      </p>
                    </div>

                    <div className="rounded-xl bg-neutral-50 px-4 py-3">
                      <p className="text-xs font-medium text-neutral-500">서비스</p>
                      <p className="mt-1 text-sm font-medium text-neutral-800">
                        {record.service || '-'}
                      </p>
                    </div>

                    <div className="rounded-xl bg-neutral-50 px-4 py-3">
                      <p className="text-xs font-medium text-neutral-500">기록 번호</p>
                      <p className="mt-1 text-sm font-medium text-neutral-800">
                        #{record.id}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-4">
                    <p className="text-xs font-medium text-neutral-500">메모</p>
                    <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
                      {record.note || '남겨진 메모가 없어요'}
                    </p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
