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
  const inputRef = useRef<HTMLInputElement>(null)

  // ⌘K / Ctrl+K 단축키 + Escape 닫기
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // 모달 열릴 때 포커스
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  // 디바운스 검색
  useEffect(() => {
    const keyword = query.trim()
    if (keyword.length < 1) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
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
      setLoading(false)
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  function handleSelect(item: Result) {
    setQuery('')
    setOpen(false)
    router.push(item.href)
  }

  function handleClose() {
    setOpen(false)
    setQuery('')
    setResults([])
  }

  return (
    <>
      {/* 트리거 버튼 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/30 transition-all duration-400 hover:border-dz-accent/30 hover:text-white/50"
      >
        <span className="text-[11px]">⌕</span>
        <span className="flex-1 text-left">검색</span>
        <kbd className="bg-white/5 px-1.5 py-0.5 text-[10px] text-white/20">⌘K</kbd>
      </button>

      {/* 풀스크린 모달 */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-[15vh] backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div className="mx-4 w-full max-w-lg overflow-hidden border border-white/10 bg-[#111] shadow-2xl">
            {/* 검색 입력 */}
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <span className="text-sm text-dz-accent">⌕</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="반려견 이름, 보호자 이름으로 검색..."
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/20"
              />
              <button
                type="button"
                onClick={handleClose}
                className="text-[11px] text-white/30 transition-colors hover:text-white/60"
              >
                ESC
              </button>
            </div>

            {/* 결과 */}
            <div className="max-h-72 overflow-y-auto">
              {loading && (
                <p className="py-6 text-center text-[12px] text-white/20">검색 중...</p>
              )}
              {!loading && query && results.length === 0 && (
                <p className="py-8 text-center text-[12px] text-white/20">검색 결과가 없습니다</p>
              )}
              {!loading && results.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-all duration-300 hover:bg-white/5"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-dz-accent/15 text-sm">
                    {item.type === 'pet' ? '🐾' : '👤'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-white">{item.label}</p>
                    <p className="truncate text-[11px] text-white/30">{item.sub}</p>
                  </div>
                  <span className="shrink-0 text-[9px] font-medium uppercase tracking-wider text-dz-accent/60">
                    {item.type === 'pet' ? 'PET' : '보호자'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
