import { redirect } from 'next/navigation'

// 기존 /record/new → /admin/records/new 리디렉션
// 외부 링크나 북마크에서 접근 시 새 경로로 안내
export default function LegacyNewRecordRedirect() {
  redirect('/admin/records/new')
}
