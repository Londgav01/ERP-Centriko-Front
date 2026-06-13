// Formateadores centralizados — misma implementación que tenían las páginas.
// COP sin decimales con locale colombiano (restricción del proyecto: no cambiar).

export const fmtCOP = (v: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(v || 0)

export const fmtMiles = (v: number) => new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 0
}).format(v || 0)

// Versión abreviada para tableros (Dashboard / Presupuesto)
export const fmtCOPCorto = (v: number) => {
  if (!v) return '$ 0'
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000)     return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)         return `$${(v / 1_000).toFixed(0)}K`
  return fmtCOP(v)
}

export const fmtPct = (v: number) => `${(v || 0).toFixed(1)}%`

// Las fechas llegan como 'YYYY-MM-DD'; el T00:00:00 evita que la zona
// horaria corra la fecha un día hacia atrás.
export const fmtFecha = (f: string | null | undefined) =>
  f ? new Date(f + 'T00:00:00').toLocaleDateString('es-CO') : '—'
