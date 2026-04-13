import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        {/* 히어로 */}
        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-neutral-200">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-400">
            DAZUL OS
          </p>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-neutral-900">
            다줄 운영 시스템
          </h1>
          <p className="mt-3 text-sm leading-7 text-neutral-600">
            방문 기록, 건강 관리, 리포트 공유, 후속 케어까지.
            <br />
            반려견 살롱 운영에 필요한 모든 것을 한 곳에서 관리합니다.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              href="/admin"
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-colors hover:bg-neutral-700"
            >
              관리자 대시보드
            </Link>
            <Link
              href="/record/new"
              className="flex h-12 w-full items-center justify-center rounded-2xl border border-neutral-300 bg-white text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50"
            >
              방문 기록 작성
            </Link>
          </div>
        </section>

        {/* 기능 요약 */}
        <section className="grid grid-cols-2 gap-3">
          {[
            {
              title: '방문 기록',
              desc: '피부·모질·컨디션 기록과 케어 내용을 체계적으로 관리',
              href: '/admin/records',
            },
            {
              title: '리포트 공유',
              desc: '보호자에게 맞춤 케어 리포트를 링크 한 번으로 공유',
              href: '/admin/templates',
            },
            {
              title: '후속 관리',
              desc: '재방문·피부 체크·컨디션 체크 팔로업 자동 생성',
              href: '/admin/followups',
            },
            {
              title: '고객 관리',
              desc: '반려견과 보호자 정보를 한눈에 조회하고 관리',
              href: '/admin/pets',
            },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 transition-colors hover:bg-neutral-50"
            >
              <p className="text-sm font-bold text-neutral-900">{item.title}</p>
              <p className="mt-2 text-xs leading-5 text-neutral-500">{item.desc}</p>
            </Link>
          ))}
        </section>

        {/* 상태 */}
        <section className="rounded-2xl bg-white px-6 py-5 shadow-sm ring-1 ring-neutral-200">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              시스템 운영 중
            </span>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs leading-5 text-neutral-500">
            <li>관리자 대시보드 · 반려견 · 보호자 · 방문 기록 · 제품 관리</li>
            <li>리포트 초안 생성 · 공유 링크 · 후속 관리 자동화</li>
            <li>템플릿 관리 · 스태프 관리 · 설정</li>
          </ul>
        </section>

        {/* 푸터 */}
        <footer className="pb-4 text-center text-xs text-neutral-400">
          DAZUL · 반려견을 위한 프리미엄 케어
        </footer>
      </div>
    </main>
  )
}
