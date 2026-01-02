'use client'

import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export default function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
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

    // Show the native install prompt
    deferredPrompt.prompt()

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice
    console.log(`User response to the install prompt: ${outcome}`)

    // We've used the prompt, and can't use it again, discard it
    setDeferredPrompt(null)
    setIsVisible(false)
    (window as any).deferredPrompt = null
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-blue-600 text-white p-4 rounded-xl shadow-lg flex items-center justify-between animate-in slide-in-from-bottom-5">
      <div className="flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-lg">
          <Download className="w-6 h-6" />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-sm">Installa App</span>
          <span className="text-xs opacity-90">Accesso rapido dalla Home</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button 
          onClick={() => setIsVisible(false)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <button 
          onClick={handleInstallClick}
          className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-gray-100 transition-colors"
        >
          Installa
        </button>
      </div>
    </div>
  )
}
