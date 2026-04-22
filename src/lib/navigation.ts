export type NavItem = {
  id: string
  label: string
  href: string
  icon: string
  hidden?: boolean
  category?: string
}

export const ALL_NAV_ITEMS: NavItem[] = [
  // ─── 메인 메뉴 (사이드바에 표시) ───
  { id: 'dashboard', label: '대시보드', href: '/admin', icon: 'LayoutDashboard', category: 'main' },
  { id: 'new-customer', label: '고객 등록', href: '/admin/customers/new', icon: 'UserPlus', category: 'main' },
  { id: 'pets', label: '반려견 관리', href: '/admin/pets', icon: 'PawPrint', hidden: true, category: 'main' },
  { id: 'guardians', label: '고객 관리', href: '/admin/guardians', icon: 'Users', category: 'main' },
  { id: 'records', label: '케어 기록', href: '/admin/records', icon: 'ClipboardList', category: 'main' },
  { id: 'products', label: '제품 관리', href: '/admin/products', icon: 'Package', category: 'main' },
  { id: 'followups', label: '후속 관리', href: '/admin/followups', icon: 'Bell', category: 'main' },
  { id: 'trash', label: '휴지통', href: '/admin/trash', icon: 'Trash2', category: 'main' },
  { id: 'settings', label: '설정', href: '/admin/settings', icon: 'Settings', category: 'main' },

  // ─── 숨겨진 항목 (hidden: true — 향후 활성화) ───
  { id: 'schedule', label: '예약 관리', href: '/admin/schedule', icon: 'Calendar', hidden: true, category: 'main' },
  { id: 'analytics', label: '통계 분석', href: '/admin/analytics', icon: 'BarChart2', hidden: true, category: 'analytics' },
  { id: 'inventory', label: '재고 관리', href: '/admin/inventory', icon: 'Package', hidden: true, category: 'management' },
  { id: 'staff', label: '직원 관리', href: '/admin/staff', icon: 'Users', hidden: true, category: 'management' },
  { id: 'billing', label: '정산 관리', href: '/admin/billing', icon: 'CreditCard', hidden: true, category: 'management' },
  { id: 'marketing', label: '마케팅', href: '/admin/marketing', icon: 'Megaphone', hidden: true, category: 'marketing' },
  { id: 'notifications', label: '알림 설정', href: '/admin/notifications', icon: 'Bell', hidden: true, category: 'settings' },
  { id: 'categories', label: '카테고리', href: '/admin/categories', icon: 'Tag', hidden: true, category: 'management' },
  { id: 'record-templates', label: '기록 양식', href: '/admin/record-templates', icon: 'FileText', hidden: true, category: 'settings' },
  { id: 'templates', label: '메시지 템플릿', href: '/admin/templates', icon: 'MessageSquare', hidden: true, category: 'settings' },
]

/** 사이드바/모바일 네비에 표시할 항목만 필터 */
export function getVisibleNavItems(): NavItem[] {
  return ALL_NAV_ITEMS.filter((item) => !item.hidden)
}
