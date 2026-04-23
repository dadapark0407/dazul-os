// 보호자 목록 페이지 로딩 스켈레톤
// border-radius 0, 보더 #E8E5E0, 배경 #F5F5F5

const BAR = 'bg-[#F5F5F5] animate-pulse'
const BORDER = 'border border-[#E8E5E0]'

function Bar({ w, h = 14, className = '' }: { w: string | number; h?: number; className?: string }) {
  return (
    <div
      className={`${BAR} ${className}`}
      style={{
        width: typeof w === 'number' ? `${w}px` : w,
        height: h,
        borderRadius: 0,
      }}
    />
  )
}

export default function GuardiansListLoading() {
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Bar w={140} h={28} className="mb-2" />
          <Bar w={200} h={12} />
        </div>
        <Bar w={120} h={36} />
      </div>

      {/* 검색 / 필터 영역 */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Bar w="100%" h={40} className="flex-1" />
        <Bar w={140} h={40} />
      </div>

      {/* 테이블 */}
      <div className={`${BORDER} bg-white overflow-hidden`} style={{ borderRadius: 0 }}>
        {/* 헤더 행 */}
        <div
          className="grid gap-4 border-b border-[#E8E5E0] px-4 py-3"
          style={{ gridTemplateColumns: '2fr 1.2fr 0.8fr 1fr 1fr' }}
        >
          <Bar w={60} h={10} />
          <Bar w={60} h={10} />
          <Bar w={48} h={10} />
          <Bar w={72} h={10} />
          <Bar w={48} h={10} />
        </div>

        {/* 본문 행들 */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="grid items-center gap-4 border-b border-[#F0EDE8] px-4 py-4"
            style={{ gridTemplateColumns: '2fr 1.2fr 0.8fr 1fr 1fr' }}
          >
            <Bar w={80} h={14} />
            <Bar w={110} h={14} />
            <Bar w={32} h={22} />
            <Bar w={88} h={12} />
            <div className="flex justify-end gap-2">
              <Bar w={48} h={24} />
              <Bar w={32} h={24} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
