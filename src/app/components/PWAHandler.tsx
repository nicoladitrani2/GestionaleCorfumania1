'use client'

import { useEffect, useState, useRef } from 'react'
import { Download, X } from 'lucide-react'

export default function PWAHandler() {
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const deferredPromptRef = useRef<any>(null)

  useEffect(() => {
    setIsMounted(true)

    // 1. Service Worker Registration
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered:', registration.scope)
        })
        .catch((err) => {
          console.error('SW registration failed:', err)
        })
    }

    // 2. Handle beforeinstallprompt
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent default mini-infobar
      e.preventDefault()
      // Store the event
      deferredPromptRef.current = e
      // Update state to show UI
      setShowInstallPrompt(true)
      console.log('beforeinstallprompt captured in PWAHandler')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Check if event was already captured by the script in layout
    if ((window as any).deferredPrompt) {
      deferredPromptRef.current = (window as any).deferredPrompt
      setShowInstallPrompt(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    const promptEvent = deferredPromptRef.current
    if (!promptEvent) {
      setShowInstallPrompt(false)
      return
    }

    try {
      await promptEvent.prompt()
      const { outcome } = await promptEvent.userChoice
      console.log('User choice:', outcome)
      
      // Reset
      deferredPromptRef.current = null
      setShowInstallPrompt(false)
      (window as any).deferredPrompt = null
    } catch (err) {
      console.error('Install failed:', err)
      setShowInstallPrompt(false)
    }
  }

  if (!isMounted) return null
  if (!showInstallPrompt) return null

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
            onClick={() => setShowInstallPrompt(false)}
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