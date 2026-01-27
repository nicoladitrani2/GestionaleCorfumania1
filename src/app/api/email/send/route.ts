import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { getSession } from '@/lib/auth'

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { to, subject, text, html } = await request.json()

    if (!to || !subject || (!text && !html)) {
      return NextResponse.json(
        { error: 'Missing required fields (to, subject, text/html)' },
        { status: 400 }
      )
    }

    let transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    })

    // Verify connection configuration
    try {
      await transporter.verify()
      console.log("Server SMTP (465) pronto per l'invio")
    } catch (error) {
      console.error('Errore verifica SMTP su porta 465:', error)
      
      // Fallback to port 587
      console.log('Tentativo fallback su porta 587...')
      transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        tls: {
          rejectUnauthorized: false
        }
      })
      
      try {
        await transporter.verify()
        console.log("Server SMTP (587) pronto per l'invio")
      } catch (fallbackError) {
        console.error('Errore verifica SMTP anche su porta 587:', fallbackError)
        return NextResponse.json(
          { error: 'SMTP connection failed (Check Antivirus/Firewall)', details: error },
          { status: 500 }
        )
      }
    }

    const info = await transporter.sendMail({
      from: `"Corfumania" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html
    })

    console.log('Email inviata con successo:', info.messageId)

    return NextResponse.json({ success: true, messageId: info.messageId })
  } catch (error: any) {
    console.error('Error sending email:', error)
    return NextResponse.json(
      { error: 'Failed to send email', details: error.message },
      { status: 500 }
    )
  }
}
