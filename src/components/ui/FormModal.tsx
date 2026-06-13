import type { FormEvent, ReactNode } from 'react'
import { X, AlertCircle, Loader2 } from 'lucide-react'

interface FormModalProps {
  open: boolean
  title: ReactNode
  onClose: () => void
  // Si se pasa, el cuerpo+pie se envuelven en <form onSubmit>; si no, en un fragmento
  // (modales de solo lectura / detalle).
  onSubmit?: (ev: FormEvent) => void
  children: ReactNode
  // Pie personalizado. Si se omite y hay onSubmit, se renderiza el pie estándar
  // Cancelar + botón primario con spinner.
  footer?: ReactNode
  submitLabel?: string
  submitLabelCargando?: string
  cargando?: boolean
  // Mensaje de error mostrado como alert-error al inicio del cuerpo.
  error?: string
  // Clase extra del modal, ej. 'modal-lg' o una clase de ancho propia de la página.
  className?: string
  disabledSubmit?: boolean
}

// Modal estándar del proyecto: overlay con cierre al hacer clic fuera,
// header con título y botón X, cuerpo y pie. Mismo markup y clases CSS
// que los 33 modales escritos a mano en las páginas.
export default function FormModal({
  open, title, onClose, onSubmit, children, footer,
  submitLabel = 'Guardar', submitLabelCargando = 'Guardando...',
  cargando = false, error, className, disabledSubmit = false,
}: FormModalProps) {
  if (!open) return null

  const cuerpo = (
    <>
      <div className="modal-body">
        {error && (
          <div className="alert alert-error">
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}
        {children}
      </div>
      {(footer !== undefined || onSubmit) && (
        <div className="modal-footer">
          {footer !== undefined ? footer : (
            <>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={cargando || disabledSubmit}>
                {cargando
                  ? <><Loader2 size={14} className="spinner" /> {submitLabelCargando}</>
                  : submitLabel}
              </button>
            </>
          )}
        </div>
      )}
    </>
  )

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={['modal', className].filter(Boolean).join(' ')}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button type="button" className="btn btn-ghost btn-sm modal-close-button"
            onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>
        {onSubmit ? <form onSubmit={onSubmit}>{cuerpo}</form> : cuerpo}
      </div>
    </div>
  )
}
