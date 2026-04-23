// 보호자 상세 페이지 로딩 스켈레톤
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

export default function GuardianDetailLoading() {
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <Bar w={120} h={12} className="mb-3" />
            <Bar w={200} h={28} />
          </div>
          <Bar w={48} h={22} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Bar w={80} h={36} />
          <Bar w={100} h={36} />
          <Bar w={90} h={36} />
          <Bar w={70} h={36} />
        </div>
      </div>

      {/* 3단 카드 그리드 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 기본 정보 */}
        <section className={`${BORDER} bg-white p-5`} style={{ borderRadius: 0 }}>
          <Bar w={64} h={10} className="mb-4" />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between gap-4 border-b border-[#F0EDE8] py-2">
                <Bar w={48} h={12} />
                <Bar w={100} h={14} />
              </div>
            ))}
          </div>
        </section>

        {/* 요약 카드 */}
        <section className={`${BORDER} bg-white p-5`} style={{ borderRadius: 0 }}>
          <Bar w={40} h={10} className="mb-4" />
          <div className="grid grid-cols-2 gap-3">
            <div className={`${BORDER} bg-[#FAFAF8] p-4`} style={{ borderRadius: 0 }}>
              <Bar w={48} h={10} className="mb-3" />
              <Bar w={40} h={24} />
            </div>
            <div className={`${BORDER} bg-[#FAFAF8] p-4`} style={{ borderRadius: 0 }}>
              <Bar w={60} h={10} className="mb-3" />
              <Bar w={50} h={24} />
            </div>
          </div>
        </section>

        {/* 공유 링크 */}
        <section className={`${BORDER} bg-white p-5`} style={{ borderRadius: 0 }}>
          <Bar w={100} h={10} className="mb-4" />
          <Bar w="100%" h={36} className="mb-3" />
          <Bar w={80} h={28} className="mb-3" />
          <Bar w="75%" h={10} />
        </section>
      </div>

      {/* 반려견 탭 영역 */}
      <section className="space-y-5">
        {/* 탭 */}
        <div
          style={{
            display: 'flex',
            gap: 24,
            borderBottom: '1px solid #E8E5E0',
            paddingBottom: 12,
          }}
        >
          <Bar w={48} h={14} />
          <Bar w={48} h={14} />
          <Bar w={48} h={14} />
        </div>

        {/* 반려견 카드 */}
        <div className={`${BORDER} bg-white p-5`} style={{ borderRadius: 0 }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Bar w={80} h={18} />
                <Bar w={40} h={10} />
              </div>
              <Bar w={240} h={12} />
              <Bar w={160} h={10} />
            </div>
            <Bar w={110} h={36} />
          </div>
        </div>

        {/* 케어 히스토리 테이블 자리 */}
        <div className={`${BORDER} bg-white p-5`} style={{ borderRadius: 0 }}>
          <Bar w={140} h={14} className="mb-4" />
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Bar key={i} w="100%" h={36} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
