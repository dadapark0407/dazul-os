export function getStressColor(value?: string | null) {
  switch (value) {
    case '낮음':
      return '#d1fae5' // 연두
    case '보통':
      return '#fef3c7' // 노랑
    case '높음':
      return '#fee2e2' // 핑크
    case '초반 긴장 후 안정':
      return '#e0e7ff' // 보라톤
    default:
      return '#f3f4f6'
  }
}

export function getConditionColor(value?: string | null) {
  switch (value) {
    case '안정':
      return '#d1fae5'
    case '예민':
      return '#fee2e2'
    case '피곤':
      return '#e5e7eb'
    case '활발':
      return '#dbeafe'
    default:
      return '#f3f4f6'
  }
}