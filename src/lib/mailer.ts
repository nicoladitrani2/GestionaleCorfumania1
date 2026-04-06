import nodemailer from 'nodemailer'

type MailAttachment = { filename: string; content: Buffer }

function normalizeEnvValue(value: string) {
  const trimmed = value.trim()
  const unquoted = trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed
  return unquoted
}

export async function sendMail(args: {
  to: string
  subject: string
  text: string
  attachments?: MailAttachment[]
}) {
  const allowSelfSigned = process.env.SMTP_ALLOW_SELF_SIGNED === 'true'

  let transporter: nodemailer.Transporter

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    const user = normalizeEnvValue(process.env.EMAIL_USER)
    const pass = normalizeEnvValue(process.env.EMAIL_PASS).replace(/\s+/g, '')
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: !allowSelfSigned,
      },
    })
  } else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const port = Number(process.env.SMTP_PORT) || 587
    const secure =
      process.env.SMTP_SECURE === 'true' ? true : process.env.SMTP_SECURE === 'false' ? false : port === 465
    transporter = nodemailer.createTransport({
      host: normalizeEnvValue(process.env.SMTP_HOST),
      port,
      secure,
      auth: {
        user: normalizeEnvValue(process.env.SMTP_USER),
        pass: normalizeEnvValue(process.env.SMTP_PASS),
      },
      tls: allowSelfSigned ? { rejectUnauthorized: false } : undefined,
    })
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP not configured')
    }
    const testAccount = await nodemailer.createTestAccount()
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    })
  }

  const from = process.env.MAIL_FROM || process.env.EMAIL_USER || process.env.SMTP_USER || 'no-reply@localhost'
  const info = await transporter.sendMail({
    from: normalizeEnvValue(from),
    to: args.to,
    subject: args.subject,
    text: args.text,
    attachments: args.attachments && args.attachments.length > 0 ? args.attachments : undefined,
  })

  const previewUrl = nodemailer.getTestMessageUrl(info)
  return { messageId: info.messageId, previewUrl }
}
