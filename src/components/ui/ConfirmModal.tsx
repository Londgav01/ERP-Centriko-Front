import type { ReactNode } from 'react'
import { X, Loader2 } from 'lucide-react'

interface ConfirmModalProps {
  open: boolean
  titulo?: string
  mensaje: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  // true → botón de confirmación en rojo (anular / eliminar)
  peligro?: boolean
  cargando?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// Modal de confirmación para anular/eliminar/aprobar. Reemplaza los
// confirm() nativos del navegador manteniendo el estilo de los modales
// del proyecto.
export default function ConfirmModal({
  open, titulo = 'Confirmar', mensaje,
  confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  peligro = false, cargando = false, onConfirm, onCancel,
}: ConfirmModalProps) {
  if (!open) return null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{titulo}</span>
          <button type="button" className="btn btn-ghost btn-sm modal-close-button"
            onClick={onCancel} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          {mensaje}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={peligro ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirm} disabled={cargando}>
            {cargando ? <><Loader2 size={14} className="spinner" /> {confirmLabel}</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
