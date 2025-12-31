'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// 30 minuti di inattività
const INACTIVITY_LIMIT = 30 * 60 * 1000 

export function AutoLogout() {
  const router = useRouter()
  const lastActivityRef = useRef(Date.now())
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now()
    }

    // Eventi da monitorare per l'attività dell'utente
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    
    events.forEach(event => {
      window.addEventListener(event, handleActivity)
    })

    // Controllo periodico (ogni 10 secondi)
    timerRef.current = setInterval(async () => {
      const now = Date.now()
      if (now - lastActivityRef.current > INACTIVITY_LIMIT) {
        // Esegui logout
        try {
          await fetch('/api/auth/logout', { method: 'POST' })
          router.push('/login?reason=timeout')
        } catch (error) {
          console.error('Logout error:', error)
          router.push('/login')
        }
      }
    }, 10000)

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [router])

  return null
}
