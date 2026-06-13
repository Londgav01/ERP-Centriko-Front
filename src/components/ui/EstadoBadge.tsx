import { BADGES, type TipoBadge } from '../../lib/constantes'

interface EstadoBadgeProps {
  estado: string
  tipo: TipoBadge
  // Texto a mostrar si difiere del valor del estado (por defecto, el estado tal cual)
  label?: string
  className?: string
}

// Badge de estado con el mapa de colores centralizado en lib/constantes.
// Fallback 'badge-neutral' para estados no mapeados (igual que las páginas).
export default function EstadoBadge({ estado, tipo, label, className }: EstadoBadgeProps) {
  const mapa: Record<string, string> = BADGES[tipo]
  const clase = mapa[estado] || 'badge-neutral'
  const clases = ['badge', clase, className].filter(Boolean).join(' ')
  return <span className={clases}>{label ?? estado}</span>
}
