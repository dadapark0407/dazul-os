'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { createAutoFollowups } from '@/lib/autoFollowup'
import { buildSiteUrl } from '@/lib/siteUrl'

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────
type SpaLevel = 'basic' | 'premium' | 'deep' | 'prestige' | null
type TeethStatus = 'clean' | 'needs_care' | null
type NailStatus = 'good' | 'needs_care' | null

interface NoteEntry {
  id: string
  category: string
  severity: string
  content: string
  isPinned: boolean
  followUpNeeded: boolean
  followUpDate: string
}

type Guardian = { id: string; name: string; phone: string | null }
type Pet = { id: string; guardian_id: string; name: string; breed: string | null }
type ProductCategory = { id: string; name: string; slug: string }
type Product = { id: string; name: string; brand: string | null; category_id: string | null }

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────
const MAIN_SERVICES = ['목욕관리', '전체미용'] as const

const SPA_OPTIONS: { value: NonNullable<SpaLevel>; label: string; desc: string }[] = [
  { value: 'basic', label: '베이직', desc: '기본 클렌징' },
  { value: 'premium', label: '에센셜', desc: '딥클렌징 & 보습' },
  { value: 'deep', label: '시그니처', desc: '전신 영양 트리트먼트' },
  { value: 'prestige', label: '프레스티지', desc: '프리미엄 맞춤 풀케어' },
]

// (추가서비스 항목 삭제됨)

const SKIN_OPTIONS = ['좋음', '건조', '민감', '습진', '붉은반점', '붉음', '탈모', '딱지', '각질', '기름짐'] as const
const TANGLE_OPTIONS = ['없음', '귀', '머리', '꼬리', '쳐드링이', '목', '앞다리', '뒷다리', '기타'] as const
const EYE_OPTIONS = ['깨끗함', '붉음', '눈물많음'] as const
const EAR_OPTIONS = ['깨끗함', '노란귀지', '갈색귀지'] as const

// (방문 유형 삭제됨)

const NOTE_CATEGORIES = ['케어', '특이사항', '다음 추천', '보호자 전달']
const SEVERITY_OPTIONS = ['일반', '경미', '보통', '심각']

const NEXT_VISIT_OPTIONS = [
  { label: '2주 후', value: '2주', days: 14 },
  { label: '3주 후', value: '3주', days: 21 },
  { label: '4주 후', value: '4주', days: 28 },
  { label: '6주 후', value: '6주', days: 42 },
  { label: '8주 후', value: '8주', days: 56 },
] as const

// ─────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────
function toggleArr<T>(arr: T[], val: T, exclusive?: T): T[] {
  if (exclusive !== undefined && val === exclusive) return [exclusive]
  const without = exclusive !== undefined ? arr.filter((v) => v !== exclusive) : arr
  return without.includes(val) ? without.filter((v) => v !== val) : [...without, val]
}

function addDays(base: string, days: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

/** 신체 상태 데이터로 건강 요약 미리보기 텍스트 생성 */
function generateHealthSummary({
  skin,
  skinMemos,
  tangles,
  tangleMemos = {},
  eyes,
  eyeMemos = {},
  ears,
  earMemos = {},
  teethStatus,
  teethMemo,
  nailStatus,
}: {
  skin: string[]
  skinMemos: Record<string, string>
  tangles: string[]
  tangleMemos: Record<string, string>
  eyes: string[]
  eyeMemos: Record<string, string>
  ears: string[]
  earMemos: Record<string, string>
  teethStatus: TeethStatus
  teethMemo: string
  nailStatus: NailStatus
}): string {
  const parts: string[] = []

  // 항목별 메모를 "항목(부위)" 형식으로 변환
  function formatWithMemos(items: string[], memos: Record<string, string>, excludes: string[] = []): string {
    return items
      .filter((i) => !excludes.includes(i))
      .map((i) => memos[i] ? `${i}(${memos[i]})` : i)
      .join(', ')
  }

  if (skin.length > 0) {
    const good = skin.length === 1 && skin[0] === '좋음'
    if (good) {
      parts.push('피부 상태가 양호합니다.')
    } else {
      parts.push(`피부: ${formatWithMemos(skin, skinMemos, ['좋음'])}`)
    }
  }

  if (tangles.length > 0) {
    const none = tangles.length === 1 && tangles[0] === '없음'
    if (!none) parts.push(`엉킴: ${formatWithMemos(tangles, tangleMemos, ['없음'])}`)
  }

  if (eyes.length > 0) {
    const clean = eyes.length === 1 && eyes[0] === '깨끗함'
    if (!clean) parts.push(`눈: ${formatWithMemos(eyes, eyeMemos, ['깨끗함'])}`)
    else parts.push('눈 상태 양호')
  }

  if (ears.length > 0) {
    const clean = ears.length === 1 && ears[0] === '깨끗함'
    if (!clean) parts.push(`귀: ${formatWithMemos(ears, earMemos, ['깨끗함'])}`)
    else parts.push('귀 상태 양호')
  }

  if (teethStatus) {
    parts.push(
      teethStatus === 'clean'
        ? '치아 상태 깨끗함'
        : `치아 관리 필요${teethMemo ? ` (${teethMemo})` : ''}`
    )
  }

  if (nailStatus) {
    parts.push(nailStatus === 'good' ? '발톱 적당함' : '발톱 관리 필요')
  }

  return parts.length > 0 ? parts.join('\n') : ''
}

/** 서비스 + 신체 상태로 케어 팁 자동 생성 */
function generateCareTips({
  mainService,
  spaLevel,
  skin,
  tangles,
  teethStatus,
  nailStatus,
}: {
  mainService: string
  spaLevel: SpaLevel
  skin: string[]
  tangles: string[]
  teethStatus: TeethStatus
  nailStatus: NailStatus
}): string[] {
  const tips: string[] = []

  // 서비스 기반 팁
  if (mainService === '전체미용') {
    tips.push('미용 후 2~3일은 빗질을 부드럽게 해주세요.')
  }
  if (mainService === '목욕관리') {
    tips.push('목욕 후 완전 건조가 중요합니다. 습한 상태로 방치하지 마세요.')
  }

  // 스파 팁
  if (spaLevel) {
    tips.push('스파 후 24시간은 목욕을 피해주세요. 영양 성분 흡수를 위해 필요합니다.')
  }

  // 피부 이슈
  const skinIssues = skin.filter((s) => s !== '좋음')
  if (skinIssues.includes('건조')) {
    tips.push('보습 관리를 꾸준히 해주세요. 실내 가습기 사용을 권장합니다.')
  }
  if (skinIssues.includes('민감') || skinIssues.includes('붉은반점')) {
    tips.push('피부가 민감한 상태입니다. 자극이 적은 제품을 사용해주세요.')
  }
  if (skinIssues.includes('각질') || skinIssues.includes('기름짐')) {
    tips.push('주기적인 스킨 케어가 필요합니다. 다음 방문 시 스파를 추천드립니다.')
  }

  // 엉킴
  const tangleIssues = tangles.filter((t) => t !== '없음')
  if (tangleIssues.length > 0) {
    tips.push(`${tangleIssues.join(', ')} 부위에 엉킴이 있었습니다. 매일 빗질을 해주시면 좋겠습니다.`)
  }

  // 치아
  if (teethStatus === 'needs_care') {
    tips.push('치석이 쌓이고 있습니다. 주 2~3회 양치를 권장합니다.')
  }

  // 발톱
  if (nailStatus === 'needs_care') {
    tips.push('발톱이 길었습니다. 2주마다 체크해주세요.')
  }

  if (tips.length === 0) {
    tips.push('전반적으로 컨디션이 좋습니다. 다음 정기 방문을 추천드립니다.')
  }

  return tips
}

// ─────────────────────────────────────────────
// 공통 UI 컴포넌트
// ─────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`border border-dz-border/50 bg-white p-6 ${className}`}>{children}</div>
  )
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-dz-accent">{title}</p>
      {sub && <p className="mt-0.5 text-[11px] text-dz-muted/60">{sub}</p>}
    </div>
  )
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.1em] text-dz-muted">
        {label}
        {required && <span className="ml-0.5 text-dz-accent">*</span>}
      </label>
      {children}
    </div>
  )
}

function CheckChips({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[]
  selected: string[]
  onToggle: (val: string) => void
  exclusive?: string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const checked = selected.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`border px-3 py-1.5 text-[12px] font-medium transition-all duration-400 ${
              checked
                ? 'border-dz-primary bg-dz-primary text-white'
                : 'border-dz-border text-dz-muted hover:border-dz-muted'
            }`}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

function BodyRow({
  label,
  options,
  selected,
  onToggle,
  exclusive,
  memos,
  onMemoChange,
  memoExclusions,
}: {
  label: string
  options: readonly string[]
  selected: string[]
  onToggle: (val: string) => void
  exclusive?: string
  memos?: Record<string, string>
  onMemoChange?: (key: string, val: string) => void
  memoExclusions?: string[]
}) {
  const exclusions = memoExclusions ?? []
  return (
    <div className="border-b border-dz-border/30 py-3 last:border-b-0">
      <div className="flex items-start gap-3">
        <span className="w-12 shrink-0 pt-0.5 text-[11px] font-medium uppercase tracking-[0.1em] text-dz-muted">{label}</span>
        <div className="flex-1">
          <CheckChips options={options} selected={selected} onToggle={onToggle} exclusive={exclusive} />
          {/* 체크된 항목별 개별 메모 */}
          {memos && onMemoChange && selected.filter((s) => !exclusions.includes(s)).length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              {selected.filter((s) => !exclusions.includes(s)).map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="shrink-0 bg-dz-accent/10 px-2 py-0.5 text-[10px] font-medium text-dz-accent">{item}</span>
                  <input
                    type="text"
                    value={memos[item] ?? ''}
                    onChange={(e) => onMemoChange(item, e.target.value)}
                    placeholder="부위 (예: 다리, 배)"
                    className="flex-1 border-b border-dz-border bg-transparent px-0 py-1 text-xs text-dz-primary placeholder:text-dz-border outline-none transition-all duration-400 focus:border-dz-primary"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function NoteCard({
  note,
  onChange,
  onRemove,
}: {
  note: NoteEntry
  onChange: (patch: Partial<NoteEntry>) => void
  onRemove: () => void
}) {
  const SEVERITY_COLOR: Record<string, string> = {
    일반: 'bg-stone-100 text-stone-600',
    경미: 'bg-blue-100 text-blue-700',
    보통: 'bg-orange-100 text-orange-700',
    심각: 'bg-red-100 text-red-700',
  }
  const SEVERITY_ACTIVE: Record<string, string> = {
    일반: 'bg-stone-600 text-white',
    경미: 'bg-blue-500 text-white',
    보통: 'bg-orange-500 text-white',
    심각: 'bg-red-600 text-white',
  }
  return (
    <div className={`flex flex-col gap-3 rounded-xl border px-4 py-4 ${note.isPinned ? 'border-amber-300 bg-amber-50/40' : 'border-stone-200 bg-white'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onChange({ isPinned: !note.isPinned })} className={`text-base transition-opacity ${note.isPinned ? 'opacity-100' : 'opacity-25 hover:opacity-50'}`}>
            📌
          </button>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_COLOR[note.severity]}`}>{note.severity}</span>
        </div>
        <button type="button" onClick={onRemove} className="text-lg leading-none text-stone-300 transition-colors hover:text-red-400">
          ✕
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {NOTE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onChange({ category: cat })}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${note.category === cat ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-500 hover:bg-amber-50'}`}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        {SEVERITY_OPTIONS.map((sev) => (
          <button
            key={sev}
            type="button"
            onClick={() => onChange({ severity: sev })}
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors ${note.severity === sev ? SEVERITY_ACTIVE[sev] : 'border border-stone-200 bg-stone-50 text-stone-500 hover:bg-stone-100'}`}
          >
            {sev}
          </button>
        ))}
      </div>
      <textarea
        value={note.content}
        onChange={(e) => onChange({ content: e.target.value })}
        placeholder="내용을 입력하세요"
        rows={3}
        className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-300 outline-none transition-colors focus:bg-white focus:ring-2 focus:ring-amber-300"
      />
      <button
        type="button"
        onClick={() => onChange({ followUpNeeded: !note.followUpNeeded, followUpDate: '' })}
        className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${note.followUpNeeded ? 'border-amber-500 bg-amber-500 text-white' : 'border-stone-200 bg-stone-50 text-stone-500 hover:bg-amber-50'}`}
      >
        {note.followUpNeeded ? '✅' : '⬜'} 추적 관찰 필요
      </button>
      {note.followUpNeeded && (
        <input
          type="date"
          value={note.followUpDate}
          onChange={(e) => onChange({ followUpDate: e.target.value })}
          className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-stone-800 outline-none focus:ring-2 focus:ring-amber-400 transition-colors"
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// 사진 업로드 미리보기
// ─────────────────────────────────────────────
function PhotoUploadSection({
  photos,
  onAdd,
  onRemove,
}: {
  photos: { id: string; file: File; preview: string }[]
  onAdd: (files: FileList) => void
  onRemove: (id: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {photos.map((p) => (
          <div key={p.id} className="group relative h-24 w-24 overflow-hidden rounded-xl border border-stone-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(p.id)}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-24 w-24 flex-col items-center justify-center rounded-xl border-2 border-dashed border-stone-200 text-stone-400 transition-colors hover:border-amber-400 hover:text-amber-500"
        >
          <span className="text-2xl leading-none">+</span>
          <span className="mt-1 text-[10px] font-semibold">사진 추가</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onAdd(e.target.files)
            e.target.value = ''
          }
        }}
      />
      <p className="text-xs text-stone-400">최대 5장까지 업로드할 수 있습니다.</p>
    </div>
  )
}

// ─────────────────────────────────────────────
// 저장 완료 모달
// ─────────────────────────────────────────────
function CompleteModal({
  shareUrl,
  petId,
  onClose,
}: {
  shareUrl: string
  petId: string
  onClose: () => void
}) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleKakao() {
    if (typeof window !== 'undefined' && (window as any).Kakao?.Share) {
      ;(window as any).Kakao.Share.sendDefault({
        objectType: 'feed',
        content: {
          title: 'DAZUL 케어 리포트',
          description: '케어 리포트가 업데이트되었습니다.',
          imageUrl: '',
          link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
        },
        buttons: [{ title: '리포트 보기', link: { mobileWebUrl: shareUrl, webUrl: shareUrl } }],
      })
    } else if (shareUrl) {
      handleCopy()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 text-center">
          <p className="text-2xl">✅</p>
          <h2 className="mt-2 text-lg font-bold text-stone-800">기록이 저장되었습니다</h2>
        </div>

        {shareUrl && (
          <div className="space-y-2">
            <p className="break-all rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-500">{shareUrl}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50"
              >
                {copied ? '복사됨 ✓' : '링크 복사'}
              </button>
              <button
                type="button"
                onClick={handleKakao}
                className="flex-1 rounded-xl bg-[#FEE500] py-2.5 text-sm font-bold text-[#3C1E1E] transition-colors hover:bg-[#FDD835]"
              >
                카카오톡 공유
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            onClose()
            router.push(`/admin/pets/${petId}`)
          }}
          className="mt-4 w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-white transition-colors hover:bg-amber-600"
        >
          확인
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 메인 래퍼 (Suspense for useSearchParams)
// ─────────────────────────────────────────────
export default function AdminNewRecordPageWrapper() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-sm text-stone-400">불러오는 중...</div>}>
      <SessionForm />
    </Suspense>
  )
}

// ─────────────────────────────────────────────
// 메인 폼
// ─────────────────────────────────────────────
function SessionForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const today = new Date().toISOString().split('T')[0]
  const [isPending, startTransition] = useTransition()
  const savingRef = useRef(false)

  // ─── DB 조회용 ───
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [filteredPets, setFilteredPets] = useState<Pet[]>([])

  // ─── 기본 정보 ───
  const [guardianId, setGuardianId] = useState(searchParams.get('guardianId') ?? '')
  const [petId, setPetId] = useState(searchParams.get('petId') ?? '')
  const [petName, setPetName] = useState('')
  const [sessionDate, setSessionDate] = useState(today)
  const [guardianName, setGuardianName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')

  // ─── 검색 ───
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ type: 'guardian' | 'pet'; id: string; name: string; sub: string }[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null)

  // ─── 서비스 ───
  const [mainService, setMainService] = useState('')
  const [spaLevel, setSpaLevel] = useState<SpaLevel>(null)
  const [styleNotes, setStyleNotes] = useState('')

  // ─── 제품 선택 (DB) ───
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const toggleProduct = (id: string) =>
    setSelectedProductIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  const filteredProducts = selectedCategoryId
    ? allProducts.filter((p) => p.category_id === selectedCategoryId)
    : allProducts

  // ─── 신체 상태 ───
  const [skin, setSkin] = useState<string[]>([])
  const [skinMemos, setSkinMemos] = useState<Record<string, string>>({})
  const [tangles, setTangles] = useState<string[]>([])
  const [tangleMemos, setTangleMemos] = useState<Record<string, string>>({})
  const [eyes, setEyes] = useState<string[]>([])
  const [eyeMemos, setEyeMemos] = useState<Record<string, string>>({})
  const [ears, setEars] = useState<string[]>([])
  const [earMemos, setEarMemos] = useState<Record<string, string>>({})
  const updateMemo = (setter: React.Dispatch<React.SetStateAction<Record<string, string>>>) =>
    (key: string, val: string) => setter((prev) => ({ ...prev, [key]: val }))
  const [teethStatus, setTeethStatus] = useState<TeethStatus>(null)
  const [teethMemo, setTeethMemo] = useState('')
  const [nailStatus, setNailStatus] = useState<NailStatus>(null)

  // ─── 메모 ───
  const [notes, setNotes] = useState<NoteEntry[]>([])
  const addNote = () =>
    setNotes((prev) => [
      ...prev,
      { id: crypto.randomUUID(), category: '케어', severity: '일반', content: '', isPinned: false, followUpNeeded: false, followUpDate: '' },
    ])
  const updateNote = (id: string, patch: Partial<NoteEntry>) => setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)))
  const removeNote = (id: string) => setNotes((prev) => prev.filter((n) => n.id !== id))

  const [comment, setComment] = useState('')
  const [error, setError] = useState('')

  // ─── 다음 방문 ───
  const [nextVisitOption, setNextVisitOption] = useState('')
  const [nextVisitDate, setNextVisitDate] = useState('')
  const [nextVisitCustom, setNextVisitCustom] = useState('')

  // ─── 사진 업로드 ───
  const [photos, setPhotos] = useState<{ id: string; file: File; preview: string }[]>([])

  const handleAddPhotos = useCallback((files: FileList) => {
    const newPhotos = Array.from(files).slice(0, 5).map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }))
    setPhotos((prev) => [...prev, ...newPhotos].slice(0, 5))
  }, [])

  const handleRemovePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const removed = prev.find((p) => p.id === id)
      if (removed) URL.revokeObjectURL(removed.preview)
      return prev.filter((p) => p.id !== id)
    })
  }, [])

  // ─── 저장 완료 모달 ───
  const [showModal, setShowModal] = useState(false)
  const [savedShareUrl, setSavedShareUrl] = useState('')
  const [savedPetId, setSavedPetId] = useState('')

  // ─── 건강 요약 미리보기 ───
  const healthPreview = generateHealthSummary({
    skin, skinMemos,
    tangles, tangleMemos,
    eyes, eyeMemos,
    ears, earMemos,
    teethStatus, teethMemo, nailStatus,
  })

  // ─── 케어 팁 미리보기 ───
  const careTips = generateCareTips({
    mainService,
    spaLevel,
    skin,
    tangles,
    teethStatus,
    nailStatus,
  })

  // ─── 다음 방문 옵션 선택 → 날짜 자동 계산 ───
  useEffect(() => {
    if (!nextVisitOption || nextVisitOption === 'custom') return
    const opt = NEXT_VISIT_OPTIONS.find((o) => o.value === nextVisitOption)
    if (opt) {
      setNextVisitDate(addDays(sessionDate, opt.days))
    }
  }, [nextVisitOption, sessionDate])

  // ─── 초기 데이터 로드 ───
  useEffect(() => {
    async function load() {
      const [gResult, pResult, catResult, prodResult] = await Promise.all([
        supabase.from('guardians').select('id, name, phone').order('name'),
        supabase.from('pets').select('id, guardian_id, name, breed').order('name'),
        supabase.from('product_categories').select('id, name, slug').order('sort_order').order('name'),
        supabase.from('products').select('id, name, brand, category_id').eq('is_active', true).order('name'),
      ])
      setGuardians(gResult.data || [])
      setPets(pResult.data || [])
      setProductCategories(catResult.data || [])
      setAllProducts(prodResult.data || [])
    }
    load()
  }, [])

  // ─── 검색 (보호자 + 반려견 동시) ───
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      const q = searchQuery.trim()
      const [gRes, pRes] = await Promise.all([
        supabase.from('guardians').select('id, name, phone').ilike('name', `%${q}%`).limit(5),
        supabase.from('pets').select('id, guardian_id, name, breed').ilike('name', `%${q}%`).limit(5),
      ])
      const results: typeof searchResults = []
      for (const g of gRes.data ?? []) results.push({ type: 'guardian', id: g.id, name: g.name, sub: g.phone ?? '' })
      for (const p of pRes.data ?? []) {
        const gName = guardians.find((g) => g.id === p.guardian_id)?.name ?? ''
        results.push({ type: 'pet', id: p.id, name: p.name, sub: `${p.breed ?? ''} ${gName ? `· ${gName}` : ''}`.trim() })
      }
      setSearchResults(results)
      setShowSearchResults(results.length > 0)
    }, 300)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [searchQuery, guardians])

  // ─── 보호자 선택 → 반려견 필터 + 자동완성 ───
  useEffect(() => {
    if (!guardianId) {
      setFilteredPets([])
      return
    }
    const next = pets.filter((p) => p.guardian_id === guardianId)
    setFilteredPets(next)
    if (!next.find((p) => p.id === petId)) setPetId('')

    const g = guardians.find((g) => g.id === guardianId)
    if (g) {
      setGuardianName(g.name ?? '')
      setGuardianPhone(g.phone ?? '')
    }
  }, [guardianId, pets, guardians, petId])

  // ─── 반려견 선택 → 이름 자동완성 (수동 오버라이드 허용) ───
  const petAutoFilled = useRef(false)
  useEffect(() => {
    const p = pets.find((p) => p.id === petId)
    if (p) {
      setPetName(p.name ?? '')
      petAutoFilled.current = true
    }
  }, [petId, pets])

  // ─── 저장 ───
  function handleSave() {
    if (!petId) {
      setError('반려견을 선택해주세요.')
      return
    }
    if (!mainService) {
      setError('서비스 종류를 선택해주세요.')
      return
    }
    if (savingRef.current) return
    savingRef.current = true
    setError('')

    startTransition(async () => {
      try {
        // 서비스 문자열 조합
        const serviceParts = [mainService]
        if (spaLevel) serviceParts.push(`스파 ${SPA_OPTIONS.find((s) => s.value === spaLevel)?.label ?? spaLevel}`)
        const serviceStr = serviceParts.join(', ')

        // 건강 상태 문자열
        // 항목(부위) 형식 포맷
        const fmtItems = (items: string[], memos: Record<string, string>, excludes: string[] = []) =>
          items.filter((i) => !excludes.includes(i)).map((i) => memos[i] ? `${i}(${memos[i]})` : i).join(', ')

        const skinStr = skin.length > 0 ? fmtItems(skin, skinMemos) : null
        const coatStr = tangles.length > 0 && !(tangles.length === 1 && tangles[0] === '없음')
          ? `엉킴: ${fmtItems(tangles, tangleMemos, ['없음'])}`
          : null
        const conditionStr = [
          eyes.length > 0 && !(eyes.length === 1 && eyes[0] === '깨끗함') ? `눈: ${fmtItems(eyes, eyeMemos, ['깨끗함'])}` : '',
          ears.length > 0 && !(ears.length === 1 && ears[0] === '깨끗함') ? `귀: ${fmtItems(ears, earMemos, ['깨끗함'])}` : '',
          teethStatus ? `치아: ${teethStatus === 'clean' ? '깨끗함' : '관리필요'}${teethMemo ? ` (${teethMemo})` : ''}` : '',
          nailStatus ? `발톱: ${nailStatus === 'good' ? '적당함' : '관리필요'}` : '',
        ]
          .filter(Boolean)
          .join(' / ') || null

        // 메모 합치기
        const pinnedNotes = notes.filter((n) => n.isPinned).map((n) => `[📌 ${n.category}] ${n.content}`)
        const regularNotes = notes.filter((n) => !n.isPinned).map((n) => `[${n.category}] ${n.content}`)
        const allNotes = [...pinnedNotes, ...regularNotes].filter((n) => n.trim())
        const specialStr = allNotes.length > 0 ? allNotes.join('\n') : null

        // 다음 방문 추천
        const nextRecommendation =
          nextVisitDate
            ? `${nextVisitOption === 'custom' ? nextVisitCustom || '직접 지정' : nextVisitOption} 후 (${nextVisitDate})`
            : notes.find((n) => n.category === '다음 추천')?.content || null

        // 건강 요약 → note 필드에 저장 (healthPreview + comment 합산)
        const noteField = [healthPreview, comment].filter(Boolean).join('\n\n---\n\n') || null

        // 케어 팁 → next_care_guide 필드에 저장
        const careTipsStr = careTips.length > 0 ? careTips.join('\n') : null

        const payload: Record<string, unknown> = {
          guardian_id: guardianId || null,
          pet_id: petId,
          pet_name: petName || null,
          guardian_name: guardianName || null,
          visit_date: sessionDate,
          service_type: serviceStr,
          service: mainService,
          skin_status: skinStr,
          coat_status: coatStr,
          condition_status: conditionStr,
          stress_status: null,
          special_notes: specialStr,
          next_visit_recommendation: nextRecommendation,
          care_summary: styleNotes || null,
          care_actions: selectedProductIds.length > 0
            ? allProducts.filter((p) => selectedProductIds.includes(p.id)).map((p) => `${p.name}${p.brand ? ` (${p.brand})` : ''}`).join(', ')
            : null,
          care_notes: null,
          next_care_guide: careTipsStr,
          note: noteField,
          spa_level: spaLevel || null,
          next_visit_date: nextVisitDate || null,
          comment: comment.trim() || null,
        }

        // TODO: 사진 업로드 (supabase.storage)
        // if (photos.length > 0) {
        //   const photoUrls: string[] = []
        //   for (const photo of photos) {
        //     const path = `visit-photos/${petId}/${sessionDate}/${photo.id}.jpg`
        //     const { error: uploadError } = await supabase.storage
        //       .from('photos')
        //       .upload(path, photo.file, { contentType: photo.file.type })
        //     if (!uploadError) {
        //       const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
        //       photoUrls.push(urlData.publicUrl)
        //     }
        //   }
        //   if (photoUrls.length > 0) payload.photo_urls = photoUrls
        // }

        const { data: insertedRows, error: insertError } = await supabase
          .from('visit_records')
          .insert(payload)
          .select('id')

        if (insertError) {
          setError(`저장 실패: ${insertError.message}`)
          return
        }

        const newRecordId = insertedRows?.[0]?.id

        // 자동 팔로업
        if (newRecordId) {
          try {
            await createAutoFollowups({
              visitRecordId: newRecordId,
              petId,
              guardianId: guardianId || null,
              visitDate: sessionDate,
              serviceType: serviceStr,
              skinStatus: skinStr,
              coatStatus: coatStr,
              conditionStatus: conditionStr,
              specialNotes: specialStr,
              nextVisitRecommendation: nextRecommendation,
              careNotes: null,
            })
          } catch {
            /* ignore */
          }
        }

        // 팔로업 메모 (추적 관찰이 필요한 노트)
        for (const n of notes.filter((n) => n.followUpNeeded && n.content.trim())) {
          try {
            await supabase.from('followups').insert({
              pet_id: petId,
              guardian_id: guardianId || null,
              related_record_id: newRecordId,
              type: n.category === '피부' ? '피부 체크' : '컨디션 체크',
              status: 'pending',
              due_date: n.followUpDate || null,
              note: n.content,
            })
          } catch {
            /* ignore */
          }
        }

        // 공유 링크
        let shareUrl = ''
        if (guardianId) {
          try {
            const { data: gData } = await supabase.from('guardians').select('share_token').eq('id', guardianId).maybeSingle()
            if (gData?.share_token) shareUrl = buildSiteUrl(`/report/${gData.share_token}`)
          } catch {
            /* ignore */
          }
        }

        setSavedShareUrl(shareUrl)
        setSavedPetId(petId)
        setShowModal(true)
      } catch {
        setError('저장 중 예상치 못한 오류가 발생했습니다.')
      } finally {
        savingRef.current = false
      }
    })
  }

  const inputCls =
    'w-full border-b border-dz-border bg-transparent px-0 py-2.5 text-sm text-dz-primary outline-none transition-all duration-400 placeholder:text-dz-border focus:border-dz-primary'

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-12">
      {/* 저장 완료 모달 */}
      {showModal && <CompleteModal shareUrl={savedShareUrl} petId={savedPetId} onClose={() => setShowModal(false)} />}

      {/* 헤더 */}
      <div>
        <Link
          href="/admin/records"
          className="text-[11px] tracking-[0.1em] text-dz-muted transition-all duration-400 hover:text-dz-primary"
        >
          ← 케어 기록
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-dz-primary">케어 기록 작성</h1>
        <p className="mt-1 text-[12px] text-dz-muted">
          방문 기록과 신체 상태를 입력합니다
        </p>
      </div>

      <div className="flex flex-col gap-5">
          {/* ① 고객 검색 */}
          <Card>
            <SectionHeader title="고객 검색" sub="보호자 또는 반려견 이름으로 검색" />
            <div className="flex flex-col gap-5">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowSearchResults(true) }}
                  onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                  placeholder="보호자 또는 반려견 이름 검색..."
                  className={inputCls}
                />
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-lg">
                    {searchResults.map((r) => (
                      <button
                        key={`${r.type}-${r.id}`}
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-amber-50"
                        onClick={() => {
                          if (r.type === 'guardian') {
                            setGuardianId(r.id)
                            setGuardianName(r.name)
                          } else {
                            setPetId(r.id)
                            setPetName(r.name)
                            const pet = pets.find((p) => p.id === r.id)
                            if (pet?.guardian_id) {
                              setGuardianId(pet.guardian_id)
                              const g = guardians.find((g) => g.id === pet.guardian_id)
                              if (g) { setGuardianName(g.name); setGuardianPhone(g.phone ?? '') }
                            }
                          }
                          setSearchQuery('')
                          setShowSearchResults(false)
                        }}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-xs">
                          {r.type === 'guardian' ? '👤' : '🐾'}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-stone-800">{r.name}</p>
                          <p className="text-xs text-stone-400">{r.type === 'guardian' ? '보호자' : '반려견'} · {r.sub}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 선택된 고객 표시 */}
              {(guardianId || petId) && (
                <div className="flex flex-wrap gap-2">
                  {guardianName && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-700">
                      👤 {guardianName}
                      <button type="button" onClick={() => { setGuardianId(''); setGuardianName(''); setGuardianPhone('') }} className="ml-1 text-stone-400 hover:text-red-400">✕</button>
                    </span>
                  )}
                  {petName && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700">
                      🐾 {petName}
                      <button type="button" onClick={() => { setPetId(''); setPetName('') }} className="ml-1 text-amber-400 hover:text-red-400">✕</button>
                    </span>
                  )}
                </div>
              )}

              {/* 보호자 선택 후 반려견 드롭다운 (검색 대체) */}
              {guardianId && !petId && filteredPets.length > 0 && (
                <Field label="반려견 선택" required>
                  <div className="flex flex-wrap gap-2">
                    {filteredPets.map((p) => (
                      <button key={p.id} type="button" onClick={() => { setPetId(p.id); setPetName(p.name) }}
                        className="rounded-xl border-2 border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-600 transition-all hover:border-amber-400 hover:text-amber-600">
                        {p.name} {p.breed ? `(${p.breed})` : ''}
                      </button>
                    ))}
                  </div>
                </Field>
              )}
            </div>
          </Card>

          {/* ② 기본 정보 */}
          <Card>
            <SectionHeader title="기본 정보" />
            <div className="flex flex-col gap-5">
              <Field label="날짜">
                <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} className={inputCls} />
              </Field>
            </div>
          </Card>

          {/* ③ 오늘의 서비스 */}
          <Card>
            <SectionHeader title="오늘의 서비스" />
            <div className="flex flex-col gap-5">
              <Field label="메인 서비스" required>
                <div className="grid grid-cols-2 gap-2">
                  {MAIN_SERVICES.map((svc) => (
                    <button
                      key={svc}
                      type="button"
                      onClick={() => setMainService(svc)}
                      className={`rounded-xl border-2 py-3 text-sm font-bold transition-all ${
                        mainService === svc
                          ? 'border-dz-primary bg-dz-primary text-white'
                          : 'border-dz-border text-dz-muted hover:border-dz-muted'
                      }`}
                    >
                      {svc}
                    </button>
                  ))}
                </div>
              </Field>

              {/* 스파코스 */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-stone-500">✨ 스파코스</label>
                <div className={`rounded-2xl border-2 p-4 transition-all ${spaLevel ? 'border-amber-400 bg-amber-50' : 'border-stone-200 bg-stone-50'}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-stone-700">스파코스</p>
                      <p className="text-xs text-stone-400">피부 상태에 따라 선택</p>
                    </div>
                    {spaLevel && (
                      <button type="button" onClick={() => setSpaLevel(null)} className="text-xs text-stone-400 transition-colors hover:text-red-400">
                        해제
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {SPA_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSpaLevel((prev) => (prev === opt.value ? null : opt.value))}
                        className={`flex flex-col items-center rounded-xl border-2 px-2 py-3 transition-all ${
                          spaLevel === opt.value
                            ? 'border-amber-500 bg-amber-500 text-white'
                            : 'border-stone-200 bg-white text-stone-600 hover:border-amber-300'
                        }`}
                      >
                        <span className="text-sm font-bold">{opt.label}</span>
                        <span className={`mt-0.5 text-center text-[10px] leading-tight ${spaLevel === opt.value ? 'text-amber-100' : 'text-stone-400'}`}>
                          {opt.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 사용 제품 (DB) */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-stone-500">사용 제품</label>
                {/* 카테고리 탭 */}
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setSelectedCategoryId(null)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${!selectedCategoryId ? 'bg-stone-700 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>
                    전체
                  </button>
                  {productCategories.map((cat) => (
                    <button key={cat.id} type="button" onClick={() => setSelectedCategoryId(cat.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${selectedCategoryId === cat.id ? 'bg-stone-700 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}>
                      {cat.name}
                    </button>
                  ))}
                </div>
                {/* 제품 선택 */}
                <div className="flex flex-wrap gap-2">
                  {filteredProducts.map((p) => {
                    const on = selectedProductIds.includes(p.id)
                    return (
                      <button key={p.id} type="button" onClick={() => toggleProduct(p.id)}
                        className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold transition-all ${
                          on ? 'border-amber-500 bg-amber-500 text-white' : 'border-stone-200 text-stone-600 hover:border-amber-300'
                        }`}>
                        {p.name}{p.brand ? ` (${p.brand})` : ''}
                      </button>
                    )
                  })}
                  {filteredProducts.length === 0 && (
                    <p className="text-xs text-stone-400">등록된 제품이 없습니다.</p>
                  )}
                </div>
                {/* 선택된 제품 배지 */}
                {selectedProductIds.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedProductIds.map((id) => {
                      const p = allProducts.find((x) => x.id === id)
                      return p ? (
                        <span key={id} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          {p.name}
                          <button type="button" onClick={() => toggleProduct(id)} className="text-amber-400 hover:text-red-400">✕</button>
                        </span>
                      ) : null
                    })}
                  </div>
                )}
              </div>
              <Field label="스타일 메모">
                <textarea
                  value={styleNotes}
                  onChange={(e) => setStyleNotes(e.target.value)}
                  placeholder="스타일 지시사항, 보호자 요청 등"
                  rows={2}
                  className="w-full resize-none border border-dz-border bg-transparent px-3 py-2.5 text-sm text-dz-primary placeholder:text-dz-border outline-none transition-all duration-400 focus:border-dz-primary"
                />
              </Field>
            </div>
          </Card>

          {/* ④ 신체 상태 */}
          <Card>
            <SectionHeader title="신체 상태" sub="해당 항목을 모두 체크하세요" />
            <div className="">
              <BodyRow label="피부" options={SKIN_OPTIONS} selected={skin} onToggle={(val) => setSkin((prev) => toggleArr(prev, val))} memos={skinMemos} onMemoChange={updateMemo(setSkinMemos)} memoExclusions={['좋음']} />
              <BodyRow label="엉킴" options={TANGLE_OPTIONS} selected={tangles} onToggle={(val) => setTangles((prev) => toggleArr(prev, val, '없음'))} exclusive="없음" memos={tangleMemos} onMemoChange={updateMemo(setTangleMemos)} memoExclusions={['없음']} />
              <BodyRow label="눈" options={EYE_OPTIONS} selected={eyes} onToggle={(val) => setEyes((prev) => toggleArr(prev, val))} memos={eyeMemos} onMemoChange={updateMemo(setEyeMemos)} memoExclusions={['깨끗함']} />
              <BodyRow label="귀" options={EAR_OPTIONS} selected={ears} onToggle={(val) => setEars((prev) => toggleArr(prev, val))} memos={earMemos} onMemoChange={updateMemo(setEarMemos)} memoExclusions={['깨끗함']} />

              {/* 치아 */}
              <div className="border-b border-stone-100 py-3">
                <div className="flex items-start gap-3">
                  <span className="w-12 shrink-0 pt-0.5 text-xs font-bold text-stone-400">치아</span>
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex flex-wrap gap-x-4 gap-y-2.5">
                      {(['깨끗함', '관리필요'] as const).map((opt) => {
                        const val: TeethStatus = opt === '깨끗함' ? 'clean' : 'needs_care'
                        const checked = teethStatus === val
                        return (
                          <button key={opt} type="button" onClick={() => setTeethStatus(checked ? null : val)} className="group flex items-center gap-1.5">
                            <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border-2 transition-all ${checked ? 'border-amber-500 bg-amber-500' : 'border-stone-300 group-hover:border-amber-400'}`}>
                              {checked && (
                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                            <span className={`text-sm ${checked ? 'font-semibold text-stone-800' : 'text-stone-500'}`}>{opt}</span>
                          </button>
                        )
                      })}
                    </div>
                    {teethStatus === 'needs_care' && (
                      <input type="text" value={teethMemo} onChange={(e) => setTeethMemo(e.target.value)} placeholder="메모 (예: 어금니 치석)" className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300 outline-none transition-colors focus:ring-2 focus:ring-amber-300" />
                    )}
                  </div>
                </div>
              </div>

              {/* 발톱 */}
              <div className="py-3">
                <div className="flex items-center gap-3">
                  <span className="w-12 shrink-0 text-xs font-bold text-stone-400">발톱</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-2.5">
                    {(['적당함', '관리필요'] as const).map((opt) => {
                      const val: NailStatus = opt === '적당함' ? 'good' : 'needs_care'
                      const checked = nailStatus === val
                      return (
                        <button key={opt} type="button" onClick={() => setNailStatus(checked ? null : val)} className="group flex items-center gap-1.5">
                          <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border-2 transition-all ${checked ? 'border-amber-500 bg-amber-500' : 'border-stone-300 group-hover:border-amber-400'}`}>
                            {checked && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          <span className={`text-sm ${checked ? 'font-semibold text-stone-800' : 'text-stone-500'}`}>{opt}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* ④-b 건강 요약 미리보기 */}
          {healthPreview && (
            <Card>
              <SectionHeader title="건강 요약 미리보기" sub="신체 상태 데이터에서 자동 생성됩니다" />
              <div className="">
                <div className="whitespace-pre-wrap rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-relaxed text-emerald-800">
                  {healthPreview}
                </div>
                <p className="mt-2 text-xs text-stone-400">* 이 내용은 기록의 note 필드에 자동 저장됩니다.</p>
              </div>
            </Card>
          )}

          {/* ⑤ 사진 업로드 */}
          <Card>
            <SectionHeader title="사진 기록" sub="미용 전/후 사진을 남겨주세요" />
            <div className="">
              <PhotoUploadSection photos={photos} onAdd={handleAddPhotos} onRemove={handleRemovePhoto} />
            </div>
          </Card>

          {/* ⑥ 케어 메모 */}
          <Card>
            <SectionHeader title="케어 메모" sub="특이사항, 다음 추천, 추적 관찰" />
            <div className="flex flex-col gap-3">
              {notes.length === 0 && <p className="py-3 text-center text-sm text-stone-400">메모가 없습니다</p>}
              {notes.map((note) => (
                <NoteCard key={note.id} note={note} onChange={(patch) => updateNote(note.id, patch)} onRemove={() => removeNote(note.id)} />
              ))}
              <button
                type="button"
                onClick={addNote}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-200 py-4 text-sm font-semibold text-stone-400 transition-all hover:border-amber-400 hover:bg-amber-50 hover:text-amber-600"
              >
                <span className="text-lg leading-none">+</span> 메모 추가
              </button>
            </div>
          </Card>

          {/* ⑦ 다음 방문 추천 */}
          <Card>
            <SectionHeader title="다음 방문" sub="다음 방문 시기를 선택해주세요" />
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap gap-2">
                {NEXT_VISIT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setNextVisitOption(opt.value)
                      setNextVisitDate(addDays(sessionDate, opt.days))
                    }}
                    className={`border px-3 py-1.5 text-[12px] font-medium transition-all duration-400 ${
                      nextVisitOption === opt.value
                        ? 'border-dz-primary bg-dz-primary text-white'
                        : 'border-dz-border text-dz-muted hover:border-dz-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setNextVisitOption('custom')
                    setNextVisitDate('')
                  }}
                  className={`border px-3 py-1.5 text-[12px] font-medium transition-all duration-400 ${
                    nextVisitOption === 'custom'
                      ? 'border-dz-primary bg-dz-primary text-white'
                      : 'border-dz-border text-dz-muted hover:border-dz-muted'
                  }`}
                >
                  직접 선택
                </button>
              </div>
              {nextVisitOption === 'custom' && (
                <div className="flex flex-col gap-2">
                  <input
                    type="date"
                    value={nextVisitDate}
                    onChange={(e) => setNextVisitDate(e.target.value)}
                    min={sessionDate}
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={nextVisitCustom}
                    onChange={(e) => setNextVisitCustom(e.target.value)}
                    placeholder="메모 (예: 6주 후 전체미용)"
                    className={inputCls}
                  />
                </div>
              )}
              {nextVisitDate && nextVisitOption !== 'custom' && (
                <p className="text-sm text-stone-500">
                  다음 방문 예정일: <span className="font-bold text-amber-600">{nextVisitDate}</span>
                </p>
              )}
            </div>
          </Card>

          {/* ⑧ 케어 팁 미리보기 */}
          {careTips.length > 0 && (
            <Card>
              <SectionHeader title="케어 팁 미리보기" sub="서비스 + 신체 상태에서 자동 생성됩니다" />
              <div className="">
                <ul className="flex flex-col gap-2">
                  {careTips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-sm text-blue-800">
                      <span className="mt-0.5 shrink-0 text-blue-400">💡</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-stone-400">* 이 팁들은 next_care_guide 필드에 자동 저장됩니다.</p>
              </div>
            </Card>
          )}

          {/* ⑨ 보호자 전달 메시지 */}
          <Card>
            <SectionHeader title="보호자 전달 메시지" sub="카카오톡 리포트에 표시됩니다" />
            <div className="flex flex-col gap-3">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={5}
                placeholder={`예) 오늘 미모 리즈 갱신한 ○○이 ♡\n낭이 많이 풀려있는데 ○○이가 해맑게 잘 버텼어요 🙂\n다음엔 귀 청소 같이 해드리면 좋을 것 같아요!`}
                className="w-full resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-base leading-relaxed text-stone-800 placeholder:text-stone-300 outline-none transition-colors focus:bg-white focus:ring-2 focus:ring-amber-300"
              />
              <p className="text-right text-xs leading-relaxed text-stone-400">
                소중한 가족을 믿고 맡겨주셔서 감사드리며,
                <br />
                앞으로도 최선을 다하겠습니다. — 살롱다즐
              </p>
            </div>
          </Card>
        </div>

      {/* 저장 */}
      <div className="mt-2 space-y-3">
          {/* 상태 요약 뱃지 */}
          <div className="flex min-h-[24px] flex-wrap items-center gap-1.5">
            {petName ? (
              <span className="text-[11px] font-medium text-dz-primary">🐾 {petName}</span>
            ) : (
              <span className="text-[11px] font-medium text-red-500">반려견 미선택</span>
            )}
            {mainService && <span className="bg-dz-primary px-2 py-0.5 text-[10px] text-white">{mainService}</span>}
            {spaLevel && (
              <span className="bg-dz-accent/15 px-2 py-0.5 text-[10px] text-dz-accent">✨ {SPA_OPTIONS.find((s) => s.value === spaLevel)?.label}</span>
            )}
            {selectedProductIds.length > 0 && <span className="bg-dz-surface px-2 py-0.5 text-[10px] text-dz-muted">제품 {selectedProductIds.length}</span>}
          </div>

          {error && (
            <div className="flex items-center gap-2 border border-red-200 bg-red-50 px-3 py-2">
              <span className="flex-1 text-[12px] text-red-600">{error}</span>
              <button type="button" onClick={() => setError('')} className="text-red-300 hover:text-red-500">×</button>
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="w-full bg-dz-primary py-3.5 text-[11px] font-medium uppercase tracking-[0.3em] text-white transition-all duration-400 hover:bg-dz-primary/85 disabled:opacity-40"
          >
            {isPending ? '저장 중…' : '기록 저장'}
          </button>
      </div>
    </div>
  )
}
