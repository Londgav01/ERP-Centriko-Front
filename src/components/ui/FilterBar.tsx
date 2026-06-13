import type { ReactNode } from 'react'

// Contenedor estándar de filtros de página (page-filters).
export default function FilterBar({ children }: { children: ReactNode }) {
  return <div className="page-filters">{children}</div>
}

interface OpcionFiltro {
  value: string
  label: string
}

interface SelectFiltroProps {
  value: string
  // Recibe el VALOR NUEVO directamente: la página debe hacer
  //   onChange={v => { setFiltro(v); cargar({ estado: v, ... }) }}
  // pasando v como parámetro a cargar (patrón cargarLista del proyecto).
  onChange: (value: string) => void
  options: OpcionFiltro[]
  // Texto de la opción con value='' (ej. 'Todos los estados'). Si se omite, no se agrega.
  placeholder?: string
  ariaLabel?: string
  className?: string
}

// Select de filtro estándar (form-select dentro de page-filters).
export function SelectFiltro({ value, onChange, options, placeholder, ariaLabel, className }: SelectFiltroProps) {
  const clases = ['form-select', className].filter(Boolean).join(' ')
  return (
    <select className={clases} value={value} onChange={e => onChange(e.target.value)} aria-label={ariaLabel}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
