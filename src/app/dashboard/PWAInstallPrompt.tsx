'use client'

import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true)
    }

    // Check if iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(ios)

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Show iOS prompt if not standalone
    if (ios && !isStandalone) {
      // Logic to show iOS instructions could go here, 
      // but for now we might just rely on the user finding the share button
      // or show a specific iOS banner.
      // Let's simpler: if not standalone and on mobile, show a small hint.
      setShowPrompt(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [isStandalone])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
      setShowPrompt(false)
    }
  }

  if (isStandalone || !showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:bottom-4 bg-white p-4 rounded-xl shadow-2xl border border-blue-100 z-50 animate-in slide-in-from-bottom-10 max-w-sm mx-auto md:mx-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-600" />
            Installa App
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            {isIOS 
              ? "Per installare: tocca il tasto Condividi e poi 'Aggiungi alla schermata Home'"
              : "Installa l'app per un accesso più rapido e per usarla offline."}
          </p>
          {!isIOS && (
            <button
              onClick={handleInstallClick}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              Installa Ora
            </button>
          )}
        </div>
        <button 
          onClick={() => setShowPrompt(false)}
          className="text-gray-400 hover:text-gray-600 p-1"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
