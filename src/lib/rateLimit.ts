// 인메모리 IP 기반 레이트 리밋
// 서버리스 환경(콜드스타트마다 메모리 초기화)에선 완벽하지 않지만
// 기본적인 폭주 방어 용도로 충분
//
// TODO: Vercel KV/Upstash Redis 같은 영구 스토리지로 마이그레이션 시
//       프로세스 간 공유되는 카운터로 교체

type Bucket = { count: number; resetTime: number }

const buckets = new Map<string, Bucket>()

export function checkRateLimit(
  key: string,
  options: { limit?: number; windowMs?: number } = {}
): { allowed: boolean; remaining: number; resetIn: number } {
  const limit = options.limit ?? 10
  const windowMs = options.windowMs ?? 60_000
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now > bucket.resetTime) {
    buckets.set(key, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetIn: windowMs }
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetIn: bucket.resetTime - now }
  }

  bucket.count++
  return { allowed: true, remaining: limit - bucket.count, resetIn: bucket.resetTime - now }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}
