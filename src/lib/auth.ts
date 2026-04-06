import { SignJWT, jwtVerify } from 'jose'

function getKey() {
  const fromEnv = process.env.JWT_SECRET
  if (fromEnv && fromEnv.trim()) return new TextEncoder().encode(fromEnv)
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Missing JWT_SECRET')
  }
  return new TextEncoder().encode('dev-jwt-secret-change-me')
}

function getSessionTtlSeconds() {
  const raw = process.env.SESSION_TTL_SECONDS
  const parsed = raw ? Number(raw) : NaN
  if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed)
  return 8 * 60 * 60
}

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${getSessionTtlSeconds()}s`)
    .sign(getKey())
}

export async function decrypt(input: string): Promise<any> {
  const { payload } = await jwtVerify(input, getKey(), {
    algorithms: ['HS256'],
  })
  return payload
}

export async function getSession() {
  const { cookies } = await import('next/headers')
  const session = (await cookies()).get('session')?.value
  if (!session) return null
  try {
    return await decrypt(session)
  } catch (error) {
    return null
  }
}
