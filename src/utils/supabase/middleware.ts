import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // /admin/settlement/login, /admin/settlement/auth/* — 공개 (매직링크 흐름)
  if (
    pathname === '/admin/settlement/login' ||
    pathname.startsWith('/admin/settlement/auth/')
  ) {
    return supabaseResponse
  }

  // /admin/settlement/* — 미인증 시 /admin/settlement/login 으로
  if (pathname.startsWith('/admin/settlement') && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/settlement/login'
    return NextResponse.redirect(url)
  }

  // /admin/* — 로그인 필요
  if (pathname.startsWith('/admin') && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // / — 로그인 상태면 /admin/booking으로
  if (pathname === '/' && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/booking'
    return NextResponse.redirect(url)
  }

  // /admin (정확히) → /admin/booking
  if (pathname === '/admin' && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/booking'
    return NextResponse.redirect(url)
  }

  // /settlement/login, /settlement/auth/* — 공개 (통과)
  if (
    pathname === '/settlement/login' ||
    pathname.startsWith('/settlement/auth/')
  ) {
    return supabaseResponse
  }

  // /settlement/* — 로그인 필요 → /settlement/login으로
  if (pathname.startsWith('/settlement') && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/settlement/login'
    return NextResponse.redirect(url)
  }

  // /report/* — 공개 (통과)

  return supabaseResponse
}
