import { useState, useEffect, useRef } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { Plus, Pencil, Package, Loader2, AlertCircle, X, Search } from 'lucide-react'

const UNIDADES   = ['UN','ML','M2','M3','KG','TON','GL','LT','BOLSA','ROLLO','JUEGO','OTROS']
const CATEGORIAS = ['CONCRETO','ACERO','MAMPOSTERÍA','ACABADOS','ELÉCTRICO','HIDROSANITARIO','MADERA','VIDRIO','PINTURA','HERRAMIENTA','EQUIPOS','VARIOS']

interface Material {
  material_id: string; codigo: string; nombre: string
  descripcion: string; unidad: string; categoria: string
  precio_ref: number; activo: number
}

const EMPTY = {
  codigo: '', nombre: '', descripcion: '', unidad: 'UN',
  categoria: '', precio_ref: 0, activo: true
}

const fmtCOP = (v: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(v || 0)

const fmtMiles = (v: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(v || 0)

export default function MaterialesPage() {
  const { toast } = useToast()

  const [materiales, setMateriales]   = useState<Material[]>([])
  const [busqueda,   setBusqueda]     = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroActivo,    setFiltroActivo]    = useState('')
  const [buscando,   setBuscando]     = useState(false)
  const [hasBuscado, setHasBuscado]   = useState(false)

  const [form,     setForm]     = useState(EMPTY)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error,    setError]    = useState('')
  const [cargando, setCargando] = useState(false)

  const [precioView, setPrecioView] = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Búsqueda con debounce (fix C-09) ──────────────────────
  const buscar = async (q: string, categoria: string, activo: string) => {
    const activarBusqueda = q.length >= 3 || categoria || activo !== ''
    if (!activarBusqueda) { setMateriales([]); setHasBuscado(false); return }

    setBuscando(true)
    setHasBuscado(true)
    try {
      const params = new URLSearchParams()
      if (q)        params.append('q', q)
      if (categoria) params.append('categoria', categoria)
      if (activo !== '') params.append('activo', activo)
      const res = await api.get(`/api/materiales?${params}`)
      setMateriales(res.data.data)
    } finally { setBuscando(false) }
  }

  const handleBusqueda = (q: string) => {
    setBusqueda(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscar(q, filtroCategoria, filtroActivo), 350)
  }

  const handleFiltro = (categoria: string, activo: string) => {
    setFiltroCategoria(categoria)
    setFiltroActivo(activo)
    buscar(busqueda, categoria, activo)
  }

  const set = (key: string, value: any) => setForm(s => ({ ...s, [key]: value }))

  const abrirNuevo = () => {
    setForm(EMPTY); setEditId(null); setError(''); setPrecioView(''); setShowForm(true)
  }

  const abrirEditar = (m: Material) => {
    setForm({
      codigo: m.codigo, nombre: m.nombre, descripcion: m.descripcion || '',
      unidad: m.unidad, categoria: m.categoria || '',
      precio_ref: m.precio_ref, activo: m.activo === 1
    })
    setEditId(m.material_id); setError(''); setPrecioView(m.precio_ref ? fmtMiles(m.precio_ref) : ''); setShowForm(true)
  }

  const handlePrecioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '')
    const num = raw ? Number(raw) : 0
    set('precio_ref', num)
    setPrecioView(raw ? fmtMiles(num) : '')
  }

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault(); setCargando(true); setError('')
    try {
      if (editId) {
        await api.put(`/api/materiales/${editId}`, form)
        toast.success('Material actualizado correctamente')
      } else {
        await api.post('/api/materiales', form)
        toast.success('Material creado correctamente')
      }
      setShowForm(false)
      buscar(busqueda, filtroCategoria, filtroActivo)
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al guardar'
      setError(msg); toast.error(msg)
    } finally { setCargando(false) }
  }

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Materiales</h1>
          <p className="page-subtitle">Catálogo de insumos del sistema</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>
          <Plus size={15} /> Nuevo material
        </button>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="page-filters">
        <div className="search-bar">
          <Search size={14} />
          <input
            className="form-input"
            placeholder="Buscar por nombre, código... (mín. 3 caracteres)"
            value={busqueda}
            onChange={e => handleBusqueda(e.target.value)}
            aria-label="Buscar materiales"
          />
        </div>

        <select
          className="form-select"
          value={filtroCategoria}
          onChange={e => handleFiltro(e.target.value, filtroActivo)}
          aria-label="Filtrar por categoría"
          style={{ width: 180 }}
        >
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          className="form-select"
          value={filtroActivo}
          onChange={e => handleFiltro(filtroCategoria, e.target.value)}
          aria-label="Filtrar por estado"
          style={{ width: 140 }}
        >
          <option value="">Activo e inactivo</option>
          <option value="1">Solo activos</option>
          <option value="0">Solo inactivos</option>
        </select>
      </div>

      {/* Tabla / estados */}
      <div className="data-table-wrapper">
        {buscando ? (
          <div className="page-loading">
            <Loader2 size={18} className="spinner" />
            <span>Buscando materiales...</span>
          </div>
        ) : !hasBuscado ? (
          <div className="search-empty-state">
            <Package size={32} style={{ color: 'var(--color-text-muted)' }} />
            <span>Escribe al menos 3 caracteres o aplica un filtro para ver materiales</span>
          </div>
        ) : materiales.length === 0 ? (
          <div className="search-empty-state">
            <Package size={32} style={{ color: 'var(--color-text-muted)' }} />
            <span>No se encontraron materiales con ese criterio</span>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Código</th>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Unidad</th>
                <th>Categoría</th>
                <th>Precio ref.</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {materiales.map(m => (
                <tr key={m.material_id}>
                  <td className="td-id">{m.material_id}</td>
                  <td><span className="font-mono" style={{ fontWeight: 600 }}>{m.codigo}</span></td>
                  <td className="td-bold">{m.nombre}</td>
                  <td className="td-secondary" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.descripcion || '—'}
                  </td>
                  <td><span className="badge badge-neutral">{m.unidad}</span></td>
                  <td className="td-muted">{m.categoria || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{fmtCOP(m.precio_ref)}</td>
                  <td>
                    <span className={`badge ${m.activo ? 'badge-success' : 'badge-danger'}`}>
                      {m.activo ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(m)}>
                        <Pencil size={13} /> Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">
                {editId ? `Editar — ${editId}` : 'Nuevo material'}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}
                style={{ padding: '0 6px' }} aria-label="Cerrar">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={guardar}>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-error">
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Código + Nombre */}
                <div className="form-grid-3" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="mat-codigo">Código</label>
                    <input
                      id="mat-codigo"
                      className="form-input font-mono"
                      value={form.codigo}
                      onChange={e => set('codigo', e.target.value.toUpperCase())}
                      required placeholder="Ej: CEM-GR"
                    />
                    <span className="form-hint">Único en el catálogo</span>
                  </div>
                  <div className="form-group col-span-2">
                    <label className="form-label required" htmlFor="mat-nombre">Nombre</label>
                    <input
                      id="mat-nombre"
                      className="form-input"
                      value={form.nombre}
                      onChange={e => set('nombre', e.target.value)}
                      required placeholder="Ej: Cemento gris 50kg"
                    />
                  </div>
                </div>

                {/* Descripción */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label" htmlFor="mat-desc">Descripción</label>
                  <textarea
                    id="mat-desc"
                    className="form-textarea"
                    value={form.descripcion}
                    onChange={e => set('descripcion', e.target.value)}
                    placeholder="Especificaciones técnicas del material"
                    rows={2}
                  />
                </div>

                {/* Unidad + Categoría + Precio */}
                <div className="form-grid-3" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="mat-unidad">Unidad de medida</label>
                    <select
                      id="mat-unidad"
                      className="form-select"
                      value={form.unidad}
                      onChange={e => set('unidad', e.target.value)}
                      required
                      aria-label="Unidad de medida"
                    >
                      {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="mat-cat">Categoría</label>
                    <select
                      id="mat-cat"
                      className="form-select"
                      value={form.categoria}
                      onChange={e => set('categoria', e.target.value)}
                      aria-label="Categoría del material"
                    >
                      <option value="">Sin categoría</option>
                      {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="mat-precio">Precio de referencia (COP)</label>
                    <input
                      id="mat-precio"
                      type="text"
                      inputMode="numeric"
                      className="form-input"
                      value={precioView}
                      onChange={handlePrecioChange}
                      placeholder="0"
                      title="Precio de referencia — solo formato visual"
                      aria-label="Precio de referencia (formato visual con separador de miles)"
                    />
                    <span className="form-hint">Referencia — el precio real viene de la OC</span>
                  </div>
                </div>

                {/* Activo */}
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <div className="toggle-wrap">
                    <button
                      type="button"
                      className={`toggle ${form.activo ? 'on' : 'off'}`}
                      onClick={() => set('activo', !form.activo)}
                      aria-label={form.activo ? 'Desactivar material' : 'Activar material'}
                    />
                    <span className="toggle-label">
                      {form.activo ? 'Material activo — disponible en requisiciones' : 'Material inactivo — no aparece en requisiciones'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={cargando}>
                  {cargando
                    ? <><Loader2 size={14} className="spinner" /> Guardando...</>
                    : editId ? 'Guardar cambios' : 'Crear material'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  )
}