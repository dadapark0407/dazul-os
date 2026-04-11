import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl flex-col justify-between gap-10">
        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
            DAZUL OS
          </p>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-gray-900">
            다줄 운영 시스템
          </h1>
          <p className="mt-3 text-sm leading-7 text-gray-600">
            방문 기록 작성과 리포트 공유를 한 곳에서 관리합니다.
          </p>

          <Link
            href="/record/new"
            className="mt-8 flex h-12 w-full items-center justify-center rounded-2xl bg-gray-900 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
          >
            방문 기록 작성
          </Link>
        </section>

        <section className="rounded-2xl border border-dashed border-gray-300 bg-white/60 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
            안내
          </p>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            기록 조회 페이지는 다음 단계에서 추가 예정입니다.
          </p>
        </section>
      </div>
    </main>
  )
}
