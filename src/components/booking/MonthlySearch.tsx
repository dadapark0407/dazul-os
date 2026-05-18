'use client'

import { useEffect, useRef, useState } from 'react'
import {
  searchAppointmentsByPetName,
  type AppointmentSearchHit,
} from '@/lib/booking/actions'

const KO_WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const

function formatDateHeader(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${m}/${d}(${KO_WEEKDAYS[dow]})`
}

/** 한국 성씨 1자 가정 — "강수진" → "수진" */
function givenName(fullName: string | null): string | null {
  if (!fullName) return null
  return fullName.length >= 2 ? fullName.slice(1) : fullName
}

type Props = {
  onPick: (date: string) => void
}

export default function MonthlySearch({ onPick }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AppointmentSearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const reqIdRef = useRef(0)

  // debounce 300ms
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const myReq = ++reqIdRef.current
    const t = setTimeout(async () => {
      try {
        const data = await searchAppointmentsByPetName(q)
        if (reqIdRef.current === myReq) {
          setResults(data)
          setLoading(false)
        }
      } catch {
        if (reqIdRef.current === myReq) {
          setResults([])
          setLoading(false)
        }
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  // 바깥 클릭 시 닫기
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function pick(hit: AppointmentSearchHit) {
    setOpen(false)
    setQuery('')
    setResults([])
    onPick(hit.date)
  }

  const showDropdown = open && query.trim().length > 0

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', maxWidth: 360 }}
    >
      <div style={{ position: 'relative' }}>
        {/* 검색 아이콘 */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 14,
            color: '#C9A96E',
            pointerEvents: 'none',
            lineHeight: 1,
          }}
        >
          ⌕
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="강아지 이름으로 검색"
          style={{
            width: '100%',
            height: 38,
            paddingLeft: 32,
            paddingRight: 12,
            background: '#FAFAF8',
            border: '1px solid #E8E5E0',
            borderRadius: 0,
            fontSize: 13,
            color: '#1A1A1A',
            outline: 'none',
            letterSpacing: '0.02em',
          }}
        />
      </div>

      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 30,
            background: '#FFFFFF',
            border: '1px solid #E8E5E0',
            borderRadius: 0,
            maxHeight: 320,
            overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
          }}
        >
          {loading && (
            <div
              style={{
                padding: '12px 14px',
                fontSize: 12,
                color: '#8A8A7A',
                letterSpacing: '0.04em',
              }}
            >
              검색 중...
            </div>
          )}
          {!loading && results.length === 0 && (
            <div
              style={{
                padding: '12px 14px',
                fontSize: 12,
                color: '#8A8A7A',
                letterSpacing: '0.04em',
              }}
            >
              결과 없음
            </div>
          )}
          {!loading &&
            results.map((hit) => {
              const staffShort = givenName(hit.staff_name)
              const parts: string[] = [formatDateHeader(hit.date), hit.time]
              if (hit.pet_name) parts.push(hit.pet_name)
              if (hit.service) parts.push(hit.service)
              const main = parts.join(' ')
              const tail = staffShort ? ` - ${staffShort}` : ''
              return (
                <button
                  key={hit.id}
                  type="button"
                  onClick={() => pick(hit)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#FAFAF8'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#FFFFFF'
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    background: '#FFFFFF',
                    border: 'none',
                    borderBottom: '1px solid #F2F0EC',
                    fontSize: 12.5,
                    color: '#1A1A1A',
                    cursor: 'pointer',
                    letterSpacing: '0.02em',
                  }}
                >
                  {main}
                  <span style={{ color: '#8A8A7A' }}>{tail}</span>
                </button>
              )
            })}
        </div>
      )}
    </div>
  )
}
