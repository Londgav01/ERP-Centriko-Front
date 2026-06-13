import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { api } from '../../lib/api'
import { useDebounce } from '../../hooks/useDebounce'
import type { Material } from '../../types'
import './MaterialAutocomplete.css'

interface MaterialAutocompleteProps {
  // Texto mostrado (normalmente el nombre del material ya seleccionado)
  value: string
  onSelect: (mat: Material) => void
  placeholder?: string
  ariaLabel?: string
}

// Buscador de materiales con sugerencias: debounce de 300 ms contra
// /api/materiales?q=...&activo=1 (extraído del autocomplete de RSPage;
// el menú se cierra 200 ms después del blur para permitir el mousedown).
export default function MaterialAutocomplete({
  value, onSelect, placeholder = 'Buscar material...', ariaLabel,
}: MaterialAutocompleteProps) {
  const [texto, setTexto] = useState(value)
  const [sugerencias, setSugerencias] = useState<Material[]>([])
  const [abierto, setAbierto] = useState(false)

  // Sincroniza el texto si el valor cambia desde afuera
  useEffect(() => { setTexto(value) }, [value])

  const buscar = useDebounce(async (q: string) => {
    try {
      const res = await api.get(`/api/materiales?q=${encodeURIComponent(q)}&activo=1`)
      setSugerencias(res.data.data)
      if (res.data.data.length > 0) setAbierto(true)
    } catch { /* silencioso */ }
  }, 300)

  const handleChange = (q: string) => {
    setTexto(q)
    if (q.length < 1) { setSugerencias([]); return }
    buscar(q)
  }

  const seleccionar = (mat: Material) => {
    setTexto(mat.nombre)
    setSugerencias([])
    setAbierto(false)
    onSelect(mat)
  }

  return (
    <div className="material-autocomplete">
      <div className="material-autocomplete-search">
        <Search size={12} />
        <input
          className="form-input material-autocomplete-input"
          value={texto}
          onChange={e => handleChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          onBlur={() => setTimeout(() => setAbierto(false), 200)}
        />
      </div>
      {abierto && sugerencias.length > 0 && (
        <div className="material-autocomplete-menu">
          {sugerencias.map(mat => (
            <button key={mat.material_id} type="button"
              onMouseDown={() => seleccionar(mat)}
              className="material-autocomplete-option">
              <span className="font-mono material-autocomplete-code">{mat.codigo}</span>
              {mat.nombre}
              <span className="material-autocomplete-unidad">({mat.unidad})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
