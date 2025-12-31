'use client'

import { useState, useEffect } from 'react'
import { Download, X, Share, PlusSquare } from 'lucide-react'

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [showManualInstructions, setShowManualInstructions] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true)
    }

    // Check if iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(ios)

    // Check local storage (new key to reset state)
    const dismissed = sessionStorage.getItem('pwa-prompt-dismissed-v2')
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

    // Initial check for global deferred prompt
    if ((window as any).deferredPrompt) {
        setDeferredPrompt((window as any).deferredPrompt)
        if (!dismissed) setShowPrompt(true)
    }

    // Listen for custom event from PWALifecycle
    const handlePWAPromptReady = () => {
        if ((window as any).deferredPrompt) {
            setDeferredPrompt((window as any).deferredPrompt)
            if (!dismissed) setShowPrompt(true)
        }
    }
    window.addEventListener('pwa-prompt-ready', handlePWAPromptReady)

    // Listen for install prompt (Android/Desktop) - Backup
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      if (!dismissed) setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Force show if not installed (even if no prompt caught yet)
    // This allows showing manual instructions if the prompt fails
    // Removed isMobile check to ensure it appears for debugging/tablet users too
    if (!isStandalone && !dismissed) {
         // We wait a bit to see if the event fires, if not we show the manual prompt
         const timer = setTimeout(() => {
             setShowPrompt(true)
         }, 1000)
         return () => clearTimeout(timer)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('pwa-prompt-ready', handlePWAPromptReady)
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
      sessionStorage.setItem('pwa-prompt-dismissed-v2', 'true')
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
                <span className="flex items-center justify-center w-8 h-8 bg-white rounded-lg shadow-sm text-blue-600">
                  <Share className="w-5 h-5" />
                </span>
                <span className="text-sm font-medium">1. Tocca il tasto Condividi</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <span className="flex items-center justify-center w-8 h-8 bg-white rounded-lg shadow-sm text-blue-600">
                  <PlusSquare className="w-5 h-5" />
                </span>
                <span className="text-sm font-medium">2. Scorri e seleziona "Aggiungi alla Home"</span>
              </div>
            </div>
          ) : (
             !showManualInstructions ? (
                <button
                onClick={() => {
                    if (deferredPrompt) {
                        handleInstallClick()
                    } else {
                        setShowManualInstructions(true)
                    }
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all duration-200"
                >
                Installa App
                </button>
             ) : (
                <div className="w-full bg-gray-50 rounded-xl p-4 text-left space-y-3 border border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
                    <p className="text-sm text-gray-600 mb-2 font-medium">Installa dal menu del browser:</p>
                    <div className="flex items-center gap-3 text-gray-700">
                        <span className="flex items-center justify-center w-8 h-8 bg-white rounded-lg shadow-sm text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                        </span>
                        <span className="text-sm font-medium">1. Tocca i 3 puntini in alto a destra</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-700">
                        <span className="flex items-center justify-center w-8 h-8 bg-white rounded-lg shadow-sm text-gray-600">
                        <Download className="w-5 h-5" />
                        </span>
                        <span className="text-sm font-medium">2. Seleziona "Installa app"</span>
                    </div>
                </div>
             )
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
