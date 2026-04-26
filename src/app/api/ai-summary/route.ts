import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { checkRateLimit, clientIp } from '@/lib/rateLimit'

/**
 * POST /api/ai-summary
 * body: { productName: string, brand?: string, description?: string }
 * 응답: { summary: string } | { error: string }
 *
 * TODO: 역할 기반 인증 추가 필요 (로그인한 admin만 호출 가능)
 */
export async function POST(req: NextRequest) {
  try {
    // 레이트 리밋 (1분 10회) — 비용 보호
    const ip = clientIp(req)
    const rl = checkRateLimit(`ai-summary:${ip}`, { limit: 10, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } }
      )
    }

    // 인증 체크
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY가 환경변수에 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const productName = (body.productName ?? '').trim()
    const brand = (body.brand ?? '').trim()
    const description = (body.description ?? '').trim()

    if (!productName || !description) {
      return NextResponse.json(
        { error: '제품명과 설명이 필요합니다.' },
        { status: 400 }
      )
    }

    const prompt = `다음 반려견 케어 제품을 보호자가 이해하기 쉽게 한 줄로 요약해줘. 전문 용어는 쉽게 풀어서, 따뜻하고 신뢰감 있는 톤으로. 50자 이내로.

제품명: ${productName}
브랜드: ${brand || '(미입력)'}
설명: ${description}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('Anthropic API error:', res.status, text)
      return NextResponse.json(
        { error: `AI 요청 실패 (${res.status})` },
        { status: 500 }
      )
    }

    const data = await res.json()
    const summary =
      data?.content?.[0]?.type === 'text'
        ? String(data.content[0].text ?? '').trim()
        : ''

    if (!summary) {
      return NextResponse.json(
        { error: '요약을 생성하지 못했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ summary })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
