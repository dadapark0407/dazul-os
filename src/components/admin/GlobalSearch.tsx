'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Result = {
  id: string
  label: string
  sub: string
  type: 'pet' | 'guardian'
  href: string
}

export default function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // 클릭 바깥 감지
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 검색 디바운스
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const keyword = query.trim()
    if (keyword.length < 1) {
      setResults([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)

      const [petsResult, guardiansResult] = await Promise.all([
        supabase
          .from('pets')
          .select('id, name, breed, guardian_id')
          .or(`name.ilike.%${keyword}%,breed.ilike.%${keyword}%`)
          .limit(5),
        supabase
          .from('guardians')
          .select('id, name, phone')
          .or(`name.ilike.%${keyword}%,phone.ilike.%${keyword}%`)
          .limit(5),
      ])

      const items: Result[] = []

      for (const p of petsResult.data ?? []) {
        items.push({
          id: p.id,
          label: p.name ?? '이름 없음',
          sub: p.breed ?? '품종 미입력',
          type: 'pet',
          href: `/admin/pets/${p.id}`,
        })
      }

      for (const g of guardiansResult.data ?? []) {
        items.push({
          id: g.id,
          label: g.name ?? '이름 없음',
          sub: g.phone ?? '연락처 없음',
          type: 'guardian',
          href: `/admin/guardians/${g.id}`,
        })
      }

      setResults(items)
      setOpen(items.length > 0)
      setLoading(false)
    }, 250)
  }, [query])

  function handleSelect(item: Result) {
    setQuery('')
    setOpen(false)
    router.push(item.href)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="검색..."
        className="w-full border-b border-white/10 bg-transparent px-1 py-2 text-[12px] text-white/70 outline-none placeholder:text-white/20 focus:border-dz-accent/40"
      />

      {/* 드롭다운 */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[200px] border border-dz-border/30 bg-white shadow-lg">
          {loading && (
            <p className="px-3 py-2 text-[11px] text-dz-muted">검색 중...</p>
          )}
          {!loading && results.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-dz-muted">결과 없음</p>
          )}
          {results.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              type="button"
              onClick={() => handleSelect(item)}
              className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-all duration-300 hover:bg-dz-surface"
            >
              <span className={`mt-0.5 flex-shrink-0 text-[9px] font-medium uppercase tracking-wider ${
                item.type === 'pet' ? 'text-dz-accent' : 'text-dz-muted'
              }`}>
                {item.type === 'pet' ? 'PET' : '보호자'}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-dz-primary">{item.label}</p>
                <p className="truncate text-[10px] text-dz-muted/60">{item.sub}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
