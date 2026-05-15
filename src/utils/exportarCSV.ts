export function exportarCSV(datos: any[], nombreArchivo: string) {
  if (!datos.length) return

  const SEP = ';' // Excel en español usa ; como separador

  const headers = Object.keys(datos[0])

  const escapar = (v: any) => {
    if (v === null || v === undefined) return ''
    const str = String(v)
    // Si contiene el separador, comillas o saltos de línea, envolver en comillas
    return str.includes(SEP) || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str
  }

  const filas = datos.map(row =>
    headers.map(h => escapar(row[h])).join(SEP)
  )

  const csv = [headers.join(SEP), ...filas].join('\n')

  // BOM para que Excel reconozca UTF-8 correctamente
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${nombreArchivo}_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}