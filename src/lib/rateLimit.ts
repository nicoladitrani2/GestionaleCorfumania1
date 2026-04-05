type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: number }
  | { allowed: false; remaining: 0; resetAt: number }

const buckets = new Map<string, { count: number; resetAt: number }>()

export function getClientIp(request: Request) {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || 'unknown'
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'unknown'
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt }
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt }
  }

  existing.count += 1
  buckets.set(key, existing)
  return { allowed: true, remaining: Math.max(0, limit - existing.count), resetAt: existing.resetAt }
}

export function addRateLimitHeaders(response: Response, result: RateLimitResult, limit: number) {
  try {
    response.headers.set('RateLimit-Limit', String(limit))
    response.headers.set('RateLimit-Remaining', String(result.remaining))
    response.headers.set('RateLimit-Reset', String(result.resetAt))
  } catch {
  }
  return response
}

