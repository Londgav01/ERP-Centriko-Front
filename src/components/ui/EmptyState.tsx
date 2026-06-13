import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  children: ReactNode
}

// Estado vacío estándar (search-empty-state): icono grande + texto.
export default function EmptyState({ icon: Icon, children }: EmptyStateProps) {
  return (
    <div className="search-empty-state">
      {Icon && <Icon size={32} style={{ color: 'var(--color-text-muted)' }} />}
      <span>{children}</span>
    </div>
  )
}
