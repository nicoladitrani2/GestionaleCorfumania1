'use client'

import { useEffect } from 'react'

export default function PWALifecycle() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Register Service Worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('Service Worker registered with scope:', registration.scope)
          })
          .catch((error) => {
            console.error('Service Worker registration failed:', error)
          })
      }

      // Capture beforeinstallprompt event globally
      window.addEventListener('beforeinstallprompt', (e: any) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault()
        // Stash the event so it can be triggered later.
        ;(window as any).deferredPrompt = e
        console.log('beforeinstallprompt captured globally')
        
        // Dispatch custom event for UI components to react
        window.dispatchEvent(new Event('pwa-prompt-ready'))
      })
    }
  }, [])

  return null
}
