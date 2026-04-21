import { NextRequest, NextResponse } from 'next/server'

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
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY가 환경변수에 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const rawTexts = Array.isArray(body.texts) ? body.texts : []
    const texts: string[] = rawTexts
      .map((v: unknown) => (typeof v === 'string' ? v.trim() : ''))
      .filter((v: string) => v.length > 0)
    const targetLang = body.targetLang === 'ja' ? 'ja' : body.targetLang === 'en' ? 'en' : null

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

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system,
        messages: [
          {
            role: 'user',
            content: JSON.stringify(texts),
          },
        ],
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('Anthropic API error:', res.status, text)
      return NextResponse.json({ translations: texts }, { status: 200 })
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
      // 파싱 실패 시 원본 유지 (UI 보존)
      return NextResponse.json({ translations: texts })
    }

    const translations = parsed.map((v, i) => (typeof v === 'string' ? v : texts[i]))
    return NextResponse.json({ translations })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}
