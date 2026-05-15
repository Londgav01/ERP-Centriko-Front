import { useState, useRef, useEffect } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { Plus, Pencil, Users, Loader2, AlertCircle, X, Search } from 'lucide-react'
import { usePagination } from '../../hooks/usePagination'
import Pagination from '../../components/ui/Pagination'

interface Proveedor {
  proveedor_id: string; nombre: string; nit: string
  contacto: string; telefono: string; email: string
  ciudad: string; categoria: string; activo: number
}

const EMPTY = {
  nombre: '', nit: '', contacto: '', telefono: '',
  email: '', ciudad: '', categoria: '', activo: true
}

// Valida NIT en cliente — fix C-02
function validarNitCliente(nit: string): string {
  const limpio = nit.replace(/[.\-\s]/g, '')
  if (!limpio) return ''
  if (!/^\d+$/.test(limpio)) return 'Solo se permiten números'
  if (limpio.length < 5)     return 'Mínimo 5 dígitos'
  return ''
}

export default function ProveedoresPage() {
  const { toast } = useToast()

  const [proveedores,  setProveedores]  = useState<Proveedor[]>([])
  const pag = usePagination(proveedores)
  const [busqueda,     setBusqueda]     = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroActivo, setFiltroActivo] = useState('')
  const [buscando,     setBuscando]     = useState(false)
  const [hasBuscado,   setHasBuscado]   = useState(false)

  const [form,     setForm]     = useState(EMPTY)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error,    setError]    = useState('')
  const [nitError, setNitError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [categoriasOpts, setCategoriasOpts] = useState<string[]>([])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.get('/api/categorias?tipo=PROVEEDOR&activo=1')
      .then(res => {
        setCategoriasOpts(res.data.data.map((c: any) => c.nombre))
      })
      .catch(() => setCategoriasOpts([]))
  }, [])

  const buscar = async (q: string, categoria: string, activo: string) => {
    const activar = q.length >= 3 || categoria || activo !== ''
    if (!activar) { setProveedores([]); setHasBuscado(false); return }

    setBuscando(true); setHasBuscado(true)
    try {
      const params = new URLSearchParams()
      if (q)          params.append('q', q)
      if (categoria)  params.append('categoria', categoria)
      if (activo !== '') params.append('activo', activo)
      const res = await api.get(`/api/proveedores?${params}`)
      setProveedores(res.data.data)
      pag.reset()
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

  const handleNit = (val: string) => {
    set('nit', val)
    setNitError(validarNitCliente(val))
  }

  const abrirNuevo = () => {
    setForm(EMPTY); setEditId(null)
    setError(''); setNitError(''); setShowForm(true)
  }

  const abrirEditar = (p: Proveedor) => {
    setForm({
      nombre: p.nombre, nit: p.nit, contacto: p.contacto || '',
      telefono: p.telefono || '', email: p.email || '',
      ciudad: p.ciudad || '', categoria: p.categoria || '',
      activo: p.activo === 1
    })
    setEditId(p.proveedor_id)
    setError(''); setNitError(''); setShowForm(true)
  }

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const nitErr = validarNitCliente(form.nit)
    if (nitErr) { setNitError(nitErr); return }

    setCargando(true); setError('')
    try {
      if (editId) {
        await api.put(`/api/proveedores/${editId}`, form)
        toast.success('Proveedor actualizado correctamente')
      } else {
        await api.post('/api/proveedores', form)
        toast.success('Proveedor creado correctamente')
      }
      setShowForm(false)
      // Fix C-02: limpiar form ANTES de recargar — estado ya limpio al cerrar modal
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
          <h1 className="page-title">Proveedores</h1>
          <p className="page-subtitle">Terceros para compras de materiales y servicios</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>
          <Plus size={15} /> Nuevo proveedor
        </button>
      </div>

      {/* Filtros */}
      <div className="page-filters">
        <div className="search-bar">
          <Search size={14} />
          <input
            className="form-input"
            placeholder="Buscar por nombre, NIT, ciudad..."
            value={busqueda}
            onChange={e => handleBusqueda(e.target.value)}
            aria-label="Buscar proveedores"
          />
        </div>

        <select
          className="form-select form-select--w160"
          value={filtroCategoria}
          onChange={e => handleFiltro(e.target.value, filtroActivo)}
          aria-label="Filtrar por categoría"
        >
          <option value="">Todas las categorías</option>
          {categoriasOpts.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          className="form-select form-select--w150"
          value={filtroActivo}
          onChange={e => handleFiltro(filtroCategoria, e.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="">Activo e inactivo</option>
          <option value="1">Solo activos</option>
          <option value="0">Solo inactivos</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="data-table-wrapper">
        {buscando ? (
          <div className="page-loading">
            <Loader2 size={18} className="spinner" />
            <span>Buscando proveedores...</span>
          </div>
        ) : !hasBuscado ? (
          <div className="search-empty-state">
            <Users size={32} style={{ color: 'var(--color-text-muted)' }} />
            <span>Escribe al menos 3 caracteres o aplica un filtro para ver proveedores</span>
          </div>
        ) : proveedores.length === 0 ? (
          <div className="search-empty-state">
            <Users size={32} style={{ color: 'var(--color-text-muted)' }} />
            <span>No se encontraron proveedores con ese criterio</span>
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Razón social</th>
                  <th>NIT</th>
                  <th>Categoría</th>
                  <th>Contacto</th>
                  <th>Teléfono</th>
                  <th>Ciudad</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pag.itemsPagina.map(p => (
                  <tr key={p.proveedor_id}>
                    <td className="td-id">{p.proveedor_id}</td>
                    <td className="td-bold">{p.nombre}</td>
                    <td><span className="font-mono">{p.nit}</span></td>
                    <td>
                      {p.categoria
                        ? <span className="badge badge-info">{p.categoria}</span>
                        : <span className="td-muted">—</span>}
                    </td>
                    <td className="td-secondary">{p.contacto || '—'}</td>
                    <td className="td-secondary">{p.telefono || '—'}</td>
                    <td className="td-secondary">{p.ciudad || '—'}</td>
                    <td>
                      <span className={`badge ${p.activo ? 'badge-success' : 'badge-danger'}`}>
                        {p.activo ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(p)}>
                          <Pencil size={13} /> Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination {...pag} />
          </>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">
                {editId ? `Editar — ${editId}` : 'Nuevo proveedor'}
              </span>
              <button className="btn btn-ghost btn-sm modal-close-button" onClick={() => setShowForm(false)}
                aria-label="Cerrar">
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

                {/* Razón social + NIT */}
                <div className="form-grid-2 form-section-gap">
                  <div className="form-group">
                    <label className="form-label required" htmlFor="prov-nombre">Razón social</label>
                    <input
                      id="prov-nombre"
                      className="form-input"
                      value={form.nombre}
                      onChange={e => set('nombre', e.target.value)}
                      required placeholder="Nombre o razón social"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="prov-nit">NIT / Cédula</label>
                    <input
                      id="prov-nit"
                      className={`form-input font-mono ${nitError ? 'error' : ''}`}
                      value={form.nit}
                      onChange={e => handleNit(e.target.value)}
                      required placeholder="Ej: 9001234567"
                    />
                    {nitError
                      ? <span className="hint-error">{nitError}</span>
                      : <span className="form-hint">Sin puntos ni guiones — solo números</span>
                    }
                  </div>
                </div>

                {/* Categoría + Ciudad */}
                <div className="form-grid-2 form-section-gap">
                  <div className="form-group">
                    <label className="form-label" htmlFor="prov-cat">Categoría</label>
                    <select
                      id="prov-cat"
                      className="form-select"
                      value={form.categoria}
                      onChange={e => set('categoria', e.target.value)}
                      aria-label="Categoría del proveedor"
                    >
                      <option value="">Sin categoría</option>
                      {categoriasOpts.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="prov-ciudad">Ciudad</label>
                    <input
                      id="prov-ciudad"
                      className="form-input"
                      value={form.ciudad}
                      onChange={e => set('ciudad', e.target.value)}
                      placeholder="Ej: Medellín"
                    />
                  </div>
                </div>

                {/* Contacto + Teléfono + Email */}
                <div className="form-grid-3 form-section-gap">
                  <div className="form-group">
                    <label className="form-label" htmlFor="prov-contacto">Persona de contacto</label>
                    <input
                      id="prov-contacto"
                      className="form-input"
                      value={form.contacto}
                      onChange={e => set('contacto', e.target.value)}
                      placeholder="Nombre del contacto"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="prov-tel">Teléfono</label>
                    <input
                      id="prov-tel"
                      className="form-input"
                      value={form.telefono}
                      onChange={e => set('telefono', e.target.value)}
                      placeholder="Ej: 3001234567"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="prov-email">Email</label>
                    <input
                      id="prov-email"
                      type="email"
                      className="form-input"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      placeholder="correo@proveedor.com"
                    />
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
                      aria-label={form.activo ? 'Desactivar proveedor' : 'Activar proveedor'}
                    />
                    <span className="toggle-label">
                      {form.activo ? 'Proveedor activo — aparece en cotizaciones' : 'Proveedor inactivo — no aparece en cotizaciones'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={cargando || !!nitError}>
                  {cargando
                    ? <><Loader2 size={14} className="spinner" /> Guardando...</>
                    : editId ? 'Guardar cambios' : 'Crear proveedor'
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