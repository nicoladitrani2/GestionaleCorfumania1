'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, X } from 'lucide-react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export default function PWAHandler() {
  const [isBannerVisible, setIsBannerVisible] = useState(false)
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const setBannerVisibleSafe = useCallback((value: boolean) => {
    if (mountedRef.current) setIsBannerVisible(value)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Se l'app è già "installed" in modalità standalone, non mostrare banner
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true

    if (isStandalone) return

    // Service Worker registration: ok tenerla qui, ma assicurati che /sw.js esista
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('SW registration failed:', err)
      })
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      deferredPromptRef.current = e as BeforeInstallPromptEvent
      setBannerVisibleSafe(true)
    }

    const onAppInstalled = () => {
      deferredPromptRef.current = null
      setBannerVisibleSafe(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [setBannerVisibleSafe])

  const handleInstallClick = useCallback(async () => {
    const promptEvent = deferredPromptRef.current
    if (!promptEvent) {
      setBannerVisibleSafe(false)
      return
    }

    try {
      await promptEvent.prompt()
      await promptEvent.userChoice
    } catch (err) {
      console.error('Install failed:', err)
    } finally {
      deferredPromptRef.current = null
      setBannerVisibleSafe(false)
    }
  }, [setBannerVisibleSafe])

  if (!isBannerVisible) return null

  return (
    <div className="fixed top-4 left-4 right-4 z-[9999] animate-in slide-in-from-top-5 duration-500">
      <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/20 flex items-center justify-between gap-3 ring-1 ring-black/5">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2.5 rounded-xl text-white shadow-sm flex-shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-slate-800 text-sm leading-tight truncate">Installa App</span>
            <span className="text-xs text-slate-500 font-medium truncate">Accesso rapido e offline</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setBannerVisibleSafe(false)}
            className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
            aria-label="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
          <button
            onClick={handleInstallClick}
            className="bg-slate-900 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-slate-800 active:scale-95 transition-all shadow-md"
          >
            Installa
          </button>
        </div>
      </div>
    </div>
  )
}
