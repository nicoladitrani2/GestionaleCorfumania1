import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { Buffer } from 'node:buffer'
import { getSession } from '@/lib/auth'
import { addRateLimitHeaders, getClientIp, rateLimit } from '@/lib/rateLimit'
import { enforceSameOrigin } from '@/lib/csrf'

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

    const allowSelfSigned = process.env.NODE_ENV !== 'production' && process.env.SMTP_ALLOW_SELF_SIGNED === 'true'

    let transporter

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        tls: {
          rejectUnauthorized: !allowSelfSigned
        }
      })
    } else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: allowSelfSigned ? { rejectUnauthorized: false } : undefined
      })
    } else {
      const testAccount = await nodemailer.createTestAccount()
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      })
    }

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || 'no-reply@localhost',
      to,
      subject,
      text,
      attachments: attachments.length > 0 ? attachments : undefined
    })

    const previewUrl = nodemailer.getTestMessageUrl(info)

    const response = NextResponse.json({
      success: true,
      messageId: info.messageId,
      previewUrl
    })
    return addRateLimitHeaders(response, rl, 60)
  } catch (error) {
    console.error('Email send error:', error)
    return NextResponse.json({ error: 'Invio email fallito' }, { status: 500 })
  }
}
