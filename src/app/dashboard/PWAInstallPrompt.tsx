'use client'

import { useState, useEffect } from 'react'
import { Download, X, Share, PlusSquare } from 'lucide-react'

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

    // Listen for install prompt (Android/Desktop)
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Check if installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true)
    }

    // Logic for iOS or manual trigger if not installed
    // We check if it's NOT standalone to decide whether to show the prompt
    // For iOS, we don't get 'beforeinstallprompt', so we just check standalone status
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    
    // Check local storage to see if user dismissed it recently (optional, but good practice)
    // For now, user requested "proprio che c'è un pop up", so we'll be aggressive but respect a session dismissal
    const dismissed = sessionStorage.getItem('pwa-prompt-dismissed')

    if (!dismissed) {
        if (ios && !isStandalone) {
            setShowPrompt(true)
        } else if (!isStandalone && isMobile) {
            // For Android without beforeinstallprompt (unlikely but possible), or just waiting for event
            // The event listener above will handle the prompt availability
        }
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

  const handleDismiss = () => {
      setShowPrompt(false)
      sessionStorage.setItem('pwa-prompt-dismissed', 'true')
  }

  if (isStandalone || !showPrompt) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 relative animate-in zoom-in-95 duration-200">
        <button 
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 text-blue-600">
             {/* App Icon placeholder or just a Download icon */}
             <Download className="w-8 h-8" />
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Installa Corfumania
          </h3>
          
          <p className="text-gray-600 mb-6 leading-relaxed">
            {isIOS 
              ? "Installa l'app sul tuo iPhone per un'esperienza migliore e accesso rapido."
              : "Installa l'app per un accesso rapido, notifiche e utilizzo offline."}
          </p>

          {isIOS ? (
            <div className="w-full bg-gray-50 rounded-xl p-4 text-left space-y-3 border border-gray-100">
              <div className="flex items-center gap-3 text-gray-700">
                <Share className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-medium">1. Tocca il tasto <span className="font-bold">Condividi</span></span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <PlusSquare className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-medium">2. Scorri e seleziona <span className="font-bold">Aggiungi alla schermata Home</span></span>
              </div>
            </div>
          ) : (
            <button
              onClick={handleInstallClick}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base font-bold shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Installa Applicazione
            </button>
          )}
          
          <div className="mt-4">
              <button 
                onClick={handleDismiss}
                className="text-sm text-gray-400 hover:text-gray-600 font-medium"
              >
                Forse più tardi
              </button>
          </div>
        </div>
      </div>
    </div>
  )
}
