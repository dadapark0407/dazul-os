'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { buildSiteUrl } from '@/lib/siteUrl'
import CopyTextButton from '@/components/CopyTextButton'

const CONDITION_OPTIONS = ['안정', '예민', '피곤', '활발']
const STRESS_OPTIONS = ['낮음', '보통', '높음', '초반 긴장 후 안정']

export default function EditVisitPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [guardianId, setGuardianId] = useState('')
  const [petId, setPetId] = useState('')
  const [visitDate, setVisitDate] = useState('')
  const [serviceType, setServiceType] = useState('')
  const [note, setNote] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [shareLoading, setShareLoading] = useState(false)

  const [skinStatus, setSkinStatus] = useState('')
  const [coatStatus, setCoatStatus] = useState('')
  const [conditionStatus, setConditionStatus] = useState('')
  const [stressStatus, setStressStatus] = useState('')
  const [specialNotes, setSpecialNotes] = useState('')
  const [nextVisitRecommendation, setNextVisitRecommendation] = useState('')

  useEffect(() => {
    async function fetchVisit() {
      const { data, error } = await supabase
        .from('visit_records')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        alert('기록을 불러오지 못했습니다.')
        router.push('/record')
        return
      }

      setGuardianId(data.guardian_id || '')
      setPetId(data.pet_id || '')
      setVisitDate(data.visit_date || '')
      setServiceType(data.service_type || '')
      setNote(data.note || '')
      setSkinStatus(data.skin_status || '')
      setCoatStatus(data.coat_status || '')
      setConditionStatus(data.condition_status || '')
      setStressStatus(data.stress_status || '')
      setSpecialNotes(data.special_notes || '')
      setNextVisitRecommendation(data.next_visit_recommendation || '')
      setLoading(false)
    }

    fetchVisit()
  }, [id, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      setSaving(true)

      const { error } = await supabase
        .from('visit_records')
        .update({
          guardian_id: guardianId,
          pet_id: petId,
          visit_date: visitDate,
          service_type: serviceType || null,
          note: note || null,
          skin_status: skinStatus || null,
          coat_status: coatStatus || null,
          condition_status: conditionStatus || null,
          stress_status: stressStatus || null,
          special_notes: specialNotes || null,
          next_visit_recommendation: nextVisitRecommendation || null,
        })
        .eq('id', id)

      if (error) {
        alert(`수정 중 오류가 발생했어요: ${error.message}`)
        return
      }

      alert('수정되었습니다.')
      router.push(`/pet/${petId}`)
    } catch (error) {
      console.error(error)
      alert('수정 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const adminNav = (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/admin" className="text-lg font-bold tracking-tight text-neutral-900">
          DAZUL 관리
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
        >
          홈으로
        </Link>
      </div>
      <nav className="scrollbar-hide overflow-x-auto border-t border-neutral-100">
        <div className="mx-auto flex max-w-7xl gap-1 px-4 py-2">
          {[
            { href: '/admin', label: '대시보드' },
            { href: '/admin/pets', label: '반려견' },
            { href: '/admin/guardians', label: '보호자' },
            { href: '/admin/records', label: '방문 기록' },
            { href: '/admin/products', label: '제품' },
            { href: '/admin/followups', label: '후속 관리' },
            { href: '/admin/settings', label: '설정' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        {adminNav}
        <main style={{ padding: 20 }}>불러오는 중...</main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {adminNav}
      <main style={{ maxWidth: 900, margin: '40px auto', padding: 20 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>방문 기록 수정</h1>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <button
          type="button"
          onClick={async () => {
            try {
              setShareLoading(true)
              const response = await fetch('/api/report-token', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ visitRecordId: id }),
              })

              const payload = await response.json()

              if (!response.ok || payload.error) {
                throw new Error(payload.error || '알 수 없는 오류')
              }

              const url = buildSiteUrl(`/report/${payload.token}`)
              setShareUrl(url)
            } catch (error) {
              console.error(error)
              alert('공유 링크를 생성하지 못했습니다.')
            } finally {
              setShareLoading(false)
            }
          }}
          disabled={shareLoading}
          style={{
            ...buttonStyle,
            background: '#374151',
            minWidth: 150,
          }}
        >
          {shareLoading ? '링크 생성 중...' : '공유 링크 생성'}
        </button>

        {shareUrl ? <CopyTextButton text={shareUrl} label="링크 복사" /> : null}
      </div>

      {shareUrl ? (
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: 0, color: '#111827', fontSize: 14, fontWeight: 600 }}>
            공유 링크가 생성되었습니다.
          </p>
          <div
            style={{
              marginTop: 8,
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid #d1d5db',
              background: '#f8fafc',
              wordBreak: 'break-all',
              fontSize: 14,
              color: '#1f2937',
            }}
          >
            {shareUrl}
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>기본 정보</h2>

          <label style={labelStyle}>
            방문일
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            서비스
            <input
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              style={inputStyle}
            />
          </label>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>웰니스 기록</h2>

          <label style={labelStyle}>
            피부 상태
            <input
              value={skinStatus}
              onChange={(e) => setSkinStatus(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            모질 상태
            <input
              value={coatStatus}
              onChange={(e) => setCoatStatus(e.target.value)}
              style={inputStyle}
            />
          </label>

          <div style={labelStyle}>
            <span>컨디션</span>
            <div style={chipWrapStyle}>
              {CONDITION_OPTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setConditionStatus(item)}
                  style={getChipStyle(conditionStatus === item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div style={labelStyle}>
            <span>스트레스</span>
            <div style={chipWrapStyle}>
              {STRESS_OPTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setStressStatus(item)}
                  style={getChipStyle(stressStatus === item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <label style={labelStyle}>
            특이사항
            <textarea value={specialNotes} onChange={(e) => setSpecialNotes(e.target.value)} style={textareaStyle} />
          </label>

          <label style={labelStyle}>
            다음 방문 추천
            <textarea
              value={nextVisitRecommendation}
              onChange={(e) => setNextVisitRecommendation(e.target.value)}
              style={textareaStyle}
            />
          </label>

          <label style={labelStyle}>
            자유 메모
            <textarea value={note} onChange={(e) => setNote(e.target.value)} style={textareaStyle} />
          </label>
        </section>

        <button type="submit" disabled={saving} style={buttonStyle}>
          {saving ? '저장 중...' : '수정 저장'}
        </button>
      </form>
      </main>
    </div>
  )
}

function getChipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '10px 14px',
    borderRadius: 999,
    border: active ? '1px solid #111827' : '1px solid #d1d5db',
    background: active ? '#111827' : '#ffffff',
    color: active ? '#ffffff' : '#111827',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  }
}

const sectionStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 20,
  display: 'grid',
  gap: 14,
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  marginBottom: 8,
}

const labelStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  fontWeight: 600,
}

const chipWrapStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
}

const inputStyle: React.CSSProperties = {
  height: 44,
  border: '1px solid #d1d5db',
  borderRadius: 10,
  padding: '0 12px',
  fontSize: 14,
}

const textareaStyle: React.CSSProperties = {
  minHeight: 100,
  border: '1px solid #d1d5db',
  borderRadius: 10,
  padding: 12,
  fontSize: 14,
}

const buttonStyle: React.CSSProperties = {
  height: 48,
  border: 'none',
  borderRadius: 10,
  background: '#111827',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
}