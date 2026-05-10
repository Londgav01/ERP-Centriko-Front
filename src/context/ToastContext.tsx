import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  type: ToastType
  message: string
}

interface ToastContextType {
  toast: {
    success: (msg: string) => void
    error:   (msg: string) => void
    warning: (msg: string) => void
    info:    (msg: string) => void
  }
}

const ToastContext = createContext<ToastContextType | null>(null)

const ICONS = {
  success: <CheckCircle2 size={16} color="#4ade80" />,
  error:   <AlertCircle  size={16} color="#f87171" />,
  warning: <AlertTriangle size={16} color="#fbbf24" />,
  info:    <Info          size={16} color="#60a5fa" />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  let counter = 0

  const add = useCallback((type: ToastType, message: string) => {
    const id = ++counter
    setToasts(t => [...t.slice(-2), { id, type, message }])
    if (type !== 'error') {
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
    }
  }, [])

  const remove = (id: number) => setToasts(t => t.filter(x => x.id !== id))

  const toast = {
    success: (msg: string) => add('success', msg),
    error:   (msg: string) => add('error', msg),
    warning: (msg: string) => add('warning', msg),
    info:    (msg: string) => add('info', msg),
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {ICONS[t.type]}
            <span style={{ flex: 1 }}>{t.message}</span>
            <button className="toast-close" onClick={() => remove(t.id)} title="Cerrar notificación">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}