'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Download, X } from 'lucide-react'

export default function PWAInstallBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const deferredPromptRef = useRef<any>(null)

  useEffect(() => {
    setIsMounted(true)

    const checkPrompt = () => {
      if ((window as any).deferredPrompt) {
        deferredPromptRef.current = (window as any).deferredPrompt
        setShowBanner(true)
      }
    }
    
    // Initial check
    checkPrompt()

    // Listen for the event
    window.addEventListener('pwa-prompt-ready', checkPrompt)

    return () => {
      window.removeEventListener('pwa-prompt-ready', checkPrompt)
    }
  }, [])

  const handleInstallClick = useCallback(async () => {
    const promptEvent = deferredPromptRef.current
    if (!promptEvent) {
      setShowBanner(false)
      return
    }

    try {
      // Show the native install prompt
      await promptEvent.prompt()

      // Wait for the user to respond to the prompt
      const { outcome } = await promptEvent.userChoice
      console.log(`User response to the install prompt: ${outcome}`)

      // We've used the prompt, and can't use it again, discard it
      deferredPromptRef.current = null
      setShowBanner(false)
      (window as any).deferredPrompt = null
    } catch (err) {
      console.error('Error during installation:', err)
      setShowBanner(false)
    }
  }, [])

  const handleClose = () => {
    setShowBanner(false)
  }

  if (!isMounted) return null
  if (!showBanner) return null

  return (
    <div className="fixed top-4 left-4 right-4 z-[100] animate-in slide-in-from-top-5 duration-500">
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
            onClick={handleClose}
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