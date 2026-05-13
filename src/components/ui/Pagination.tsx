import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  pagina:       number
  totalPaginas: number
  totalItems:   number
  inicio:       number
  fin:          number
  hayAnterior:  boolean
  haySiguiente: boolean
  irA:          (p: number) => void
  siguiente:    () => void
  anterior:     () => void
}

export default function Pagination({
  pagina, totalPaginas, totalItems, inicio, fin,
  hayAnterior, haySiguiente, irA, siguiente, anterior
}: PaginationProps) {
  if (totalItems === 0) return null

  // Genera rango de páginas a mostrar (máx 5 botones)
  const rango = () => {
    const delta = 2
    const left  = Math.max(1, pagina - delta)
    const right = Math.min(totalPaginas, pagina + delta)
    const pages: (number | '...')[] = []

    if (left > 1) { pages.push(1); if (left > 2) pages.push('...') }
    for (let i = left; i <= right; i++) pages.push(i)
    if (right < totalPaginas) { if (right < totalPaginas - 1) pages.push('...'); pages.push(totalPaginas) }

    return pages
  }

  return (
    <div className="pagination-wrapper">
      <span className="pagination-info">
        Mostrando <strong>{inicio}–{fin}</strong> de{' '}
        <strong>{totalItems}</strong> registros
      </span>

      {totalPaginas > 1 && (
        <div className="pagination-controls">
          <button
            className="btn btn-secondary btn-sm pagination-nav-button"
            onClick={anterior}
            disabled={!hayAnterior}
            aria-label="Página anterior"
          >
            <ChevronLeft size={14} />
          </button>

          {rango().map((item, idx) =>
            item === '...' ? (
              <span key={`dots-${idx}`} className="pagination-dots">…</span>
            ) : (
              <button
                key={item}
                onClick={() => irA(item as number)}
                className={`pagination-page-button ${item === pagina ? 'is-active' : ''}`}
              >
                {item}
              </button>
            )
          )}

          <button
            className="btn btn-secondary btn-sm pagination-nav-button"
            onClick={siguiente}
            disabled={!haySiguiente}
            aria-label="Página siguiente"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}