'use client'

import { useEffect } from 'react'

export default function DevSWCleanup() {
  useEffect(() => {
    const enabled = process.env.NEXT_PUBLIC_ENABLE_PWA === 'true'
    if (enabled) return

    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const alreadyCleaned = sessionStorage.getItem('__sw_cleanup_done__')
    if (alreadyCleaned) return

    ;(async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.allSettled(regs.map(r => r.unregister()))
      } catch {}
      try {
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.allSettled(keys.map(k => caches.delete(k)))
        }
      } catch {}
      sessionStorage.setItem('__sw_cleanup_done__', '1')
    })()
  }, [])

  return null
}

