'use client'

import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export default function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Check if event is already available
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt)
      setIsVisible(true)
    }

    // Listen for the event
    const handlePromptReady = () => {
      if ((window as any).deferredPrompt) {
        setDeferredPrompt((window as any).deferredPrompt)
        setIsVisible(true)
      }
    }

    window.addEventListener('pwa-prompt-ready', handlePromptReady)

    return () => {
      window.removeEventListener('pwa-prompt-ready', handlePromptReady)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    try {
      // Show the native install prompt
      deferredPrompt.prompt()

      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice
      console.log(`User response to the install prompt: ${outcome}`)

      // We've used the prompt, and can't use it again, discard it
      setDeferredPrompt(null)
      setIsVisible(false)
      (window as any).deferredPrompt = null
    } catch (err) {
      console.error('Error during installation:', err)
      setIsVisible(false)
    }
  }

  const handleClose = () => {
    setIsVisible(false)
  }

  if (!mounted) return null
  if (!isVisible) return null

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
