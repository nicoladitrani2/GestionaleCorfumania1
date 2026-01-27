
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react'

interface AlertModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  variant?: 'danger' | 'success' | 'info' | 'warning'
}

export function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  variant = 'info'
}: AlertModalProps) {
  if (!isOpen) return null

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <AlertCircle className="w-12 h-12 text-red-500" />
      case 'success':
        return <CheckCircle className="w-12 h-12 text-green-500" />
      case 'warning':
        return <AlertTriangle className="w-12 h-12 text-orange-500" />
      case 'info':
        return <Info className="w-12 h-12 text-blue-500" />
    }
  }

  const getButtonColor = () => {
    switch (variant) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
      case 'success':
        return 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
      case 'warning':
        return 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500'
      case 'info':
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-200 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className={`p-3 rounded-full ${variant === 'danger' ? 'bg-red-50' : variant === 'success' ? 'bg-green-50' : variant === 'warning' ? 'bg-orange-50' : 'bg-blue-50'}`}>
              {getIcon()}
            </div>
          </div>
          <p className="text-gray-600 text-lg">{message}</p>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-center">
          <button
            onClick={onClose}
            className={`w-full sm:w-auto px-6 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${getButtonColor()}`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
