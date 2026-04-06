import { NextResponse } from 'next/server'
import { Buffer } from 'node:buffer'
import { getSession } from '@/lib/auth'
import { addRateLimitHeaders, getClientIp, rateLimit } from '@/lib/rateLimit'
import { enforceSameOrigin } from '@/lib/csrf'
import { sendMail } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const csrf = enforceSameOrigin(request)
  if (csrf) return csrf

  const ip = getClientIp(request)
  const rl = rateLimit(`email:send:ip:${ip}:user:${session.user.id}`, 60, 60 * 60 * 1000)
  if (!rl.allowed) {
    return addRateLimitHeaders(NextResponse.json({ error: 'Too Many Requests' }, { status: 429 }), rl, 60)
  }

  try {
    const contentType = request.headers.get('content-type') || ''

    let to: string | null = null
    let subject: string | null = null
    let text: string | null = null
    const attachments: { filename: string; content: Buffer }[] = []

    if (contentType.includes('application/json')) {
      const body = await request.json()
      to = body.to
      subject = body.subject
      text = body.text
    } else {
      const formData = await request.formData()
      to = (formData.get('to') as string) || null
      subject = (formData.get('subject') as string) || null
      text = (formData.get('text') as string) || null

      const files = formData.getAll('attachments') as File[]
      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer()
        attachments.push({
          filename: file.name,
          content: Buffer.from(arrayBuffer)
        })
      }
    }

    if (!to || !subject || !text) {
      return addRateLimitHeaders(NextResponse.json({ error: 'Parametri email mancanti' }, { status: 400 }), rl, 60)
    }

    const recipients = to
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (recipients.length === 0 || recipients.some(r => !emailRegex.test(r))) {
      return addRateLimitHeaders(NextResponse.json({ error: 'Destinatario email non valido' }, { status: 400 }), rl, 60)
    }

    const { messageId, previewUrl } = await sendMail({
      to,
      subject,
      text,
      attachments: attachments.length > 0 ? attachments : undefined,
    })

    const response = NextResponse.json({
      success: true,
      messageId,
      previewUrl
    })
    return addRateLimitHeaders(response, rl, 60)
  } catch (error) {
    console.error('Email send error:', error)
    const debug = process.env.EMAIL_DEBUG === 'true'
    const details = debug ? (error instanceof Error ? error.message : String(error)) : undefined
    return NextResponse.json({ error: 'Invio email fallito', details }, { status: 500 })
  }
}
