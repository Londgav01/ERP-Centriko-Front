import type { ReactNode } from 'react'

export interface AccionFila {
  label: ReactNode
  icon?: ReactNode
  onClick: () => void
  // Clase extra sobre la base (ej. 'rs-success-action'). Para botones que no
  // son ghost, usar claseBase (ej. 'btn btn-danger btn-sm').
  className?: string
  claseBase?: string
  // Controla visibilidad por RBAC/estado sin romper el array (default true)
  visible?: boolean
  title?: string
}

// Botones de acción de fila estándar (table-actions + btn btn-ghost btn-sm).
export default function RowActions({ acciones }: { acciones: AccionFila[] }) {
  return (
    <div className="table-actions">
      {acciones.filter(a => a.visible !== false).map((a, i) => (
        <button key={i} type="button"
          className={[a.claseBase ?? 'btn btn-ghost btn-sm', a.className].filter(Boolean).join(' ')}
          onClick={a.onClick} title={a.title}>
          {a.icon} {a.label}
        </button>
      ))}
    </div>
  )
}
