import { EncryptJWT, SignJWT, jwtDecrypt, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { createHash } from 'node:crypto'

function getKey() {
  const fromEnv = process.env.JWT_SECRET
  if (fromEnv && fromEnv.trim()) return new TextEncoder().encode(fromEnv)
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Missing JWT_SECRET')
  }
  return new TextEncoder().encode('dev-jwt-secret-change-me')
}

function getEncKey() {
  const fromEnv = process.env.JWT_SECRET
  if (fromEnv && fromEnv.trim()) {
    return createHash('sha256').update(fromEnv).digest()
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Missing JWT_SECRET')
  }
  return createHash('sha256').update('dev-jwt-secret-change-me').digest()
}

function getSessionTtlSeconds() {
  const raw = process.env.SESSION_TTL_SECONDS
  const parsed = raw ? Number(raw) : NaN
  if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed)
  return 8 * 60 * 60
}

export async function encrypt(payload: any) {
  return await new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${getSessionTtlSeconds()}s`)
    .encrypt(getEncKey())
}

export async function decrypt(input: string): Promise<any> {
  try {
    const { payload } = await jwtDecrypt(input, getEncKey())
    return payload
  } catch {
    const { payload } = await jwtVerify(input, getKey(), {
      algorithms: ['HS256'],
    })
    return payload
  }
}

export async function getSession() {
  const session = (await cookies()).get('session')?.value
  if (!session) return null
  try {
    return await decrypt(session)
  } catch (error) {
    return null
  }
}
