import { useEffect, useState, useRef } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import {
  Plus, FileText, Loader2, AlertCircle, X,
  Search, Trash2, Check, XCircle, Eye
} from 'lucide-react'
import NumericInput from '../../components/ui/NumericInput'
import './RSPage.css'

interface Proyecto    { proyecto_id: string; nombre: string }
interface Edificacion { edificio_id: string; nombre: string; proyecto_id: string }
interface Capitulo    { capitulo_id: string; nombre_capitulo: string; edificio_id: string; codigo: string }
interface Material    { material_id: string; nombre: string; unidad: string; codigo: string }

interface ItemRS {
  material_id: string; nombre_material: string
  unidad: string; cantidad_solicitada: number; notas: string
}

interface RS {
  rs_id: string; estado: string; prioridad: string
  nombre_proyecto: string; nombre_edificio: string; nombre_capitulo: string
  solicitante: string; fecha_solicitud: string; descripcion: string
  proyecto_id: string
}

interface RSDetalle {
  det_id: string; material_id: string; nombre_material: string
  unidad: string; cantidad_solicitada: number; cantidad_aprobada: number; notas: string
}

const PRIORIDADES = ['BAJA','MEDIA','ALTA','URGENTE']
const ESTADOS     = ['BORRADOR','APROBADA','EN_PROCESO','COMPLETADA','RECHAZADA','ANULADA']

const BADGE_ESTADO: Record<string, string> = {
  BORRADOR:   'badge-neutral',  APROBADA:   'badge-success',
  EN_PROCESO: 'badge-info',     COMPLETADA: 'badge-success',
  RECHAZADA:  'badge-danger',   ANULADA:    'badge-danger',
}
const BADGE_PRIORIDAD: Record<string, string> = {
  BAJA: 'badge-neutral', MEDIA: 'badge-info',
  ALTA: 'badge-warning', URGENTE: 'badge-danger',
}

const EMPTY_FORM = {
  proyecto_id: '', edificio_id: '', capitulo_id: '',
  descripcion: '', prioridad: 'MEDIA', notas: ''
}

export default function RSPage() {
  const { toast }   = useToast()
  const { usuario } = useAuth()

  const [lista,         setLista]         = useState<RS[]>([])
  const [proyectos,     setProyectos]     = useState<Proyecto[]>([])
  const [edificaciones, setEdificaciones] = useState<Edificacion[]>([])
  const [capitulos,     setCapitulos]     = useState<Capitulo[]>([])
  const [edifModal,     setEdifModal]     = useState<Edificacion[]>([])
  const [capModal,      setCapModal]      = useState<Capitulo[]>([])

  const [filtroEstado,   setFiltroEstado]   = useState('')
  const [filtroProyecto, setFiltroProyecto] = useState('')

  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [items,     setItems]     = useState<ItemRS[]>([])
  const [error,     setError]     = useState('')
  const [cargando,  setCargando]  = useState(false)

  const [showDetalle,   setShowDetalle]   = useState(false)
  const [rsDetalle,     setRsDetalle]     = useState<RS | null>(null)
  const [detalleItems,  setDetalleItems]  = useState<RSDetalle[]>([])
  const [cargandoDet,   setCargandoDet]   = useState(false)
  const [modoAprobar,   setModoAprobar]   = useState(false)
  const [cantAprobadas, setCantAprobadas] = useState<Record<string, number>>({})
  const [notasAprobar,  setNotasAprobar]  = useState('')

  const [matBusqueda,    setMatBusqueda]    = useState<Record<number, string>>({})
  const [matSugerencias, setMatSugerencias] = useState<Record<number, Material[]>>({})
  const [matAbierto,     setMatAbierto]     = useState<number | null>(null)
  const debMatRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const [cargandoPagina, setCargandoPagina] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/api/rs'),
      api.get('/api/proyectos'),
      api.get('/api/edificaciones'),
      api.get('/api/capitulos'),
    ]).then(([rRS, rP, rE, rC]) => {
      setLista(rRS.data.data)
      setProyectos(rP.data.data)
      setEdificaciones(rE.data.data)
      setCapitulos(rC.data.data)
    }).finally(() => setCargandoPagina(false))
  }, [])

  const cargarLista = async (estado = filtroEstado, proyId = filtroProyecto) => {
    const params = new URLSearchParams()
    if (estado) params.append('estado', estado)
    if (proyId) params.append('proyecto_id', proyId)
    const res = await api.get(`/api/rs?${params}`)
    setLista(res.data.data)
  }

  const set = (key: string, val: any) => setForm(s => ({ ...s, [key]: val }))

  const handleProyecto = (proyId: string) => {
    set('proyecto_id', proyId); set('edificio_id', ''); set('capitulo_id', '')
    setEdifModal(edificaciones.filter(e => e.proyecto_id === proyId))
    setCapModal([])
  }

  const handleEdificio = (edifId: string) => {
    set('edificio_id', edifId); set('capitulo_id', '')
    setCapModal(capitulos.filter(c => c.edificio_id === edifId))
  }

  // ── Autocomplete materiales (fix C-05) ─────────────────────
  const buscarMaterial = (idx: number, q: string) => {
    setMatBusqueda(s => ({ ...s, [idx]: q }))
    if (debMatRef.current[idx]) clearTimeout(debMatRef.current[idx])
    if (q.length < 3) { setMatSugerencias(s => ({ ...s, [idx]: [] })); return }
    debMatRef.current[idx] = setTimeout(async () => {
      try {
        const res = await api.get(`/api/materiales?q=${encodeURIComponent(q)}&activo=1`)
        setMatSugerencias(s => ({ ...s, [idx]: res.data.data }))
        if (res.data.data.length > 0) setMatAbierto(idx)
      } catch { /* silencioso */ }
    }, 300)
  }

  const seleccionarMaterial = (idx: number, mat: Material) => {
    const nuevos = [...items]
    nuevos[idx] = { ...nuevos[idx], material_id: mat.material_id, nombre_material: mat.nombre, unidad: mat.unidad }
    setItems(nuevos)
    setMatBusqueda(s => ({ ...s, [idx]: mat.nombre }))
    setMatSugerencias(s => ({ ...s, [idx]: [] }))
    setMatAbierto(null)
  }

  const agregarItem = () => {
    const idx = items.length
    setItems(s => [...s, { material_id: '', nombre_material: '', unidad: '', cantidad_solicitada: 0, notas: '' }])
    setMatBusqueda(s => ({ ...s, [idx]: '' }))
    setMatSugerencias(s => ({ ...s, [idx]: [] }))
  }

  const eliminarItem = (idx: number) => {
    setItems(s => s.filter((_, i) => i !== idx))
    setMatBusqueda(s => { const n = { ...s }; delete n[idx]; return n })
    setMatSugerencias(s => { const n = { ...s }; delete n[idx]; return n })
  }

  const actualizarItem = (idx: number, key: string, val: any) => {
    const nuevos = [...items]
    nuevos[idx] = { ...nuevos[idx], [key]: val }
    setItems(nuevos)
  }

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (items.length === 0) { setError('Debe agregar al menos un material'); return }
    for (const item of items) {
      if (!item.material_id)    { setError('Todos los ítems deben tener un material seleccionado'); return }
      if (!item.cantidad_solicitada || item.cantidad_solicitada <= 0)
                                 { setError('Todos los ítems deben tener cantidad mayor a cero'); return }
    }
    setCargando(true); setError('')
    try {
      await api.post('/api/rs', { ...form, items })
      toast.success('Requisición creada correctamente')
      setShowForm(false); setItems([]); setForm(EMPTY_FORM)
      cargarLista()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al guardar'
      setError(msg); toast.error(msg)
    } finally { setCargando(false) }
  }

  const verDetalle = async (rsId: string, aprobar = false) => {
    setCargandoDet(true); setShowDetalle(true)
    setModoAprobar(aprobar); setNotasAprobar('')
    try {
      const res  = await api.get(`/api/rs/${rsId}`)
      const data = res.data.data
      setRsDetalle(data); setDetalleItems(data.detalle)
      const aprobadas: Record<string, number> = {}
      data.detalle.forEach((d: RSDetalle) => {
        aprobadas[d.det_id] = d.cantidad_aprobada ?? d.cantidad_solicitada
      })
      setCantAprobadas(aprobadas)
    } finally { setCargandoDet(false) }
  }

  const aprobar = async () => {
    setCargando(true)
    try {
      const items_aprobados = detalleItems.map(d => ({
        det_id: d.det_id,
        cantidad_aprobada: cantAprobadas[d.det_id] ?? d.cantidad_solicitada
      }))
      await api.put(`/api/rs/${rsDetalle?.rs_id}/aprobar`, { items_aprobados, notas: notasAprobar })
      toast.success('Requisición aprobada')
      setShowDetalle(false); cargarLista()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al aprobar')
    } finally { setCargando(false) }
  }

  const cambiarEstado = async (rsId: string, accion: 'rechazar' | 'anular') => {
    if (!confirm(accion === 'rechazar' ? '¿Rechazar esta requisición?' : '¿Anular esta requisición?')) return
    try {
      await api.put(`/api/rs/${rsId}/${accion}`, {})
      toast.success(accion === 'rechazar' ? 'Requisición rechazada' : 'Requisición anulada')
      setShowDetalle(false); cargarLista()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  const puedeCrear   = ['ADMIN','COORDINADOR','ING_RESIDENTE'].includes(usuario?.rol || '')
  const puedeAprobar = ['ADMIN','COORDINADOR'].includes(usuario?.rol || '')

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Requisiciones de Materiales</h1>
          <p className="page-subtitle">{lista.length} requisición{lista.length !== 1 ? 'es' : ''}</p>
        </div>
        {puedeCrear && (
          <button className="btn btn-primary" onClick={() => {
            setForm(EMPTY_FORM); setItems([]); setError('')
            setEdifModal([]); setCapModal([]); setShowForm(true)
          }}>
            <Plus size={15} /> Nueva requisición
          </button>
        )}
      </div>

      <div className="page-filters">
        <select className="form-select rs-filter-select--estado" value={filtroEstado}
          onChange={e => { setFiltroEstado(e.target.value); cargarLista(e.target.value, filtroProyecto) }}
          aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className="form-select rs-filter-select--proyecto" value={filtroProyecto}
          onChange={e => { setFiltroProyecto(e.target.value); cargarLista(filtroEstado, e.target.value) }}
          aria-label="Filtrar por proyecto">
          <option value="">Todos los proyectos</option>
          {proyectos.map(p => <option key={p.proyecto_id} value={p.proyecto_id}>{p.proyecto_id} — {p.nombre}</option>)}
        </select>
      </div>

      {cargandoPagina ? (
        <div className="page-loading"><Loader2 size={20} className="spinner" /><span>Cargando...</span></div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>RS ID</th><th>Proyecto / Capítulo</th><th>Solicitante</th>
                <th>Prioridad</th><th>Fecha</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={7}>
                  <div className="search-empty-state">
                    <FileText size={32} className="rs-muted-icon" />
                    <span>No hay requisiciones registradas</span>
                  </div>
                </td></tr>
              ) : lista.map(r => (
                <tr key={r.rs_id}>
                  <td className="td-id">{r.rs_id}</td>
                  <td>
                    <span className="td-bold">{r.nombre_proyecto}</span>
                    <span className="td-muted rs-block-muted">{r.nombre_capitulo}</span>
                  </td>
                  <td className="td-secondary">{r.solicitante}</td>
                  <td><span className={`badge ${BADGE_PRIORIDAD[r.prioridad] || 'badge-neutral'}`}>{r.prioridad}</span></td>
                  <td className="td-secondary">{new Date(r.fecha_solicitud + 'T00:00:00').toLocaleDateString('es-CO')}</td>
                  <td><span className={`badge ${BADGE_ESTADO[r.estado] || 'badge-neutral'}`}>{r.estado}</span></td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => verDetalle(r.rs_id)}>
                        <Eye size={13} /> Ver
                      </button>
                      {puedeAprobar && r.estado === 'BORRADOR' && (
                        <button className="btn btn-ghost btn-sm rs-success-action" onClick={() => verDetalle(r.rs_id, true)}>
                          <Check size={13} /> Aprobar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal nueva RS ─────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal rs-modal-wide">
            <div className="modal-header">
              <span className="modal-title">Nueva requisición de materiales</span>
              <button className="btn btn-ghost btn-sm rs-icon-close" onClick={() => setShowForm(false)}
                aria-label="Cerrar"><X size={16} /></button>
            </div>

            <form onSubmit={guardar}>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-error">
                    <AlertCircle size={15} style={{ flexShrink: 0 }} /><span>{error}</span>
                  </div>
                )}

                <div className="form-grid-3 rs-grid-gap">
                  <div className="form-group">
                    <label className="form-label required" htmlFor="rs-proy">Proyecto</label>
                    <select id="rs-proy" className="form-select" value={form.proyecto_id}
                      onChange={e => handleProyecto(e.target.value)} required aria-label="Proyecto">
                      <option value="">Selecciona...</option>
                      {proyectos.map(p => <option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="rs-edif">Edificación</label>
                    <select id="rs-edif" className="form-select" value={form.edificio_id}
                      onChange={e => handleEdificio(e.target.value)}
                      required disabled={!form.proyecto_id} aria-label="Edificación">
                      <option value="">{!form.proyecto_id ? 'Primero elige proyecto' : 'Selecciona...'}</option>
                      {edifModal.map(e => <option key={e.edificio_id} value={e.edificio_id}>{e.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="rs-cap">Capítulo</label>
                    <select id="rs-cap" className="form-select" value={form.capitulo_id}
                      onChange={e => set('capitulo_id', e.target.value)}
                      required disabled={!form.edificio_id} aria-label="Capítulo">
                      <option value="">{!form.edificio_id ? 'Primero elige edificación' : 'Selecciona...'}</option>
                      {capModal.map(c => <option key={c.capitulo_id} value={c.capitulo_id}>{c.codigo} — {c.nombre_capitulo}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-grid-2 rs-grid-gap">
                  <div className="form-group">
                    <label className="form-label" htmlFor="rs-desc">Descripción general</label>
                    <input id="rs-desc" className="form-input" value={form.descripcion}
                      onChange={e => set('descripcion', e.target.value)}
                      placeholder="Resumen de lo que se solicita" />
                  </div>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="rs-prior">Prioridad</label>
                    <select id="rs-prior" className="form-select" value={form.prioridad}
                      onChange={e => set('prioridad', e.target.value)} aria-label="Prioridad">
                      {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                <div className="rs-items-header">
                  <label className="form-label rs-items-label">Materiales solicitados</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={agregarItem}>
                    <Plus size={13} /> Agregar material
                  </button>
                </div>

                {items.length === 0 ? (
                  <div className="alert alert-info rs-grid-gap">
                    <AlertCircle size={15} className="rs-no-shrink" />
                    <span>Haz clic en "Agregar material" para comenzar</span>
                  </div>
                ) : (
                  <div className="rs-items-table-wrapper">
                    <table className="rs-items-table">
                      <thead>
                        <tr>
                          <th className="rs-th-material">Material</th>
                          <th className="rs-th-unidad">Unidad</th>
                          <th className="rs-th-cantidad">Cantidad</th>
                          <th className="rs-th-notas">Notas</th>
                          <th className="rs-th-actions"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="rs-autocomplete-cell">
                              <div className="rs-autocomplete-search">
                                <Search size={12} />
                                <input
                                  className="form-input rs-autocomplete-input"
                                  value={matBusqueda[idx] || ''}
                                  onChange={e => buscarMaterial(idx, e.target.value)}
                                  placeholder="Buscar material..."
                                  aria-label={`Material ${idx + 1}`}
                                  onBlur={() => setTimeout(() => setMatAbierto(null), 200)}
                                />
                              </div>
                              {matAbierto === idx && (matSugerencias[idx] || []).length > 0 && (
                                <div className="rs-autocomplete-menu">
                                  {matSugerencias[idx].map(mat => (
                                    <button key={mat.material_id} type="button"
                                      onMouseDown={() => seleccionarMaterial(idx, mat)}
                                      className="rs-autocomplete-option">
                                      <span className="font-mono rs-autocomplete-code">{mat.codigo}</span>
                                      {mat.nombre}
                                      <span className="rs-autocomplete-unidad">({mat.unidad})</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="rs-td-unidad">
                              <span className="badge badge-neutral">{item.unidad || '—'}</span>
                            </td>
                            <td>
                              <NumericInput
                                value={item.cantidad_solicitada}
                                onChange={val => actualizarItem(idx, 'cantidad_solicitada', val)}
                                decimals={2} required
                              />
                            </td>
                            <td>
                              <input className="form-input rs-notes-input"
                                value={item.notas} placeholder="Observación"
                                onChange={e => actualizarItem(idx, 'notas', e.target.value)}
                                aria-label={`Notas ítem ${idx + 1}`} />
                            </td>
                            <td>
                              <button type="button" className="btn btn-danger btn-sm rs-trash-button"
                                onClick={() => eliminarItem(idx)} aria-label="Eliminar ítem">
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="rs-notas">Notas adicionales</label>
                  <textarea id="rs-notas" className="form-textarea" value={form.notas}
                    onChange={e => set('notas', e.target.value)} rows={2}
                    placeholder="Observaciones generales de la requisición" />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={cargando}>
                  {cargando ? <><Loader2 size={14} className="spinner" /> Guardando...</> : 'Crear requisición'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal detalle / aprobar ────────────────────────── */}
      {showDetalle && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDetalle(false)}>
          <div className="modal rs-modal-wide">
            <div className="modal-header">
              <span className="modal-title">
                {modoAprobar ? `Aprobar — ${rsDetalle?.rs_id}` : `Detalle — ${rsDetalle?.rs_id}`}
              </span>
              <button className="btn btn-ghost btn-sm rs-icon-close" onClick={() => setShowDetalle(false)}
                aria-label="Cerrar"><X size={16} /></button>
            </div>

            <div className="modal-body">
              {cargandoDet ? (
                <div className="page-loading"><Loader2 size={18} className="spinner" /><span>Cargando...</span></div>
              ) : rsDetalle && (
                <>
                  <div className="system-values-box rs-system-box-gap">
                    <div className="form-grid-3">
                      {[
                        { id: 'rs-dp', label: 'Proyecto',    value: rsDetalle.nombre_proyecto },
                        { id: 'rs-de', label: 'Edificación', value: rsDetalle.nombre_edificio },
                        { id: 'rs-dc', label: 'Capítulo',    value: rsDetalle.nombre_capitulo },
                        { id: 'rs-ds', label: 'Solicitante', value: rsDetalle.solicitante },
                        { id: 'rs-dpr',label: 'Prioridad',   value: rsDetalle.prioridad },
                        { id: 'rs-dst',label: 'Estado',      value: rsDetalle.estado },
                      ].map(f => (
                        <div className="form-group" key={f.id}>
                          <label className="form-label" htmlFor={f.id}>{f.label}</label>
                          <input id={f.id} className="form-input" value={f.value} disabled />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="data-table-wrapper rs-table-gap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Material</th><th>Unidad</th>
                          <th>Cant. solicitada</th><th>Cant. aprobada</th><th>Notas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalleItems.map(d => (
                          <tr key={d.det_id}>
                            <td className="td-bold">{d.nombre_material}</td>
                            <td className="rs-td-unidad">
                              <span className="badge badge-neutral">{d.unidad}</span>
                            </td>
                            <td className="rs-det-cantidad-right">
                              {d.cantidad_solicitada.toLocaleString('es-CO')}
                            </td>
                            <td>
                              {modoAprobar ? (
                                <NumericInput
                                  value={cantAprobadas[d.det_id] ?? d.cantidad_solicitada}
                                  onChange={val => setCantAprobadas(s => ({ ...s, [d.det_id]: val }))}
                                  decimals={2} max={d.cantidad_solicitada}
                                />
                              ) : (
                                <span className={d.cantidad_aprobada != null ? 'rs-det-cantidad-aprobada' : 'rs-det-cantidad-pendiente'}>
                                  {d.cantidad_aprobada != null ? d.cantidad_aprobada.toLocaleString('es-CO') : '—'}
                                </span>
                              )}
                            </td>
                            <td className="td-secondary">{d.notas || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {modoAprobar && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="rs-notas-apr">Notas de aprobación</label>
                      <textarea id="rs-notas-apr" className="form-textarea" value={notasAprobar}
                        onChange={e => setNotasAprobar(e.target.value)} rows={2}
                        placeholder="Observaciones al aprobar" />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer">
              {modoAprobar && rsDetalle?.estado === 'BORRADOR' ? (
                <>
                  <button className="btn btn-danger btn-sm"
                    onClick={() => cambiarEstado(rsDetalle.rs_id, 'rechazar')}>
                    <XCircle size={14} /> Rechazar
                  </button>
                  <button className="btn btn-secondary" onClick={() => setShowDetalle(false)}>Cancelar</button>
                  <button className="btn btn-primary" onClick={aprobar} disabled={cargando}>
                    {cargando ? <><Loader2 size={14} className="spinner" /> Aprobando...</> : <><Check size={14} /> Aprobar RS</>}
                  </button>
                </>
              ) : (
                <>
                  {puedeAprobar && rsDetalle && ['BORRADOR','APROBADA','EN_PROCESO'].includes(rsDetalle.estado) && (
                    <button className="btn btn-danger btn-sm"
                      onClick={() => cambiarEstado(rsDetalle.rs_id, 'anular')}>
                      <XCircle size={14} /> Anular
                    </button>
                  )}
                  <button className="btn btn-secondary" onClick={() => setShowDetalle(false)}>Cerrar</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}