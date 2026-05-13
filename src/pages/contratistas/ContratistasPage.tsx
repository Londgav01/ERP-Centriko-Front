import { useState, useRef, useEffect } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { Plus, Pencil, Users, Loader2, AlertCircle, X, Search } from 'lucide-react'

interface Contratista {
  contratista_id: string; nombre: string; nit: string
  especialidad: string; contacto: string; telefono: string
  email: string; ciudad: string; activo: number
}

const EMPTY = {
  nombre: '', nit: '', especialidad: '', contacto: '',
  telefono: '', email: '', ciudad: '', activo: true
}

function validarNitCliente(nit: string): string {
  const limpio = nit.replace(/[.\-\s]/g, '')
  if (!limpio) return ''
  if (!/^\d+$/.test(limpio)) return 'Solo se permiten números'
  if (limpio.length < 5)     return 'Mínimo 5 dígitos'
  return ''
}

const BADGE_ESPECIALIDAD: Record<string, string> = {
  ESTRUCTURA:        'badge-info',
  MAMPOSTERÍA:       'badge-info',
  INSTALACIONES_HID: 'badge-info',
  INSTALACIONES_ELEC:'badge-info',
  ACABADOS:          'badge-neutral',
  CARPINTERÍA:       'badge-neutral',
  OBRA_GRUESA:       'badge-info',
  VARIOS:            'badge-neutral',
}

export default function ContratistasPage() {
  const { toast } = useToast()

  const [contratistas,    setContratistas]    = useState<Contratista[]>([])
  const [busqueda,        setBusqueda]        = useState('')
  const [filtroEspecialidad, setFiltroEspecialidad] = useState('')
  const [filtroActivo,    setFiltroActivo]    = useState('')
  const [buscando,        setBuscando]        = useState(false)
  const [hasBuscado,      setHasBuscado]      = useState(true)

  const [form,     setForm]     = useState(EMPTY)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error,    setError]    = useState('')
  const [nitError, setNitError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [especialidadesOpts, setEspecialidadesOpts] = useState<string[]>([])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.get('/api/categorias?tipo=CONTRATISTA&activo=1')
      .then(res => {
        setEspecialidadesOpts(res.data.data.map((c: any) => c.nombre))
      })
      .catch(() => setEspecialidadesOpts([]))
  }, [])

    const buscar = async (q: string, especialidad: string, activo: string) => {
    setBuscando(true); setHasBuscado(true)
    try {
        const params = new URLSearchParams()
        if (q)            params.append('q', q)
        if (especialidad) params.append('especialidad', especialidad)
        if (activo !== '') params.append('activo', activo)
        const res = await api.get(`/api/contratistas?${params}`)
        setContratistas(res.data.data)
    } finally { setBuscando(false) }
    }

  const cargarTodos = async () => {
    setBuscando(true)
    try {
        const res = await api.get('/api/contratistas')
        setContratistas(res.data.data)
        } finally { setBuscando(false) }
    }

    useEffect(() => { cargarTodos() }, [])

    const handleBusqueda = (q: string) => {
    setBusqueda(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
        if (q === '' || q.length >= 3) buscar(q, filtroEspecialidad, filtroActivo)
    }, 350)
    }

  const handleFiltro = (especialidad: string, activo: string) => {
    setFiltroEspecialidad(especialidad)
    setFiltroActivo(activo)
    buscar(busqueda, especialidad, activo)
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

  const abrirEditar = (ct: Contratista) => {
    setForm({
      nombre: ct.nombre, nit: ct.nit,
      especialidad: ct.especialidad || '',
      contacto: ct.contacto || '', telefono: ct.telefono || '',
      email: ct.email || '', ciudad: ct.ciudad || '',
      activo: ct.activo === 1
    })
    setEditId(ct.contratista_id)
    setError(''); setNitError(''); setShowForm(true)
  }

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const nitErr = validarNitCliente(form.nit)
    if (nitErr) { setNitError(nitErr); return }

    setCargando(true); setError('')
    try {
      if (editId) {
        await api.put(`/api/contratistas/${editId}`, form)
        toast.success('Contratista actualizado correctamente')
      } else {
        await api.post('/api/contratistas', form)
        toast.success('Contratista creado correctamente')
      }
      setShowForm(false)
      buscar(busqueda, filtroEspecialidad, filtroActivo)
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al guardar'
      setError(msg); toast.error(msg)
    } finally { setCargando(false) }
  }

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Contratistas</h1>
          <p className="page-subtitle">Terceros para contratos de obra</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>
          <Plus size={15} /> Nuevo contratista
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
            aria-label="Buscar contratistas"
          />
        </div>

        <select
          className="form-select"
          value={filtroEspecialidad}
          onChange={e => handleFiltro(e.target.value, filtroActivo)}
          aria-label="Filtrar por especialidad"
          style={{ width: 200 }}
        >
          <option value="">Todas las especialidades</option>
          {especialidadesOpts.map(e => <option key={e} value={e}>{e}</option>)}
        </select>

        <select
          className="form-select"
          value={filtroActivo}
          onChange={e => handleFiltro(filtroEspecialidad, e.target.value)}
          aria-label="Filtrar por estado"
          style={{ width: 150 }}
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
            <span>Buscando contratistas...</span>
          </div>
        ) : !hasBuscado ? (
          <div className="search-empty-state">
            <Users size={32} style={{ color: 'var(--color-text-muted)' }} />
            <span>Escribe al menos 3 caracteres o aplica un filtro para ver contratistas</span>
          </div>
        ) : contratistas.length === 0 ? (
          <div className="search-empty-state">
            <Users size={32} style={{ color: 'var(--color-text-muted)' }} />
            <span>No se encontraron contratistas con ese criterio</span>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Razón social</th>
                <th>NIT</th>
                <th>Especialidad</th>
                <th>Contacto</th>
                <th>Teléfono</th>
                <th>Ciudad</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {contratistas.map(ct => (
                <tr key={ct.contratista_id}>
                  <td className="td-id">{ct.contratista_id}</td>
                  <td className="td-bold">{ct.nombre}</td>
                  <td><span className="font-mono">{ct.nit}</span></td>
                  <td>
                    {ct.especialidad
                      ? <span className={`badge ${BADGE_ESPECIALIDAD[ct.especialidad] || 'badge-neutral'}`}>{ct.especialidad}</span>
                      : <span className="td-muted">—</span>}
                  </td>
                  <td className="td-secondary">{ct.contacto || '—'}</td>
                  <td className="td-secondary">{ct.telefono || '—'}</td>
                  <td className="td-secondary">{ct.ciudad || '—'}</td>
                  <td>
                    <span className={`badge ${ct.activo ? 'badge-success' : 'badge-danger'}`}>
                      {ct.activo ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(ct)}>
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
                {editId ? `Editar — ${editId}` : 'Nuevo contratista'}
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

                {/* Razón social + NIT */}
                <div className="form-grid-2" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="cont-nombre">Razón social</label>
                    <input
                      id="cont-nombre"
                      className="form-input"
                      value={form.nombre}
                      onChange={e => set('nombre', e.target.value)}
                      required placeholder="Nombre o razón social"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="cont-nit">NIT / Cédula</label>
                    <input
                      id="cont-nit"
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

                {/* Especialidad + Ciudad */}
                <div className="form-grid-2" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="cont-esp">Especialidad</label>
                    <select
                      id="cont-esp"
                      className="form-select"
                      value={form.especialidad}
                      onChange={e => set('especialidad', e.target.value)}
                      aria-label="Especialidad del contratista"
                    >
                      <option value="">Sin especialidad</option>
                      {ESPECIALIDADES.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="cont-ciudad">Ciudad</label>
                    <input
                      id="cont-ciudad"
                      className="form-input"
                      value={form.ciudad}
                      onChange={e => set('ciudad', e.target.value)}
                      placeholder="Ej: Bogotá"
                    />
                  </div>
                </div>

                {/* Contacto + Teléfono + Email */}
                <div className="form-grid-3" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="cont-contacto">Persona de contacto</label>
                    <input
                      id="cont-contacto"
                      className="form-input"
                      value={form.contacto}
                      onChange={e => set('contacto', e.target.value)}
                      placeholder="Nombre del contacto"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="cont-tel">Teléfono</label>
                    <input
                      id="cont-tel"
                      className="form-input"
                      value={form.telefono}
                      onChange={e => set('telefono', e.target.value)}
                      placeholder="Ej: 3001234567"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="cont-email">Email</label>
                    <input
                      id="cont-email"
                      type="email"
                      className="form-input"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      placeholder="correo@contratista.com"
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
                      aria-label={form.activo ? 'Desactivar contratista' : 'Activar contratista'}
                    />
                    <span className="toggle-label">
                      {form.activo
                        ? 'Contratista activo — disponible en contratos'
                        : 'Contratista inactivo — no aparece en contratos'}
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
                    : editId ? 'Guardar cambios' : 'Crear contratista'
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