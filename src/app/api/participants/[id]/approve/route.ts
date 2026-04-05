import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import nodemailer from 'nodemailer'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const { id } = params
  const body = await request.json().catch(() => ({} as any))
  const { status } = body || {}

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return NextResponse.json({ error: 'Stato non valido' }, { status: 400 })
  }

  try {
    const existing = await prisma.participant.findUnique({
      where: { id },
      include: {
        excursion: { select: { id: true, priceAdult: true, priceChild: true } },
        transfer: { select: { id: true, priceAdult: true, priceChild: true, maxParticipants: true, approvalStatus: true } },
        client: { select: { firstName: true, lastName: true, email: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Partecipante non trovato' }, { status: 404 })
    }

    let nextTotalPrice = existing.totalPrice
    let nextPaidAmount = existing.paidAmount
    let nextPaymentStatus = existing.paymentStatus

    if (status === 'REJECTED') {
      nextPaymentStatus = 'REJECTED'
    } else {
      if (existing.transfer && existing.transfer.approvalStatus !== 'APPROVED') {
        const rawPa = body?.transferPriceAdult
        const rawPc = body?.transferPriceChild
        const rawMp = body?.transferMaxParticipants

        if (rawPa === undefined || rawPc === undefined || rawMp === undefined) {
          return NextResponse.json(
            {
              error: 'Per approvare il trasferimento inserisci prezzo adulti, prezzo bambini e massimo partecipanti.',
              code: 'TRANSFER_APPROVAL_REQUIRED',
              transfer: existing.transfer,
            },
            { status: 409 }
          )
        }

        const pa = parseFloat(String(rawPa))
        const pc = parseFloat(String(rawPc))
        const mp = parseInt(String(rawMp))

        if (Number.isNaN(pa) || Number.isNaN(pc) || Number.isNaN(mp) || mp <= 0 || (pa <= 0 && pc <= 0) || pa < 0 || pc < 0) {
          return NextResponse.json(
            { error: 'Valori non validi: controlla prezzi e massimo partecipanti.' },
            { status: 400 }
          )
        }

        await prisma.transfer.update({
          where: { id: existing.transfer.id },
          data: {
            approvalStatus: 'APPROVED',
            priceAdult: pa,
            priceChild: pc,
            maxParticipants: mp,
          },
        })

        try {
          await createAuditLog(
            session.user.id,
            'APPROVE_TRANSFER',
            'TRANSFER',
            existing.transfer.id,
            `Approvato trasferimento da approvazione partecipante ${existing.id}. Prezzi: Adulti €${pa}, Bambini €${pc}, Max ${mp}.`,
            null,
            existing.transfer.id,
            null
          )
        } catch (auditError) {
          console.error('Audit log failed:', auditError)
        }
      }

      const adults = existing.adults || 0
      const children = existing.children || 0
      const computedFromExcursion =
        existing.excursion
          ? (adults * (existing.excursion.priceAdult || 0)) +
            (children * (existing.excursion.priceChild || 0))
          : null
      const computedFromTransfer = existing.transfer
        ? (() => {
            const rawPa = body?.transferPriceAdult
            const rawPc = body?.transferPriceChild
            if (rawPa !== undefined && rawPc !== undefined) {
              const pa = parseFloat(String(rawPa))
              const pc = parseFloat(String(rawPc))
              if (!Number.isNaN(pa) && !Number.isNaN(pc)) {
                return (adults * pa) + (children * pc)
              }
            }
            return (adults * (existing.transfer.priceAdult || 0)) + (children * (existing.transfer.priceChild || 0))
          })()
        : null

      if (nextTotalPrice <= 0.01) {
        const computed = computedFromTransfer ?? computedFromExcursion
        if (typeof computed === 'number' && computed > 0) {
          nextTotalPrice = computed
        }
      }

      const paymentType = existing.paymentType || 'BALANCE'
      if (paymentType === 'BALANCE') {
        nextPaidAmount = nextTotalPrice
        nextPaymentStatus = 'PAID'
      } else if (paymentType === 'DEPOSIT') {
        nextPaymentStatus = nextPaidAmount >= nextTotalPrice - 0.01 ? 'PAID' : 'PARTIAL'
      } else if (paymentType === 'OPTION') {
        nextPaidAmount = 0
        nextPaymentStatus = 'PENDING'
      }
    }

    const updated = await prisma.participant.update({
      where: { id },
      data: {
        approvalStatus: status,
        totalPrice: nextTotalPrice,
        paidAmount: nextPaidAmount,
        paymentStatus: nextPaymentStatus,
      },
    })

    await createAuditLog(
      session.user.id,
      status === 'APPROVED' ? 'APPROVE_PARTICIPANT' : 'REJECT_PARTICIPANT',
      'PARTICIPANT',
      updated.id,
      status === 'APPROVED'
        ? `Approvato partecipante ${updated.id} (Totale: €${nextTotalPrice.toFixed(2)})`
        : `Rifiutato partecipante ${updated.id}`,
      existing.excursionId || null,
      existing.transferId || null,
      existing.rentalId || null
    )

    const recipientEmail = existing.email || existing.client?.email
    if (recipientEmail) {
      try {
        const allowSelfSigned =
          process.env.SMTP_ALLOW_SELF_SIGNED === 'true' ||
          process.env.NODE_ENV !== 'production'

        if (allowSelfSigned) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
        }

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

        const safeName =
          `${existing.firstName || existing.client?.firstName || ''} ${existing.lastName || existing.client?.lastName || ''}`.trim() ||
          'Cliente'

        let subject = 'Aggiornamento Prenotazione - Corfumania'
        let text = `Gentile ${safeName},\n\nLa tua prenotazione è stata aggiornata.\n\nCordiali saluti,\nTeam Corfumania`

        if (status === 'REJECTED') {
          const paidValue = typeof existing.paidAmount === 'number' ? existing.paidAmount : 0
          const refundLine =
            paidValue > 0.01
              ? `\n\nPer il ritiro dei soldi versati (acconto o saldo) pari a €${paidValue.toFixed(2)}, passa in sede.`
              : ''

          subject = 'Richiesta non approvata - Corfumania'
          text = `Gentile ${safeName},\n\nla tua richiesta non è stata approvata.${refundLine}\n\nPer informazioni contattaci.\n\nCorfumania`
        } else {
          subject = 'Prenotazione Confermata - Corfumania'
          text = `Gentile ${safeName},\n\nla tua prenotazione è stata confermata.\nTotale: €${nextTotalPrice.toFixed(2)}.\n\nCordiali saluti,\nTeam Corfumania`
        }

        const from =
          process.env.MAIL_FROM ||
          process.env.EMAIL_USER ||
          process.env.SMTP_USER ||
          'no-reply@localhost'

        await transporter.sendMail({
          from,
          to: recipientEmail,
          subject,
          text
        })

        await createAuditLog(
          session.user.id,
          'SEND_PARTICIPANT_EMAIL',
          'PARTICIPANT',
          existing.id,
          `Inviata email (${subject}) a ${recipientEmail}`,
          existing.excursionId || null,
          existing.transferId || null,
          existing.rentalId || null
        )
      } catch (emailError) {
        console.error('[APPROVAL] Email sending failed:', emailError)
        await createAuditLog(
          session.user.id,
          'SEND_PARTICIPANT_EMAIL_FAILED',
          'PARTICIPANT',
          existing.id,
          `Invio email fallito: ${(emailError as any)?.message || 'Errore sconosciuto'}`,
          existing.excursionId || null,
          existing.transferId || null,
          existing.rentalId || null
        )
      }
    } else {
      await createAuditLog(
        session.user.id,
        'SEND_PARTICIPANT_EMAIL_SKIPPED',
        'PARTICIPANT',
        existing.id,
        'Email non inviata: destinatario senza email',
        existing.excursionId || null,
        existing.transferId || null,
        existing.rentalId || null
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error approving participant:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
