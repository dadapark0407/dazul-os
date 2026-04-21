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
type Product = { id: string; name: string; brand: string | null; category: string | null; category_id: string | null }

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
const TANGLE_OPTIONS = ['없음', '귀', '머리', '꼬리', '겨드랑이', '목', '앞다리', '뒷다리', '기타'] as const
const EYE_OPTIONS = ['깨끗함', '붉음', '눈물많음'] as const
const EAR_OPTIONS = ['깨끗함', '노란귀지', '갈색귀지'] as const
const TEETH_OPTIONS = ['깨끗함', '관리필요'] as const
const NAIL_OPTIONS = ['적당함', '관리필요'] as const

// 기본 카테고리 (product_categories.name 과 일치)
const BASE_PRODUCT_CATEGORIES = ['샴푸', '린스', '피부케어', '피모케어', '위생관리', '기타'] as const
// 조건부 카테고리
const SPA_BONUS_CATEGORIES = ['스파', '팩'] as const
// 전체 (검색 매칭용)
const ALL_PRODUCT_CATEGORIES = [...BASE_PRODUCT_CATEGORIES, ...SPA_BONUS_CATEGORIES] as const

/** spaLevel에 따라 표시할 제품 카테고리 (조건부 항목은 맨 앞) */
function getVisibleProductCategories(spa: SpaLevel): string[] {
  const bonus: string[] = []
  if (spa === 'premium' || spa === 'prestige') bonus.push('스파')
  if (spa === 'deep' || spa === 'prestige') bonus.push('팩')
  return [...bonus, ...BASE_PRODUCT_CATEGORIES]
}

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
// 한글 IME 입력 보호 — composing 중에는 onChange 무시, compositionEnd 에 커밋
function imeHandlers(
  composingRef: React.MutableRefObject<boolean>,
  setter: (v: string) => void
) {
  return {
    onCompositionStart: () => {
      composingRef.current = true
    },
    onCompositionEnd: (e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      composingRef.current = false
      setter((e.currentTarget as HTMLInputElement | HTMLTextAreaElement).value)
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!composingRef.current) setter(e.target.value)
    },
  }
}

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
  eyes,
  ears,
  teethStatus,
  nailStatus,
}: {
  mainService: string
  spaLevel: SpaLevel
  skin: string[]
  tangles: string[]
  eyes: string[]
  ears: string[]
  teethStatus: TeethStatus
  nailStatus: NailStatus
}): string[] {
  const tips: string[] = []

  // 서비스 기반 팁
  if (mainService === '전체미용') {
    tips.push('미용 후 집에서 빗질을 꾸준히 해주시면 엉킴 예방과 스타일 유지에 도움이 됩니다.')
  }
  if (mainService === '목욕관리') {
    tips.push('가정에서 목욕하실 때는 린스를 꼭 사용해 주시고, 드라이는 피부 속까지 완전히 말려주셔야 피부 트러블 예방에 도움이 됩니다.')
  }

  // 스파 팁
  // 에센셜(premium) / 프레스티지(prestige) 코스에서만 스파 후 케어 안내 생성
  if (spaLevel === 'premium' || spaLevel === 'prestige') {
    tips.push('스파 후에는 혈액순환과 이완에 도움이 되어 피부와 컨디션 회복에 긍정적인 영향을 줄 수 있습니다. 오늘은 충분히 휴식할 수 있도록 편안한 시간을 주세요.')
  }

  // 피부 이슈
  const skinIssues = skin.filter((s) => s !== '좋음')
  if (skinIssues.includes('건조')) {
    tips.push('피부가 건조한 상태로 보여 보습 제품을 활용한 꾸준한 홈케어를 추천드립니다.')
  }
  if (skinIssues.includes('민감') || skinIssues.includes('붉은반점') || skinIssues.includes('붉음')) {
    tips.push('피부가 예민해진 상태일 수 있어 긁거나 핥거나 바닥·가구 등에 비비지 않는지 잘 살펴봐 주세요.')
  }
  if (skinIssues.includes('각질') || skinIssues.includes('기름짐')) {
    tips.push('피부 유수분 밸런스 관리가 필요한 상태입니다. 다음 방문 시 스파 또는 팩 케어를 함께 진행하시면 도움이 됩니다.')
  }

  // 엉킴
  const tangleIssues = tangles.filter((t) => t !== '없음')
  if (tangleIssues.length > 0) {
    tips.push(`${tangleIssues.join(', ')} 부위에 엉킴이 있었습니다. 엉킨 부위를 긁거나 핥을 경우 자극으로 인해 상처나 2차 감염이 생길 수 있으니 잘 살펴봐 주세요.`)
  }

  // 눈
  const hasEyeIssue = eyes.some((e) => e.includes('눈물') || e.includes('분비물'))
  if (hasEyeIssue) {
    tips.push('눈물이 많이 젖어 있으면 눈 주변 피부가 짓무르거나 착색될 수 있습니다. 자주 닦아주시고 항상 건조하고 청결하게 관리해 주세요.')
  }

  // 귀
  const hasEarIssue = ears.some((e) => e.includes('냄새') || e.includes('귀지') || e.includes('부음'))
  if (hasEarIssue) {
    tips.push('귀에서 냄새가 심하게 나거나 귀지가 많아지거나 붓기가 보일 경우 염증 가능성이 있어 동물병원 검진을 추천드립니다.')
  }

  // 치아
  if (teethStatus === 'needs_care') {
    tips.push('매일 강아지 전용 칫솔과 치약으로 양치해 주시면 구강 건강 유지에 도움이 됩니다.')
  }

  // 발톱
  if (nailStatus === 'needs_care') {
    tips.push('발톱은 2주 간격으로 체크해 주시면 보행 균형 유지와 발 건강 관리에 도움이 됩니다.')
  }

  if (tips.length === 0) {
    tips.push('오늘 전반적인 컨디션이 안정적이었습니다.')
  }

  return tips
}

// ─────────────────────────────────────────────
// 공통 UI 컴포넌트
// ─────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`border border-[#E8E8E8] bg-white p-8 ${className}`}>{children}</div>
  )
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <p className="text-[11px] font-light uppercase tracking-[0.15em] text-[#6B6B6B]">{title}</p>
      {sub && <p className="mt-1 text-[11px] text-[#6B6B6B]/50">{sub}</p>}
    </div>
  )
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-light uppercase tracking-[0.1em] text-[#6B6B6B]">
        {label}
        {required && <span className="ml-0.5 text-[#C9A96E]">*</span>}
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
            className={`border px-3 py-1.5 text-[12px] font-normal transition-all duration-300 ${
              checked
                ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                : 'border-[#D0D0D0] text-[#6B6B6B] hover:border-[#0A0A0A]'
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
  const composingRef = useRef(false)
  return (
    <div className="border-b border-[#E8E8E8] py-4 last:border-b-0">
      <div className="flex items-start gap-4">
        <span className="w-12 shrink-0 pt-0.5 text-[11px] font-light uppercase tracking-[0.1em] text-[#6B6B6B]">{label}</span>
        <div className="flex-1">
          <CheckChips options={options} selected={selected} onToggle={onToggle} exclusive={exclusive} />
          {/* 체크된 항목별 개별 메모 */}
          {memos && onMemoChange && selected.filter((s) => !exclusions.includes(s)).length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {selected.filter((s) => !exclusions.includes(s)).map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="shrink-0 border border-[#C9A96E]/30 bg-[#C9A96E]/5 px-2 py-0.5 text-[10px] font-normal text-[#C9A96E]">{item}</span>
                  <input
                    type="text"
                    value={memos[item] ?? ''}
                    {...imeHandlers(composingRef, (v) => onMemoChange(item, v))}
                    placeholder="부위 (예: 다리, 배)"
                    className="flex-1 border-b border-[#D0D0D0] bg-transparent px-0 py-1 text-xs text-[#0A0A0A] placeholder:text-[#D0D0D0] outline-none transition-all duration-300 focus:border-[#0A0A0A]"
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
  const composingRef = useRef(false)
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
        {...imeHandlers(composingRef, (v) => onChange({ content: v }))}
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

  // shareUrl 이 상대 경로로 넘어온 경우 브라우저 origin으로 보강 (방어적 처리)
  const absoluteShareUrl = (() => {
    if (!shareUrl) return ''
    if (/^https?:\/\//.test(shareUrl)) return shareUrl
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${shareUrl.startsWith('/') ? shareUrl : `/${shareUrl}`}`
    }
    return shareUrl
  })()

  function handleCopy() {
    if (!absoluteShareUrl) return
    navigator.clipboard.writeText(absoluteShareUrl).then(() => {
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
          link: { mobileWebUrl: absoluteShareUrl, webUrl: absoluteShareUrl },
        },
        buttons: [{ title: '리포트 보기', link: { mobileWebUrl: absoluteShareUrl, webUrl: absoluteShareUrl } }],
      })
    } else if (absoluteShareUrl) {
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

        {absoluteShareUrl && (
          <div className="space-y-2">
            <p className="break-all bg-[#FAFAFA] px-3 py-2 text-xs text-[#888]" style={{ border: '1px solid #E8E8E8' }}>{absoluteShareUrl}</p>
            {/* 링크 복사 */}
            <button
              type="button"
              onClick={handleCopy}
              style={{ width: '100%', border: '1px solid #E8E5E0', background: '#FFFFFF', color: '#8A8A7A', fontSize: 11, letterSpacing: '0.1em', padding: 14, cursor: 'pointer' }}
            >
              {copied ? '복사됨 ✓' : '링크 복사'}
            </button>
            {/* 리포트 미리보기 */}
            <button
              type="button"
              onClick={() => window.open(absoluteShareUrl, '_blank')}
              style={{ width: '100%', border: '1px solid #0A0A0A', background: '#FFFFFF', color: '#0A0A0A', fontSize: 11, letterSpacing: '0.1em', padding: 14, cursor: 'pointer' }}
            >
              리포트 미리보기
            </button>
            {/* 카카오톡 공유 */}
            <button
              type="button"
              onClick={handleKakao}
              style={{ width: '100%', background: '#FAE300', color: '#3B1E08', fontSize: 11, letterSpacing: '0.1em', fontWeight: 500, padding: 14, border: 'none', cursor: 'pointer' }}
            >
              카카오톡 공유
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            onClose()
            router.push(`/admin/pets/${petId}`)
          }}
          style={{ width: '100%', marginTop: 12, background: '#0A0A0A', color: '#FFFFFF', fontSize: 11, letterSpacing: '0.1em', fontWeight: 400, padding: 14, border: 'none', cursor: 'pointer' }}
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
  const composingRef = useRef(false)

  // ─── DB 조회용 ───
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [filteredPets, setFilteredPets] = useState<Pet[]>([])

  // ─── 기본 정보 ───
  const [guardianId, setGuardianId] = useState(searchParams.get('guardianId') ?? '')
  const [petId, setPetId] = useState(searchParams.get('petId') ?? '')
  const [petName, setPetName] = useState('')
  const [sessionDate, setSessionDate] = useState(today)
  const [weight, setWeight] = useState(() => {
    console.log('setWeight 호출:', '', '호출 위치:', '초기값')
    return ''
  })
  const [guardianName, setGuardianName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')

  // ─── 검색 ───
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{
    petId: string
    petName: string
    breed: string | null
    guardianId: string
    guardianName: string
    guardianPhone: string | null
  }[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null)

  // ─── 서비스 ───
  const [mainService, setMainService] = useState('')
  const [spaLevel, setSpaLevel] = useState<SpaLevel>(null)
  const [styleNotes, setStyleNotes] = useState('')

  // ─── 미용 스타일 ───
  const [groomingStyle, setGroomingStyle] = useState({ face: '', body: '', legs: '', tail: '', sanitary: '' })
  const [groomingPrefilled, setGroomingPrefilled] = useState(false)
  const setGS = (key: keyof typeof groomingStyle, val: string) => {
    setGroomingStyle((prev) => ({ ...prev, [key]: val }))
    setGroomingPrefilled(false) // 수동 편집하면 프리필 표시 해제
  }

  // ─── 제품 선택 (카테고리별 검색) ───
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [categoryNameToId, setCategoryNameToId] = useState<Record<string, string>>({})
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [productSearches, setProductSearches] = useState<Record<string, string>>({})
  const [focusedCat, setFocusedCat] = useState<string | null>(null)
  const toggleProduct = (id: string) =>
    setSelectedProductIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  const setProductSearch = (cat: string, val: string) =>
    setProductSearches((prev) => ({ ...prev, [cat]: val }))
  /** 카테고리별 검색 결과 — category_id FK 기준 */
  function getProductsForCategory(cat: string): Product[] {
    const q = (productSearches[cat] ?? '').toLowerCase()
    const targetId = categoryNameToId[cat] ?? null
    const knownIds = ALL_PRODUCT_CATEGORIES
      .filter((c) => c !== '기타')
      .map((c) => categoryNameToId[c])
      .filter((v): v is string => !!v)

    return allProducts.filter((p) => {
      let matchCat: boolean
      if (cat === '기타') {
        // "기타" 자체 id가 있으면 그걸로 매칭, 없으면 known 카테고리에 속하지 않은 것 모두
        matchCat = targetId
          ? p.category_id === targetId
          : !p.category_id || !knownIds.includes(p.category_id)
      } else {
        if (!targetId) return false // 해당 카테고리가 DB에 없음
        matchCat = p.category_id === targetId
      }
      if (!matchCat) return false
      if (!q) return true
      return (p.name ?? '').toLowerCase().includes(q) || (p.brand ?? '').toLowerCase().includes(q)
    })
  }

  // spaLevel이 바뀌면 제거된 카테고리의 선택 제품 초기화
  const visibleCategories = getVisibleProductCategories(spaLevel)
  useEffect(() => {
    const visible = getVisibleProductCategories(spaLevel)
    const visibleIds = new Set(
      visible.map((c) => categoryNameToId[c]).filter((v): v is string => !!v)
    )
    // 보이지 않는 카테고리에 속한 제품 제거
    setSelectedProductIds((prev) => prev.filter((id) => {
      const p = allProducts.find((x) => x.id === id)
      if (!p) return true
      // category_id가 없거나 visible 카테고리에 속하면 유지
      if (!p.category_id) return visible.includes('기타')
      return visibleIds.has(p.category_id)
    }))
    // 검색어도 초기화
    setProductSearches((prev) => {
      const next = { ...prev }
      for (const cat of SPA_BONUS_CATEGORIES) {
        if (!visible.includes(cat)) delete next[cat]
      }
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaLevel])

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
  const [teeth, setTeeth] = useState<string[]>([])
  const [teethMemos, setTeethMemos] = useState<Record<string, string>>({})
  const [nails, setNails] = useState<string[]>([])
  const [nailMemos, setNailMemos] = useState<Record<string, string>>({})
  // 하위 호환용 (generateHealthSummary 등에서 사용)
  const teethStatus: TeethStatus = teeth.length === 0 ? null : teeth.includes('깨끗함') && teeth.length === 1 ? 'clean' : 'needs_care'
  const teethMemo = Object.entries(teethMemos).filter(([, v]) => v).map(([k, v]) => `${k}(${v})`).join(', ')
  const nailStatus: NailStatus = nails.length === 0 ? null : nails.includes('적당함') && nails.length === 1 ? 'good' : 'needs_care'

  // ─── 메모 (단순화) ───
  const [internalMemo, setInternalMemo] = useState('')  // 내부 메모 → special_notes
  const [comment, setComment] = useState('')             // 보호자 전달 → comment
  const [needsFollowUp, setNeedsFollowUp] = useState(false)
  const [followUpDate, setFollowUpDate] = useState('')
  // 하위 호환: notes 배열은 팔로업 생성에만 사용
  const notes: NoteEntry[] = internalMemo.trim()
    ? [{ id: 'internal', category: '케어', severity: '일반', content: internalMemo, isPinned: false, followUpNeeded: needsFollowUp, followUpDate }]
    : []
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

  // ─── 케어 팁 미리보기 (편집 가능) ───
  const autoCareTips = generateCareTips({
    mainService,
    spaLevel,
    skin,
    tangles,
    eyes,
    ears,
    teethStatus,
    nailStatus,
  })
  // customCareTips: null이면 자동 생성 결과 사용, 배열이면 사용자가 편집한 버전
  const [customCareTips, setCustomCareTips] = useState<string[] | null>(null)
  const careTips = customCareTips ?? autoCareTips

  // 신체 상태 변경 감지 → 사용자가 편집한 내용이 있으면 확인 후 초기화
  const autoTipsKey = autoCareTips.join('|')
  const prevAutoKeyRef = useRef(autoTipsKey)
  useEffect(() => {
    if (prevAutoKeyRef.current === autoTipsKey) return
    prevAutoKeyRef.current = autoTipsKey
    if (customCareTips !== null) {
      const ok = window.confirm('케어팁을 다시 생성하면 수정한 내용이 초기화됩니다. 계속할까요?')
      if (ok) setCustomCareTips(null)
    }
  }, [autoTipsKey, customCareTips])

  function updateTip(i: number, val: string) {
    const base = customCareTips ?? autoCareTips
    const next = [...base]
    next[i] = val
    setCustomCareTips(next)
  }
  function removeTip(i: number) {
    const base = customCareTips ?? autoCareTips
    setCustomCareTips(base.filter((_, idx) => idx !== i))
  }
  function addTip() {
    const base = customCareTips ?? autoCareTips
    setCustomCareTips([...base, ''])
  }
  function resetTips() {
    setCustomCareTips(null)
  }

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
      const [gResult, pResult, prodResult, catResult] = await Promise.all([
        supabase.from('guardians').select('id, name, phone').order('name'),
        supabase.from('pets').select('id, guardian_id, name, breed').order('name'),
        supabase.from('products').select('id, name, brand, category, category_id').eq('is_active', true).order('name'),
        supabase.from('product_categories').select('id, name').eq('is_active', true),
      ])
      setGuardians(gResult.data || [])
      setPets(pResult.data || [])
      setAllProducts(prodResult.data || [])
      // 카테고리 이름 → id 맵 구축
      const map: Record<string, string> = {}
      for (const c of catResult.data ?? []) {
        if (c?.name && c?.id) map[String(c.name)] = String(c.id)
      }
      setCategoryNameToId(map)
    }
    load()
  }, [])

  // ─── 검색 (보호자 + 반려견 동시) ───
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return }
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      const q = searchQuery.trim()
      // 보호자명/반려견명 각각 매칭 후, 매칭된 보호자의 반려견 전체 + 매칭된 반려견 결합
      const [gRes, pRes] = await Promise.all([
        supabase.from('guardians').select('id, name, phone').ilike('name', `%${q}%`).limit(10),
        supabase.from('pets').select('id, guardian_id, name, breed').ilike('name', `%${q}%`).limit(10),
      ])

      // 보호자명 매칭 시 해당 보호자의 모든 반려견을 포함
      const matchedGuardianIds = (gRes.data ?? []).map((g) => g.id)
      let petsByGuardian: typeof pRes.data = []
      if (matchedGuardianIds.length > 0) {
        const extra = await supabase
          .from('pets')
          .select('id, guardian_id, name, breed')
          .in('guardian_id', matchedGuardianIds)
          .limit(30)
        petsByGuardian = extra.data ?? []
      }

      const guardianMap: Record<string, { id: string; name: string; phone: string | null }> = {}
      for (const g of gRes.data ?? []) guardianMap[g.id] = g
      for (const g of guardians) if (!guardianMap[g.id]) guardianMap[g.id] = g

      // 반려견 기반 결과 구성 (중복 제거)
      const seen = new Set<string>()
      const results: typeof searchResults = []
      for (const p of [...(pRes.data ?? []), ...(petsByGuardian ?? [])]) {
        if (!p?.id || seen.has(p.id)) continue
        seen.add(p.id)
        const g = p.guardian_id ? guardianMap[p.guardian_id] : null
        if (!g) continue
        results.push({
          petId: p.id,
          petName: p.name ?? '',
          breed: p.breed ?? null,
          guardianId: g.id,
          guardianName: g.name ?? '',
          guardianPhone: g.phone ?? null,
        })
      }

      // 보호자만 매칭되고 반려견 없는 경우도 한 줄 남기기 (pet 없음 표시)
      for (const g of gRes.data ?? []) {
        const hasPet = results.some((r) => r.guardianId === g.id)
        if (!hasPet) {
          results.push({
            petId: '',
            petName: '',
            breed: null,
            guardianId: g.id,
            guardianName: g.name ?? '',
            guardianPhone: g.phone ?? null,
          })
        }
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

  // ─── 반려견 선택 → 이름 자동완성 + 이전 미용 스타일 불러오기 ───
  const petAutoFilled = useRef(false)
  useEffect(() => {
    const p = pets.find((p) => p.id === petId)
    if (p) {
      setPetName(p.name ?? '')
      petAutoFilled.current = true
    }
    // 이전 방문 기록에서 grooming_style 자동 채우기
    if (petId) {
      (async () => {
        const { data } = await supabase
          .from('visit_records')
          .select('grooming_style, weight')
          .eq('pet_id', petId)
          .order('visit_date', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (data?.grooming_style && typeof data.grooming_style === 'object') {
          const gs = data.grooming_style as Record<string, string>
          const filled = { face: gs.face ?? '', body: gs.body ?? '', legs: gs.legs ?? '', tail: gs.tail ?? '', sanitary: gs.sanitary ?? '' }
          if (Object.values(filled).some((v) => v)) {
            setGroomingStyle(filled)
            setGroomingPrefilled(true)
          }
        }
        // 몸무게도 이전 값 프리필 (사용자가 이미 입력했으면 유지)
        if (data?.weight) {
          console.log('setWeight 호출:', String(data.weight), '호출 위치:', '프리필')
          setWeight((prev) => prev || String(data.weight))
        }
      })()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId, pets])

  // ─────────────────────────────────────────────
  // 임시저장 (localStorage)
  // ─────────────────────────────────────────────
  const DRAFT_KEY = 'dazul_care_draft'
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null)
  const [draftAvailable, setDraftAvailable] = useState(false)
  const [showRestoreBanner, setShowRestoreBanner] = useState(false)
  const [manualDraftMessage, setManualDraftMessage] = useState('')
  const draftInitialLoadRef = useRef(false)
  const draftHydratingRef = useRef(false)

  function collectDraftState() {
    return {
      // 고객
      guardianId, petId, petName, guardianName, guardianPhone,
      sessionDate, weight,
      // 서비스
      mainService, spaLevel, styleNotes,
      groomingStyle, groomingPrefilled,
      // 제품
      selectedProductIds, productSearches, focusedCat,
      // 신체 상태
      skin, skinMemos, tangles, tangleMemos,
      eyes, eyeMemos, ears, earMemos,
      teeth, teethMemos, nails, nailMemos,
      teethStatus, teethMemo, nailStatus,
      // 메모
      internalMemo, comment, needsFollowUp, followUpDate,
      // 다음 방문
      nextVisitOption, nextVisitDate, nextVisitCustom,
      // 커스텀 팁
      customCareTips,
    }
  }

  function persistDraftToStorage() {
    if (typeof window === 'undefined') return
    try {
      const payload = {
        savedAt: new Date().toISOString(),
        state: collectDraftState(),
      }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
      setDraftSavedAt(new Date(payload.savedAt))
    } catch (e) {
      console.warn('draft save failed:', e)
    }
  }

  function clearDraftFromStorage() {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(DRAFT_KEY)
      setDraftSavedAt(null)
      setDraftAvailable(false)
      setShowRestoreBanner(false)
    } catch {
      /* ignore */
    }
  }

  // 페이지 접속 시 기존 draft 감지
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (draftInitialLoadRef.current) return
    draftInitialLoadRef.current = true
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed?.state) {
        setDraftAvailable(true)
        setShowRestoreBanner(true)
      }
    } catch {
      /* ignore */
    }
  }, [])

  function restoreDraft() {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      const s = parsed?.state
      if (!s) return
      draftHydratingRef.current = true

      if (typeof s.guardianId === 'string') setGuardianId(s.guardianId)
      if (typeof s.petId === 'string') setPetId(s.petId)
      if (typeof s.petName === 'string') setPetName(s.petName)
      if (typeof s.guardianName === 'string') setGuardianName(s.guardianName)
      if (typeof s.guardianPhone === 'string') setGuardianPhone(s.guardianPhone)
      if (typeof s.sessionDate === 'string') setSessionDate(s.sessionDate)
      if (typeof s.weight === 'string') {
        console.log('setWeight 호출:', s.weight, '호출 위치:', '임시저장복원')
        setWeight(s.weight)
      }
      if (typeof s.mainService === 'string') setMainService(s.mainService)
      if (s.spaLevel === null || typeof s.spaLevel === 'string') setSpaLevel(s.spaLevel as SpaLevel)
      if (typeof s.styleNotes === 'string') setStyleNotes(s.styleNotes)
      if (s.groomingStyle && typeof s.groomingStyle === 'object') setGroomingStyle(s.groomingStyle)
      if (typeof s.groomingPrefilled === 'boolean') setGroomingPrefilled(s.groomingPrefilled)
      if (Array.isArray(s.selectedProductIds)) setSelectedProductIds(s.selectedProductIds)
      if (s.productSearches && typeof s.productSearches === 'object') setProductSearches(s.productSearches)
      if (s.focusedCat === null || typeof s.focusedCat === 'string') setFocusedCat(s.focusedCat)
      if (Array.isArray(s.skin)) setSkin(s.skin)
      if (s.skinMemos && typeof s.skinMemos === 'object') setSkinMemos(s.skinMemos)
      if (Array.isArray(s.tangles)) setTangles(s.tangles)
      if (s.tangleMemos && typeof s.tangleMemos === 'object') setTangleMemos(s.tangleMemos)
      if (Array.isArray(s.eyes)) setEyes(s.eyes)
      if (s.eyeMemos && typeof s.eyeMemos === 'object') setEyeMemos(s.eyeMemos)
      if (Array.isArray(s.ears)) setEars(s.ears)
      if (s.earMemos && typeof s.earMemos === 'object') setEarMemos(s.earMemos)
      if (Array.isArray(s.teeth)) setTeeth(s.teeth)
      if (s.teethMemos && typeof s.teethMemos === 'object') setTeethMemos(s.teethMemos)
      if (Array.isArray(s.nails)) setNails(s.nails)
      if (s.nailMemos && typeof s.nailMemos === 'object') setNailMemos(s.nailMemos)
      // teethStatus / teethMemo / nailStatus 는 teeth/teethMemos/nails 에서 파생되므로
      // 별도 복원이 필요 없음
      if (typeof s.internalMemo === 'string') setInternalMemo(s.internalMemo)
      if (typeof s.comment === 'string') setComment(s.comment)
      if (typeof s.needsFollowUp === 'boolean') setNeedsFollowUp(s.needsFollowUp)
      if (typeof s.followUpDate === 'string') setFollowUpDate(s.followUpDate)
      if (typeof s.nextVisitOption === 'string') setNextVisitOption(s.nextVisitOption)
      if (typeof s.nextVisitDate === 'string') setNextVisitDate(s.nextVisitDate)
      if (typeof s.nextVisitCustom === 'string') setNextVisitCustom(s.nextVisitCustom)
      if (s.customCareTips === null || Array.isArray(s.customCareTips)) setCustomCareTips(s.customCareTips)

      if (parsed.savedAt) setDraftSavedAt(new Date(parsed.savedAt))
      setShowRestoreBanner(false)
      // 일시적으로 hydrating 플래그 유지 (자동저장 중복 방지)
      setTimeout(() => { draftHydratingRef.current = false }, 500)
    } catch (e) {
      console.warn('draft restore failed:', e)
      draftHydratingRef.current = false
    }
  }

  // 자동 저장 (30초)
  useEffect(() => {
    const interval = setInterval(() => {
      if (draftHydratingRef.current) return
      // 완전히 비어있는 폼은 저장하지 않음
      const hasAnyInput =
        !!petId || !!guardianId ||
        !!mainService || !!spaLevel ||
        !!weight || !!internalMemo || !!comment ||
        skin.length > 0 || tangles.length > 0 ||
        selectedProductIds.length > 0
      if (!hasAnyInput) return
      persistDraftToStorage()
    }, 30000)
    return () => clearInterval(interval)
  // 의존성: 상태값 전부를 걸면 불필요한 재생성이 많으므로
  // interval 내부에서 항상 최신 state 스냅샷을 사용
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleManualDraftSave() {
    persistDraftToStorage()
    setManualDraftMessage('저장됨 ✓')
    setTimeout(() => setManualDraftMessage(''), 1500)
  }

  function formatDraftTime(d: Date) {
    const h = d.getHours()
    const m = String(d.getMinutes()).padStart(2, '0')
    const period = h < 12 ? '오전' : '오후'
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${period} ${hour12}:${m}`
  }

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

        // 정상값(없음/깨끗함/적당함 등)도 null로 치환하지 않고 그대로 저장
        // 미선택(배열 길이 0)일 때만 null / 빈 문자열 반환
        const skinStr = skin.length > 0 ? fmtItems(skin, skinMemos) : null
        const coatStr = tangles.length > 0
          ? `엉킴: ${fmtItems(tangles, tangleMemos)}`
          : null
        const teethStr = teeth.length > 0
          ? `치아: ${fmtItems(teeth, teethMemos)}`
          : ''
        const nailStr = nails.length > 0
          ? `발톱: ${fmtItems(nails, nailMemos)}`
          : ''
        const conditionStr = [
          eyes.length > 0 ? `눈: ${fmtItems(eyes, eyeMemos)}` : '',
          ears.length > 0 ? `귀: ${fmtItems(ears, earMemos)}` : '',
          teethStr,
          nailStr,
        ]
          .filter(Boolean)
          .join(' / ') || null

        // 메모 합치기
        const specialStr = internalMemo.trim() || null

        // 다음 방문 추천
        const nextRecommendation =
          nextVisitDate
            ? `${nextVisitOption === 'custom' ? nextVisitCustom || '직접 지정' : nextVisitOption} 후 (${nextVisitDate})`
            : null

        // 건강 요약 → note 필드에 저장 (healthPreview + comment 합산)
        const noteField = [healthPreview, comment].filter(Boolean).join('\n\n---\n\n') || null

        // 케어 팁 → next_care_guide 필드에 저장 (빈 줄 제외)
        const careTipsCleaned = careTips.map((t) => t.trim()).filter(Boolean)
        const careTipsStr = careTipsCleaned.length > 0 ? careTipsCleaned.join('\n') : null

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
          grooming_style: Object.values(groomingStyle).some((v) => v.trim())
            ? groomingStyle
            : null,
          care_actions: selectedProductIds.length > 0
            ? allProducts.filter((p) => selectedProductIds.includes(p.id)).map((p) => `${p.name}${p.brand ? ` (${p.brand})` : ''}`).join(', ')
            : null,
          care_notes: null,
          next_care_guide: careTipsStr,
          note: noteField,
          spa_level: spaLevel || null,
          next_visit_date: nextVisitDate || null,
          comment: comment.trim() || null,
          weight: weight.trim() ? (Number.isFinite(parseFloat(weight)) ? parseFloat(weight) : null) : null,
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

        // 공유 링크 — 항상 절대 URL 보장
        let shareUrl = ''
        if (guardianId) {
          try {
            const { data: gData } = await supabase.from('guardians').select('share_token').eq('id', guardianId).maybeSingle()
            if (gData?.share_token) {
              const built = buildSiteUrl(`/report/${gData.share_token}`)
              // buildSiteUrl 이 상대 경로를 반환한 경우(env 미설정 + SSR) 브라우저 origin으로 보강
              shareUrl = /^https?:\/\//.test(built)
                ? built
                : typeof window !== 'undefined'
                  ? `${window.location.origin}${built.startsWith('/') ? built : `/${built}`}`
                  : built
            }
          } catch {
            /* ignore */
          }
        }

        setSavedShareUrl(shareUrl)
        setSavedPetId(petId)
        setShowModal(true)
        // 저장 성공 시 임시저장 제거
        clearDraftFromStorage()
      } catch {
        setError('저장 중 예상치 못한 오류가 발생했습니다.')
      } finally {
        savingRef.current = false
      }
    })
  }

  const inputCls =
    'w-full border-b border-[#D0D0D0] bg-transparent px-0 py-2.5 text-sm text-[#0A0A0A] outline-none transition-all duration-300 placeholder:text-[#D0D0D0] focus:border-[#0A0A0A]'

  return (
    <div className="min-h-screen bg-white">
      {/* 저장 완료 모달 */}
      {showModal && <CompleteModal shareUrl={savedShareUrl} petId={savedPetId} onClose={() => setShowModal(false)} />}

      {/* 상단 네비바 */}
      <nav className="border-b border-[#E8E8E8] bg-white">
        <div className="mx-auto flex max-w-[720px] items-center justify-between px-6 py-4">
          <span className="text-[13px] font-light tracking-[0.2em] text-[#0A0A0A]">DAZUL</span>
          <Link
            href="/admin/records"
            className="text-[11px] font-light tracking-[0.05em] text-[#6B6B6B] transition-colors duration-300 hover:text-[#0A0A0A]"
          >
            ← 케어 기록
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-[720px] space-y-8 px-6 py-10">
      {/* 페이지 타이틀 */}
      <div>
        <h1 className="text-[28px] font-light tracking-[0.05em] text-[#0A0A0A]">케어 기록 작성</h1>
        <p className="mt-2 text-[12px] font-light text-[#6B6B6B]">
          방문 기록과 신체 상태를 입력합니다
        </p>
      </div>

      {/* 임시저장 복원 배너 */}
      {showRestoreBanner && draftAvailable && (
        <div
          className="flex flex-wrap items-center justify-between gap-3"
          style={{
            background: '#FDFBF7',
            border: '1px solid #C9A96E',
            padding: '12px 16px',
            fontSize: 12,
            color: '#1A1A1A',
          }}
        >
          <span>이전에 작성하던 내용이 있어요. 불러올까요?</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={restoreDraft}
              style={{
                background: '#0A0A0A',
                color: '#FFFFFF',
                border: 'none',
                padding: '6px 14px',
                fontSize: 11,
                letterSpacing: '0.1em',
                cursor: 'pointer',
              }}
            >
              불러오기
            </button>
            <button
              type="button"
              onClick={clearDraftFromStorage}
              style={{
                background: '#FFFFFF',
                color: '#8A8A7A',
                border: '1px solid #E8E5E0',
                padding: '6px 14px',
                fontSize: 11,
                letterSpacing: '0.1em',
                cursor: 'pointer',
              }}
            >
              삭제
            </button>
          </div>
        </div>
      )}

      {/* 임시저장 시각 표시 */}
      {draftSavedAt && !showRestoreBanner && (
        <p style={{ fontSize: 11, color: '#8A8A7A', marginTop: -8 }}>
          {manualDraftMessage || `임시저장됨 ${formatDraftTime(draftSavedAt)}`}
        </p>
      )}

      <div className="flex flex-col gap-5">
          {/* ① 고객 검색 */}
          <Card>
            <SectionHeader title="고객 검색" sub="보호자 또는 반려견 이름으로 검색" />
            <div className="flex flex-col gap-5">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  {...imeHandlers(composingRef, (v) => {
                    setSearchQuery(v)
                    setShowSearchResults(true)
                  })}
                  onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                  placeholder="보호자 또는 반려견 이름 검색..."
                  className={inputCls}
                />
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-lg">
                    {searchResults.map((r, i) => (
                      <button
                        key={`${r.guardianId}-${r.petId || 'no-pet'}-${i}`}
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-amber-50"
                        onClick={() => {
                          setGuardianId(r.guardianId)
                          setGuardianName(r.guardianName)
                          setGuardianPhone(r.guardianPhone ?? '')
                          if (r.petId) {
                            setPetId(r.petId)
                            setPetName(r.petName)
                          } else {
                            setPetId('')
                            setPetName('')
                          }
                          setSearchQuery('')
                          setShowSearchResults(false)
                        }}
                      >
                        <div>
                          <p className="text-sm">
                            <span style={{ fontWeight: 500, color: '#1A1A1A' }}>{r.guardianName || '이름 없음'}</span>
                            {r.petName && (
                              <>
                                <span style={{ color: '#1A1A1A' }}>{' · '}{r.petName}</span>
                                {r.breed && (
                                  <span style={{ fontSize: 11, color: '#8A8A7A', marginLeft: 4 }}>({r.breed})</span>
                                )}
                              </>
                            )}
                            {!r.petName && (
                              <span style={{ fontSize: 11, color: '#8A8A7A', marginLeft: 4 }}>(반려견 없음)</span>
                            )}
                          </p>
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
              <Field label="몸무게 (kg)">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={weight}
                  onChange={(e) => {
                    console.log('setWeight 호출:', e.target.value, '호출 위치:', '사용자입력')
                    setWeight(e.target.value)
                  }}
                  placeholder="0.0"
                  className={inputCls}
                />
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
                          ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                          : 'border-[#D0D0D0] text-[#6B6B6B] hover:border-[#0A0A0A]'
                      }`}
                    >
                      {svc}
                    </button>
                  ))}
                </div>
              </Field>

              {/* 케어코스 */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-stone-500">✨ 케어코스</label>
                <div className={`rounded-2xl border-2 p-4 transition-all ${spaLevel ? 'border-amber-400 bg-amber-50' : 'border-stone-200 bg-stone-50'}`}>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-stone-700">케어코스</p>
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

              {/* 사용 제품 (카테고리별 검색 + 선택 배지) */}
              <div>
                <label className="mb-3 block text-sm font-semibold text-stone-500">사용 제품</label>
                <div className="space-y-3">
                  {visibleCategories.map((cat) => {
                    const q = productSearches[cat] ?? ''
                    const isOpen = focusedCat === cat || q.length > 0
                    // 이 카테고리에 속한 모든 후보 (검색 필터링 포함)
                    const allInCat = getProductsForCategory(cat)
                    // 드롭다운엔 미선택 제품만
                    const results = isOpen ? allInCat.filter((p) => !selectedProductIds.includes(p.id)) : []
                    // 이 카테고리에서 현재 선택된 제품 목록
                    const selectedInCat = selectedProductIds
                      .map((id) => allProducts.find((p) => p.id === id))
                      .filter((p): p is NonNullable<typeof p> => {
                        if (!p) return false
                        const targetId = categoryNameToId[cat] ?? null
                        if (cat === '기타') {
                          const knownIds = ALL_PRODUCT_CATEGORIES
                            .filter((c) => c !== '기타')
                            .map((c) => categoryNameToId[c])
                            .filter((v): v is string => !!v)
                          return targetId
                            ? p.category_id === targetId
                            : !p.category_id || !knownIds.includes(p.category_id)
                        }
                        return !!targetId && p.category_id === targetId
                      })
                    const isBonus = SPA_BONUS_CATEGORIES.includes(cat as typeof SPA_BONUS_CATEGORIES[number])
                    return (
                      <div key={cat} style={{
                        borderLeft: isBonus ? '2px solid #C9A96E' : 'none',
                        paddingLeft: isBonus ? 12 : 0,
                        background: isBonus ? '#FFFDF7' : 'transparent',
                        padding: isBonus ? '8px 12px' : '0',
                        marginBottom: isBonus ? 4 : 0,
                        opacity: 1,
                        transition: 'opacity 0.2s ease, transform 0.2s ease',
                      }}>
                        <div className="flex items-start gap-3">
                          <span className={`mt-2 flex w-20 shrink-0 items-center gap-1.5 text-xs font-bold ${isBonus ? 'text-[#C9A96E]' : 'text-[#6B6B6B]'}`}>
                            {cat}
                            {isBonus && (
                              <span style={{ background: '#C9A96E', color: '#FFFFFF', fontSize: 10, padding: '1px 5px', fontWeight: 500 }}>추천</span>
                            )}
                          </span>
                          <div className="relative flex flex-1 flex-wrap items-center gap-1.5">
                            {/* 선택된 배지 (인라인) */}
                            {selectedInCat.map((p) => (
                              <span
                                key={p.id}
                                style={{
                                  background: '#F4F4F4',
                                  border: '1px solid #E8E5E0',
                                  borderRadius: 0,
                                  fontSize: 12,
                                  padding: '4px 10px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  color: '#1A1A1A',
                                }}
                              >
                                {p.name}{p.brand ? ` · ${p.brand}` : ''}
                                <button
                                  type="button"
                                  onClick={() => toggleProduct(p.id)}
                                  style={{ color: '#8A8A7A', fontSize: 12, lineHeight: 1 }}
                                  aria-label={`${p.name} 제거`}
                                >
                                  ✕
                                </button>
                              </span>
                            ))}
                            <div className="relative" style={{ flex: 1, minWidth: 140 }}>
                              <input
                                type="text"
                                value={q}
                                {...imeHandlers(composingRef, (v) => setProductSearch(cat, v))}
                                onFocus={() => setFocusedCat(cat)}
                                onBlur={() => setTimeout(() => setFocusedCat((cur) => (cur === cat ? null : cur)), 150)}
                                placeholder={selectedInCat.length > 0 ? '추가 검색...' : `${cat} 검색 또는 클릭`}
                                className={inputCls}
                              />
                              {/* 검색 결과 / 전체 목록 드롭다운 */}
                              {isOpen && results.length > 0 && (
                                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto border border-[#E8E8E8] bg-white shadow-sm">
                                  {results.map((p) => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => {
                                        toggleProduct(p.id)
                                        setProductSearch(cat, '')
                                        setFocusedCat(null)
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-stone-700 transition-colors hover:bg-stone-50"
                                    >
                                      <span className="font-medium">{p.name}</span>
                                      {p.brand && <span className="text-stone-400">· {p.brand}</span>}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {isOpen && results.length === 0 && (
                                <div className="absolute left-0 right-0 top-full z-10 mt-1 border border-[#E8E8E8] bg-white px-3 py-3 text-center text-xs text-stone-400">
                                  {q.length > 0
                                    ? '검색 결과 없음'
                                    : allInCat.length > 0
                                      ? '모두 선택됨'
                                      : '등록된 제품이 없습니다'}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* 스타일 메모 삭제됨 — 미용 스타일 5개 input으로 대체 */}
            </div>
          </Card>

          {/* ③-b 미용 스타일 (목욕관리에서도 얼굴컷/라인정리 가능) */}
          {mainService && (
            <Card>
              <SectionHeader title="GROOMING STYLE" sub="스타일 컷 상세를 입력해주세요" />
              <div className="flex flex-col gap-4">
                {groomingPrefilled && (
                  <p style={{ fontSize: 11, color: '#C9A96E', letterSpacing: '0.02em' }}>
                    이전 방문 기록을 불러왔어요. 변경사항만 수정해주세요.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {([
                    { key: 'face' as const, label: '얼굴', ph: '9mm, 곰돌이컷' },
                    { key: 'body' as const, label: '몸', ph: '7mm, 풀컷' },
                    { key: 'legs' as const, label: '다리', ph: '자연스럽게' },
                    { key: 'tail' as const, label: '꼬리', ph: '' },
                  ]).map((item) => (
                    <div key={item.key}>
                      <label className="mb-1.5 block text-[11px] font-light uppercase tracking-[0.1em] text-[#6B6B6B]">{item.label}</label>
                      <input
                        type="text"
                        value={groomingStyle[item.key]}
                        {...imeHandlers(composingRef, (v) => setGS(item.key, v))}
                        placeholder={item.ph}
                        className="w-full bg-transparent px-0 py-2 text-sm outline-none transition-all duration-300"
                        style={{
                          borderBottom: `1px solid ${groomingPrefilled && groomingStyle[item.key] ? '#C9A96E' : '#D0D0D0'}`,
                          color: groomingPrefilled && groomingStyle[item.key] ? '#6B6B6B' : '#0A0A0A',
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-light uppercase tracking-[0.1em] text-[#6B6B6B]">위생</label>
                  <input
                    type="text"
                    value={groomingStyle.sanitary}
                    {...imeHandlers(composingRef, (v) => setGS('sanitary', v))}
                    placeholder="클리핑, 가위컷"
                    className="w-full bg-transparent px-0 py-2 text-sm outline-none transition-all duration-300"
                    style={{
                      borderBottom: `1px solid ${groomingPrefilled && groomingStyle.sanitary ? '#C9A96E' : '#D0D0D0'}`,
                      color: groomingPrefilled && groomingStyle.sanitary ? '#6B6B6B' : '#0A0A0A',
                    }}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* ④ 신체 상태 */}
          <Card>
            <SectionHeader title="신체 상태" sub="해당 항목을 모두 체크하세요" />
            <div className="">
              <BodyRow label="피부" options={SKIN_OPTIONS} selected={skin} onToggle={(val) => setSkin((prev) => toggleArr(prev, val))} memos={skinMemos} onMemoChange={updateMemo(setSkinMemos)} memoExclusions={['좋음']} />
              <BodyRow label="엉킴" options={TANGLE_OPTIONS} selected={tangles} onToggle={(val) => setTangles((prev) => toggleArr(prev, val, '없음'))} exclusive="없음" memos={tangleMemos} onMemoChange={updateMemo(setTangleMemos)} memoExclusions={['없음']} />
              <BodyRow label="눈" options={EYE_OPTIONS} selected={eyes} onToggle={(val) => setEyes((prev) => toggleArr(prev, val))} memos={eyeMemos} onMemoChange={updateMemo(setEyeMemos)} memoExclusions={['깨끗함']} />
              <BodyRow label="귀" options={EAR_OPTIONS} selected={ears} onToggle={(val) => setEars((prev) => toggleArr(prev, val))} memos={earMemos} onMemoChange={updateMemo(setEarMemos)} memoExclusions={['깨끗함']} />

              {/* 치아 */}
              <BodyRow label="치아" options={TEETH_OPTIONS} selected={teeth} onToggle={(val) => setTeeth((prev) => toggleArr(prev, val))} memos={teethMemos} onMemoChange={updateMemo(setTeethMemos)} memoExclusions={['깨끗함']} />

              {/* 발톱 */}
              <BodyRow label="발톱" options={NAIL_OPTIONS} selected={nails} onToggle={(val) => setNails((prev) => toggleArr(prev, val))} memos={nailMemos} onMemoChange={updateMemo(setNailMemos)} memoExclusions={['적당함']} />
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

          {/* ⑥ 메모 */}
          <Card>
            {/* 내부 메모 (비공개) */}
            <div style={{ background: '#FAFAFA' }}>
              <div className="flex items-center gap-2 px-5 pt-5 pb-2">
                <span className="text-base">🔒</span>
                <div>
                  <p className="text-[11px] font-light uppercase tracking-[0.15em] text-[#6B6B6B]">내부 메모</p>
                  <p className="text-[10px] text-[#6B6B6B]">보호자에게 공개되지 않습니다</p>
                </div>
              </div>
              <div className="px-5 pb-4">
                <textarea
                  value={internalMemo}
                  {...imeHandlers(composingRef, setInternalMemo)}
                  rows={4}
                  placeholder="미용 스타일, 특이사항, 내부 참고사항 등"
                  className="w-full resize-none border-b border-[#D0D0D0] bg-transparent px-0 py-2 text-sm text-[#0A0A0A] placeholder:text-[#D0D0D0] outline-none transition-all duration-300 focus:border-[#0A0A0A]"
                />
                {/* 추적 관찰 */}
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setNeedsFollowUp((p) => !p)}
                    className="flex items-center gap-2"
                  >
                    <span
                      className="flex h-[18px] w-[18px] shrink-0 items-center justify-center border-2 transition-all"
                      style={{
                        borderColor: needsFollowUp ? '#0A0A0A' : '#D0D0D0',
                        background: needsFollowUp ? '#0A0A0A' : 'transparent',
                      }}
                    >
                      {needsFollowUp && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className="text-xs text-[#6B6B6B]">추적 관찰 필요</span>
                  </button>
                  {needsFollowUp && (
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="border-b border-[#D0D0D0] bg-transparent px-0 py-1 text-xs text-[#0A0A0A] outline-none focus:border-[#0A0A0A]"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* 구분선 */}
            <div style={{ borderTop: '1px solid #E8E8E8' }} />

            {/* 보호자 전달 (공개) */}
            <div style={{ borderLeft: '2px solid #C9A96E' }}>
              <div className="flex items-center gap-2 px-5 pt-5 pb-2">
                <span className="text-base">🤍</span>
                <div>
                  <p className="text-[11px] font-light uppercase tracking-[0.15em]" style={{ color: '#C9A96E' }}>보호자 전달</p>
                  <p className="text-[10px]" style={{ color: '#C9A96E' }}>리포트에 공개됩니다</p>
                </div>
              </div>
              <div className="px-5 pb-5">
                <textarea
                  value={comment}
                  {...imeHandlers(composingRef, setComment)}
                  rows={4}
                  placeholder="보호자에게 전달할 내용을 입력하세요"
                  className="w-full resize-none border-b border-[#D0D0D0] bg-transparent px-0 py-2 text-sm text-[#0A0A0A] placeholder:text-[#D0D0D0] outline-none transition-all duration-300 focus:border-[#C9A96E]"
                />
                <p className="mt-2 text-right text-[10px] tracking-wide text-[#D0D0D0]">
                  소중한 가족을 믿고 맡겨주셔서 감사드리며, 앞으로도 최선을 다하겠습니다. — 살롱다즐
                </p>
              </div>
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
                        ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                        : 'border-[#D0D0D0] text-[#6B6B6B] hover:border-[#0A0A0A]'
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
                      ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                      : 'border-[#D0D0D0] text-[#6B6B6B] hover:border-[#0A0A0A]'
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
                    {...imeHandlers(composingRef, setNextVisitCustom)}
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

          {/* ⑧ 케어 팁 (편집 가능) */}
          <Card>
            <SectionHeader
              title="케어 팁"
              sub={
                customCareTips !== null
                  ? '수정됨 · next_care_guide에 저장'
                  : '서비스 + 신체 상태에서 자동 생성됩니다'
              }
            />
            <div>
              {careTips.length === 0 && (
                <p className="text-xs" style={{ color: '#8A8A7A' }}>
                  아직 생성된 케어 팁이 없습니다. 신체 상태를 체크하거나 아래 버튼으로 직접 추가해주세요.
                </p>
              )}
              <ul className="flex flex-col gap-2">
                {careTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 py-1" style={{ borderBottom: '1px solid #F0EDE8' }}>
                    <span className="mt-2 shrink-0" style={{ color: '#C9A96E' }}>—</span>
                    <textarea
                      value={tip}
                      {...imeHandlers(composingRef, (v) => updateTip(i, v))}
                      rows={2}
                      className="flex-1 resize-none py-2 text-sm outline-none"
                      style={{
                        background: 'transparent',
                        borderBottom: '1px solid #D0D0D0',
                        color: '#0A0A0A',
                        lineHeight: 1.5,
                      }}
                      placeholder="케어 팁을 입력하세요"
                    />
                    <button
                      type="button"
                      onClick={() => removeTip(i)}
                      className="mt-1 shrink-0 px-2 py-1"
                      style={{ color: '#8A8A7A', fontSize: 11 }}
                      aria-label="팁 삭제"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={addTip}
                  style={{
                    color: '#C9A96E',
                    fontSize: 11,
                    letterSpacing: '0.1em',
                    background: 'none',
                    border: 'none',
                    padding: '4px 0',
                  }}
                >
                  + 팁 추가
                </button>
                {customCareTips !== null && (
                  <button
                    type="button"
                    onClick={resetTips}
                    style={{
                      color: '#8A8A7A',
                      fontSize: 11,
                      letterSpacing: '0.1em',
                      background: 'none',
                      border: 'none',
                      padding: '4px 0',
                    }}
                  >
                    자동 생성으로 초기화
                  </button>
                )}
              </div>
              <p className="mt-3 text-xs" style={{ color: '#8A8A7A' }}>
                * 저장 시 next_care_guide 필드에 줄바꿈으로 저장됩니다.
              </p>
            </div>
          </Card>

          {/* (보호자 전달 메시지는 ⑥ 메모 섹션에 통합됨) */}
        </div>

      {/* 저장 */}
      <div className="mt-4 space-y-4 border-t border-[#E8E8E8] pt-8">
          {/* 상태 요약 */}
          <div className="flex min-h-[24px] flex-wrap items-center gap-2">
            {petName ? (
              <span className="text-[11px] font-light text-[#0A0A0A]">🐾 {petName}</span>
            ) : (
              <span className="text-[11px] font-light text-red-500">반려견 미선택</span>
            )}
            {mainService && <span className="bg-[#0A0A0A] px-2 py-0.5 text-[10px] text-white">{mainService}</span>}
            {spaLevel && (
              <span className="border border-[#C9A96E]/30 bg-[#C9A96E]/5 px-2 py-0.5 text-[10px] text-[#C9A96E]">✨ {SPA_OPTIONS.find((s) => s.value === spaLevel)?.label}</span>
            )}
            {selectedProductIds.length > 0 && <span className="border border-[#E8E8E8] px-2 py-0.5 text-[10px] text-[#6B6B6B]">제품 {selectedProductIds.length}</span>}
          </div>

          {error && (
            <div className="flex items-center gap-2 border border-red-200 bg-red-50 px-3 py-2">
              <span className="flex-1 text-[12px] text-red-600">{error}</span>
              <button type="button" onClick={() => setError('')} className="text-red-300 hover:text-red-500">×</button>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleManualDraftSave}
              disabled={isPending}
              style={{
                flex: '0 0 auto',
                background: '#FFFFFF',
                color: '#8A8A7A',
                border: '1px solid #E8E5E0',
                padding: '14px 20px',
                fontSize: 11,
                letterSpacing: '0.1em',
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.5 : 1,
              }}
            >
              {manualDraftMessage || '임시저장'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 bg-[#0A0A0A] py-4 text-[11px] font-normal uppercase tracking-[0.1em] text-white transition-all duration-300 hover:bg-[#0A0A0A]/85 disabled:opacity-40"
            >
              {isPending ? '저장 중…' : '기록 저장'}
            </button>
          </div>
      </div>
      </div>
    </div>
  )
}
