import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  texto?: string
  size?: number
}

// Spinner de carga estándar (page-loading + Loader2 girando).
export default function LoadingState({ texto = 'Cargando...', size = 20 }: LoadingStateProps) {
  return (
    <div className="page-loading">
      <Loader2 size={size} className="spinner" />
      <span>{texto}</span>
    </div>
  )
}
