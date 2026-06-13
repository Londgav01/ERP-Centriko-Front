import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import Pagination from './Pagination'
import LoadingState from './LoadingState'
import EmptyState from './EmptyState'

export interface Columna<T> {
  header: ReactNode
  render: (item: T) => ReactNode
  // Clase del <td> (td-id, td-secondary, ...) y opcionalmente del <th>
  className?: string
  thClassName?: string
}

// Resultado de usePagination (estructural — NO reimplementa el hook;
// la página sigue obteniendo `pag` de usePagination y lo pasa aquí).
export interface Paginacion<T> {
  itemsPagina: T[]
  pagina: number
  totalPaginas: number
  totalItems: number
  itemsPorPagina: number
  irA: (p: number) => void
  siguiente: () => void
  anterior: () => void
  reset: () => void
  hayAnterior: boolean
  haySiguiente: boolean
  inicio: number
  fin: number
}

interface DataTableProps<T> {
  columns: Columna<T>[]
  /**
   * Resultado de usePagination. Si se pasa, la tabla pagina (10/página) y
   * renderiza <Pagination> al pie. Alternativa: `items` para tablas sin paginar.
   */
  pag?: Paginacion<T>
  /** Lista directa SIN paginación (páginas que muestran todo, ej. Contratistas). */
  items?: T[]
  rowKey: (item: T) => string | number
  cargando?: boolean
  cargandoTexto?: string
  /** Tamaño en px del spinner de carga (algunas páginas usan 18, otras 20). */
  cargandoSize?: number
  emptyIcon?: LucideIcon
  emptyText?: ReactNode
  // true → el estado vacío se muestra como fila dentro de la tabla
  // (cabeceras visibles, patrón RS); false → reemplaza la tabla (patrón Proveedores).
  emptyEnFila?: boolean
}

// Tabla de datos estándar con paginación integrada: data-table-wrapper +
// data-table + <Pagination {...pag} /> (10 ítems/página vía usePagination).
export default function DataTable<T>({
  columns, pag, items, rowKey, cargando = false, cargandoTexto, cargandoSize,
  emptyIcon, emptyText = 'No hay registros', emptyEnFila = false,
}: DataTableProps<T>) {
  const filas = pag ? pag.itemsPagina : (items ?? [])
  const vacio = (pag ? pag.totalItems : filas.length) === 0

  return (
    <div className="data-table-wrapper">
      {cargando ? (
        <LoadingState texto={cargandoTexto} size={cargandoSize} />
      ) : vacio && !emptyEnFila ? (
        <EmptyState icon={emptyIcon}>{emptyText}</EmptyState>
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((c, i) => <th key={i} className={c.thClassName}>{c.header}</th>)}
              </tr>
            </thead>
            <tbody>
              {vacio ? (
                <tr>
                  <td colSpan={columns.length}>
                    <EmptyState icon={emptyIcon}>{emptyText}</EmptyState>
                  </td>
                </tr>
              ) : (
                filas.map(item => (
                  <tr key={rowKey(item)}>
                    {columns.map((c, i) => <td key={i} className={c.className}>{c.render(item)}</td>)}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {pag && <Pagination {...pag} />}
        </>
      )}
    </div>
  )
}
