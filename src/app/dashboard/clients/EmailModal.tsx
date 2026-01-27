import { useState } from 'react'
import { X, Mail, Send, Loader2 } from 'lucide-react'

interface EmailModalProps {
  clientId: string
  clientEmail: string
  clientName: string
  onClose: () => void
  onEmailSent: () => void
}

export function EmailModal({ clientId, clientEmail, clientName, onClose, onEmailSent }: EmailModalProps) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async () => {
    setSending(true)
    setError(null)
    
    try {
      // 1. Send email via API
      const emailRes = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: clientEmail,
          subject: subject,
          text: body
        })
      })

      if (!emailRes.ok) {
        const errorData = await emailRes.json()
        throw new Error(errorData.error || 'Errore durante l\'invio dell\'email')
      }

      // 2. Update client status
      const updateRes = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastEmailSentAt: new Date() })
      })

      if (!updateRes.ok) {
        console.error('Failed to update client status but email was sent')
        // We don't throw here to avoid telling the user the email failed when it didn't
      }

      onEmailSent()
      onClose()
      alert('Email inviata con successo!')
    } catch (e: any) {
      console.error("Failed to send email or update status", e)
      setError(e.message || "Si è verificato un errore durante l'invio dell'email.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center gap-2 text-white">
            <Mail className="w-5 h-5" />
            <h3 className="text-lg font-bold">Invia Email</h3>
          </div>
          <button 
            onClick={onClose}
            disabled={sending}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">A:</label>
            <div className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600">
              {clientName} &lt;{clientEmail}&gt;
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Oggetto</label>
            <input 
              type="text" 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50 disabled:bg-gray-100"
              placeholder="Inserisci l'oggetto..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Messaggio</label>
            <textarea 
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              disabled={sending}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50 disabled:bg-gray-100"
              placeholder="Scrivi qui il tuo messaggio..."
            />
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            onClick={handleSend}
            disabled={!subject || !body || sending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Invio in corso...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Invia Email
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
