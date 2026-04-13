// TODO: 역할 기반 인증 추가 필요
// TODO: 템플릿 CRUD — templates 테이블 연동 후 구현
// TODO: 각 템플릿 카테고리별 실제 편집 UI 추가

const TEMPLATE_CATEGORIES = [
  {
    title: '리포트 템플릿',
    description: '보호자에게 공유하는 방문 리포트 양식',
    items: [
      '기본 방문 리포트',
      '웰니스 요약 리포트',
      'VIP 정기 리포트',
    ],
  },
  {
    title: '홈케어 템플릿',
    description: '보호자 전달용 홈케어 가이드 양식',
    items: [
      '피부 관리 홈케어',
      '모질 관리 홈케어',
      '시즌별 케어 가이드',
    ],
  },
  {
    title: '애프터케어 템플릿',
    description: '방문 후 안내 및 후속 관리 양식',
    items: [
      '방문 후 주의사항',
      '다음 방문 안내',
      '제품 사용 안내',
    ],
  },
]

export default function AdminTemplatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">템플릿 관리</h1>
        <p className="mt-1 text-sm text-neutral-500">
          리포트, 홈케어, 애프터케어 템플릿을 관리합니다
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-5 py-4">
        <p className="text-sm font-medium text-amber-800">
          템플릿 기능은 현재 준비 중입니다.
        </p>
        <p className="mt-1 text-xs text-amber-600">
          아래 구조를 기반으로 DB 테이블 연동 후 편집 기능이 추가될 예정입니다.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {TEMPLATE_CATEGORIES.map((category) => (
          <section
            key={category.title}
            className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200"
          >
            <h2 className="text-lg font-bold text-neutral-900">{category.title}</h2>
            <p className="mt-1 text-sm text-neutral-500">{category.description}</p>

            <ul className="mt-4 space-y-2">
              {category.items.map((item) => (
                <li
                  key={item}
                  className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3"
                >
                  <span className="text-sm font-medium text-neutral-700">{item}</span>
                  <span className="text-xs text-neutral-400">준비 중</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
