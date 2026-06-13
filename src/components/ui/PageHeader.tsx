import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}

// Encabezado estándar de página: título + subtítulo + acciones a la derecha.
// Mismo markup que usaban todas las páginas (page-header/page-title/page-subtitle).
export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle != null && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}
