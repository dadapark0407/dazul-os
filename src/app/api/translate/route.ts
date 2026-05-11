import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { checkRateLimit, clientIp } from '@/lib/rateLimit'

/**
 * POST /api/translate
 * body: { texts: string[], targetLang: 'en' | 'ja' }
 * 응답: { translations: string[] }
 *
 * Anthropic API를 사용해 한국어 텍스트 배열을 영어/일본어로 번역.
 * 번역 실패 시 원본을 그대로 반환해 UI가 깨지지 않도록 함.
 */
export async function POST(req: NextRequest) {
  try {
    // 레이트 리밋 (1분 10회) — 비용 보호
    const ip = clientIp(req)
    const rl = checkRateLimit(`translate:${ip}`, { limit: 10, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } }
      )
    }

    const body = await req.json()

    // 입력 검증: 배열 + 최대 50개
    if (!Array.isArray(body.texts) || body.texts.length > 50) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    // 항목별 최대 1000자 제한 + trim + 빈 항목 제거
    const texts: string[] = body.texts
      .map((v: unknown) => (typeof v === 'string' ? v.slice(0, 1000).trim() : ''))
      .filter((v: string) => v.length > 0)
    const targetLang = body.targetLang === 'ja' ? 'ja' : body.targetLang === 'en' ? 'en' : null
    const token = typeof body.token === 'string' ? body.token.trim() : ''

    // 인증 체크: 로그인 사용자 OR 유효한 share_token 중 하나면 통과
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const { data: guardian } = await supabase
        .from('guardians')
        .select('id')
        .eq('share_token', token)
        .maybeSingle()
      if (!guardian) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY가 환경변수에 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    if (!targetLang) {
      return NextResponse.json({ error: 'targetLang must be "en" or "ja"' }, { status: 400 })
    }
    if (texts.length === 0) {
      return NextResponse.json({ translations: [] })
    }

    const langName = targetLang === 'ja' ? 'Japanese' : 'English'
    const system = `You are a professional translator for a premium pet wellness salon called Salon de Dazul.
Translate the following Korean texts to ${langName}.
Keep the warm, professional tone.
Return ONLY a JSON array of translated strings, nothing else.
Preserve any special characters, parentheses, and formatting.`

    const model = 'claude-haiku-4-5-20251001'
    const requestBody = JSON.stringify({
      model,
      max_tokens: 4000,
      system,
      messages: [
        {
          role: 'user',
          content: JSON.stringify(texts),
        },
      ],
    })

    console.log('[translate] anthropic request', {
      model,
      targetLang,
      textsCount: texts.length,
      requestSize: requestBody.length,
      sample: texts.slice(0, 3),
    })

    let res: Response
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: requestBody,
      })
    } catch (fetchErr) {
      console.error('[translate] fetch threw (network/DNS/timeout)', {
        name: fetchErr instanceof Error ? fetchErr.name : null,
        message: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
        cause: fetchErr instanceof Error ? (fetchErr as Error & { cause?: unknown }).cause : null,
        stack: fetchErr instanceof Error ? fetchErr.stack : null,
      })
      return NextResponse.json(
        { error: 'fetch to Anthropic failed', detail: fetchErr instanceof Error ? fetchErr.message : String(fetchErr) },
        { status: 502 }
      )
    }

    console.log('[translate] anthropic response', {
      status: res.status,
      ok: res.ok,
      requestId: res.headers.get('request-id'),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[translate] Anthropic API non-OK', {
        status: res.status,
        statusText: res.statusText,
        requestId: res.headers.get('request-id'),
        body: text,
        textsCount: texts.length,
        targetLang,
      })
      return NextResponse.json(
        { error: 'Anthropic API failed', status: res.status, detail: text.slice(0, 500) },
        { status: 502 }
      )
    }

    const data = await res.json()
    const raw = data?.content?.[0]?.type === 'text' ? String(data.content[0].text ?? '').trim() : ''

    let parsed: unknown = null
    try {
      // Claude가 가끔 ```json ... ``` 블록으로 감쌀 수 있으므로 안전하게 추출
      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw)
    } catch {
      parsed = null
    }

    if (!Array.isArray(parsed) || parsed.length !== texts.length) {
      console.error('[translate] parse/length mismatch', {
        rawSample: raw.slice(0, 200),
        parsedIsArray: Array.isArray(parsed),
        parsedLen: Array.isArray(parsed) ? parsed.length : null,
        expectedLen: texts.length,
      })
      return NextResponse.json(
        { error: 'translation parse failed' },
        { status: 502 }
      )
    }

    const translations = parsed.map((v, i) => (typeof v === 'string' ? v : texts[i]))
    return NextResponse.json({ translations })
  } catch (e) {
    console.error('[translate] unhandled error', {
      name: e instanceof Error ? e.name : null,
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : null,
    })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
