import { useEffect, useState } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import {
  Plus, Warehouse, Loader2, AlertCircle,
  X, Eye, Trash2
} from 'lucide-react'
import NumericInput from '../../components/ui/NumericInput'
import { usePagination } from '../../hooks/usePagination'
import Pagination from '../../components/ui/Pagination'

interface Proyecto    { proyecto_id: string; nombre: string }
interface Edificacion { edificio_id: string; nombre: string; proyecto_id: string }
interface Capitulo    { capitulo_id: string; nombre_capitulo: string; codigo: string; edificio_id: string }
interface StockItem   { material_id: string; nombre_material: string; unidad: string; stock_actual: number; costo_promedio: number }

interface ItemSA {
  material_id: string; nombre_material: string; unidad: string
  stock_disponible: number; costo_promedio: number
  cantidad_solicitada: number; cantidad_despachada: number
}

interface SA {
  sa_id: string; proyecto_id: string; nombre_proyecto: string
  nombre_edificio: string; nombre_capitulo: string
  solicitante: string; destino_zona: string
  estado: string; timestamp: string
}

const fmtCOP = (v: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(v || 0)

const EMPTY_FORM = {
  proyecto_id: '', nombre_proyecto: '',
  edificio_id: '', nombre_edificio: '',
  capitulo_id: '', nombre_capitulo: '',
  destino_zona: '', notas: ''
}

export default function SAPage() {
  const { toast }   = useToast()
  const { usuario } = useAuth()

  const [lista,         setLista]         = useState<SA[]>([])
  const pag = usePagination(lista)
  const [proyectos,     setProyectos]     = useState<Proyecto[]>([])
  const [edificaciones, setEdificaciones] = useState<Edificacion[]>([])
  const [capitulos,     setCapitulos]     = useState<Capitulo[]>([])
  const [edifModal,     setEdifModal]     = useState<Edificacion[]>([])
  const [capModal,      setCapModal]      = useState<Capitulo[]>([])
  const [stockEdif,     setStockEdif]     = useState<StockItem[]>([])

  const [filtroProyecto, setFiltroProyecto] = useState('')

  const [showForm,     setShowForm]     = useState(false)
  const [form,         setForm]         = useState(EMPTY_FORM)
  const [items,        setItems]        = useState<ItemSA[]>([])
  const [error,        setError]        = useState('')
  const [cargando,     setCargando]     = useState(false)
  const [cargandoStock,setCargandoStock]= useState(false)

  const [showDetalle,  setShowDetalle]  = useState(false)
  const [saDetalle,    setSaDetalle]    = useState<SA | null>(null)
  const [detalleItems, setDetalleItems] = useState<any[]>([])
  const [cargandoDet,  setCargandoDet]  = useState(false)

  const [cargandoPagina, setCargandoPagina] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/api/sa'),
      api.get('/api/proyectos'),
      api.get('/api/edificaciones'),
      api.get('/api/capitulos'),
    ]).then(([rSA, rP, rE, rC]) => {
      setLista(rSA.data.data)
      setProyectos(rP.data.data)
      setEdificaciones(rE.data.data)
      setCapitulos(rC.data.data)
      pag.reset()
    }).finally(() => setCargandoPagina(false))
  }, [])

  const cargarLista = async (proyId = filtroProyecto) => {
    const params = new URLSearchParams()
    if (proyId) params.append('proyecto_id', proyId)
    const res = await api.get(`/api/sa?${params}`)
    setLista(res.data.data)
    pag.reset()
  }

  const set = (key: string, val: any) => setForm(s => ({ ...s, [key]: val }))

  // Cascada Proyecto → Edificación
  const handleProyecto = (proyId: string) => {
    const proy = proyectos.find(p => p.proyecto_id === proyId)
    setForm(s => ({ ...s, proyecto_id: proyId, nombre_proyecto: proy?.nombre || '', edificio_id: '', nombre_edificio: '', capitulo_id: '', nombre_capitulo: '' }))
    setEdifModal(edificaciones.filter(e => e.proyecto_id === proyId))
    setCapModal([]); setStockEdif([]); setItems([])
  }

  // Cascada Edificación → Capítulo + cargar stock
  const handleEdificio = async (edifId: string) => {
    const edif = edifModal.find(e => e.edificio_id === edifId)
    setForm(s => ({ ...s, edificio_id: edifId, nombre_edificio: edif?.nombre || '', capitulo_id: '', nombre_capitulo: '' }))
    setCapModal(capitulos.filter(c => c.edificio_id === edifId))
    setItems([])

    if (!edifId) { setStockEdif([]); return }

    setCargandoStock(true)
    try {
      const res = await api.get(`/api/sa/stock-edificio/${edifId}`)
      setStockEdif(res.data.data)
    } finally { setCargandoStock(false) }
  }

  const handleCapitulo = (capId: string) => {
    const cap = capModal.find(c => c.capitulo_id === capId)
    setForm(s => ({ ...s, capitulo_id: capId, nombre_capitulo: cap ? `${cap.codigo} — ${cap.nombre_capitulo}` : '' }))
  }

  // Agregar material desde el stock disponible
  const agregarItem = (mat: StockItem) => {
    if (items.find(i => i.material_id === mat.material_id)) {
      toast.warning(`"${mat.nombre_material}" ya está en la salida`)
      return
    }
    setItems(s => [...s, {
      material_id:        mat.material_id,
      nombre_material:    mat.nombre_material,
      unidad:             mat.unidad,
      stock_disponible:   mat.stock_actual,
      costo_promedio:     mat.costo_promedio,
      cantidad_solicitada: 0,
      cantidad_despachada: 0,
    }])
  }

  const eliminarItem = (idx: number) =>
    setItems(s => s.filter((_, i) => i !== idx))

  const actualizarCantidad = (idx: number, campo: 'cantidad_solicitada' | 'cantidad_despachada', val: number) => {
    const nuevos = [...items]
    nuevos[idx] = { ...nuevos[idx], [campo]: val }
    // Despacho no puede superar stock
    if (campo === 'cantidad_despachada' && val > nuevos[idx].stock_disponible) {
      nuevos[idx].cantidad_despachada = nuevos[idx].stock_disponible
      toast.warning(`Cantidad ajustada al stock disponible: ${nuevos[idx].stock_disponible}`)
    }
    setItems(nuevos)
  }

  const totalSalida = items.reduce((s, i) => s + (i.cantidad_despachada * i.costo_promedio), 0)

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (items.length === 0) { setError('Debe agregar al menos un material'); return }

    for (const item of items) {
      if (!item.cantidad_despachada || item.cantidad_despachada <= 0)
        { setError(`La cantidad de "${item.nombre_material}" debe ser mayor a cero`); return }
      if (item.cantidad_despachada > item.stock_disponible)
        { setError(`"${item.nombre_material}": cantidad supera el stock (${item.stock_disponible})`); return }
    }

    setCargando(true); setError('')
    try {
      await api.post('/api/sa', { ...form, items })
      toast.success('Salida de almacén registrada — stock y ejecutado actualizados')
      setShowForm(false); setForm(EMPTY_FORM)
      setItems([]); setStockEdif([])
      cargarLista()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al guardar'
      setError(msg); toast.error(msg)
    } finally { setCargando(false) }
  }

  const verDetalle = async (saId: string) => {
    setCargandoDet(true); setShowDetalle(true)
    try {
      const res  = await api.get(`/api/sa/${saId}`)
      const data = res.data.data
      setSaDetalle(data); setDetalleItems(data.detalle)
    } finally { setCargandoDet(false) }
  }

  const puedeCrear = ['ADMIN','COORDINADOR','ALMACENISTA'].includes(usuario?.rol || '')

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Salidas de Almacén</h1>
          <p className="page-subtitle">{lista.length} salida{lista.length !== 1 ? 's' : ''} registrada{lista.length !== 1 ? 's' : ''}</p>
        </div>
        {puedeCrear && (
          <button className="btn btn-primary" onClick={() => {
            setForm(EMPTY_FORM); setItems([])
            setStockEdif([]); setEdifModal([])
            setCapModal([]); setError(''); setShowForm(true)
          }}>
            <Plus size={15} /> Nueva salida
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="page-filters">
        <select className="form-select" value={filtroProyecto}
          onChange={e => { setFiltroProyecto(e.target.value); cargarLista(e.target.value) }}
          aria-label="Filtrar por proyecto" style={{ width: 260 }}>
          <option value="">Todos los proyectos</option>
          {proyectos.map(p => <option key={p.proyecto_id} value={p.proyecto_id}>{p.proyecto_id} — {p.nombre}</option>)}
        </select>
      </div>

      {/* Tabla */}
      {cargandoPagina ? (
        <div className="page-loading"><Loader2 size={20} className="spinner" /><span>Cargando...</span></div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>SA ID</th><th>Proyecto</th><th>Edificación</th>
                <th>Capítulo</th><th>Solicitante</th>
                <th>Destino</th><th>Fecha</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="search-empty-state">
                    <Warehouse size={32} style={{ color: 'var(--color-text-muted)' }} />
                    <span>No hay salidas de almacén registradas</span>
                  </div>
                </td></tr>
              ) : (
                <>
                  {pag.itemsPagina.map(s => (
                    <tr key={s.sa_id}>
                  <td className="td-id">{s.sa_id}</td>
                  <td className="td-bold">{s.nombre_proyecto}</td>
                  <td className="td-secondary">{s.nombre_edificio}</td>
                  <td className="td-secondary">{s.nombre_capitulo}</td>
                  <td className="td-secondary">{s.solicitante}</td>
                  <td className="td-secondary">{s.destino_zona || '—'}</td>
                  <td className="td-secondary">
                    {new Date(s.timestamp).toLocaleDateString('es-CO')}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => verDetalle(s.sa_id)}>
                      <Eye size={13} /> Ver
                    </button>
                  </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
          <Pagination {...pag} />
        </div>
      )}

      {/* ── Modal nueva SA ─────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ width: 'min(1060px, 92vw)' }}>
            <div className="modal-header">
              <span className="modal-title">Nueva salida de almacén</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}
                style={{ padding: '0 6px' }} aria-label="Cerrar"><X size={16} /></button>
            </div>

            <form onSubmit={guardar}>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-error">
                    <AlertCircle size={15} style={{ flexShrink: 0 }} /><span>{error}</span>
                  </div>
                )}

                {/* Cascada */}
                <div className="form-grid-3" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="sa-proy">Proyecto</label>
                    <select id="sa-proy" className="form-select" value={form.proyecto_id}
                      onChange={e => handleProyecto(e.target.value)} required aria-label="Proyecto">
                      <option value="">Selecciona...</option>
                      {proyectos.map(p => <option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="sa-edif">Edificación</label>
                    <select id="sa-edif" className="form-select" value={form.edificio_id}
                      onChange={e => handleEdificio(e.target.value)}
                      required disabled={!form.proyecto_id} aria-label="Edificación">
                      <option value="">{!form.proyecto_id ? 'Primero elige proyecto' : 'Selecciona...'}</option>
                      {edifModal.map(e => <option key={e.edificio_id} value={e.edificio_id}>{e.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="sa-cap">Capítulo</label>
                    <select id="sa-cap" className="form-select" value={form.capitulo_id}
                      onChange={e => handleCapitulo(e.target.value)}
                      required disabled={!form.edificio_id} aria-label="Capítulo">
                      <option value="">{!form.edificio_id ? 'Primero elige edificación' : 'Selecciona...'}</option>
                      {capModal.map(c => <option key={c.capitulo_id} value={c.capitulo_id}>{c.codigo} — {c.nombre_capitulo}</option>)}
                    </select>
                  </div>
                </div>

                {/* Destino zona */}
                <div className="form-grid-2" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="sa-destino">Destino / Zona</label>
                    <input id="sa-destino" className="form-input" value={form.destino_zona}
                      onChange={e => set('destino_zona', e.target.value)}
                      placeholder="Ej: Piso 3, Área de cimentación" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="sa-auth">Autorizado por</label>
                    <input id="sa-auth" className="form-input"
                      value={usuario?.nombre || ''} disabled />
                    <span className="form-hint">Usuario en sesión — no editable</span>
                  </div>
                </div>

                {/* Stock disponible en la edificación */}
                {form.edificio_id && (
                  <div style={{ marginBottom: 16 }}>
                    <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>
                      Stock disponible en {form.nombre_edificio}
                    </label>
                    {cargandoStock ? (
                      <div className="page-loading" style={{ height: 60 }}>
                        <Loader2 size={16} className="spinner" /><span>Cargando stock...</span>
                      </div>
                    ) : stockEdif.length === 0 ? (
                      <div className="alert alert-warning">
                        <AlertCircle size={15} style={{ flexShrink: 0 }} />
                        <span>No hay materiales con stock disponible en esta edificación</span>
                      </div>
                    ) : (
                      <div className="data-table-wrapper">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Material</th>
                              <th style={{ textAlign: 'center' }}>Unidad</th>
                              <th style={{ textAlign: 'right' }}>Disponible</th>
                              <th style={{ textAlign: 'right' }}>CPP</th>
                              <th style={{ width: 100 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {stockEdif.map(mat => {
                              const yaAgregado = items.some(i => i.material_id === mat.material_id)
                              return (
                                <tr key={mat.material_id}
                                  style={{ opacity: yaAgregado ? 0.4 : 1 }}>
                                  <td className="td-bold">{mat.nombre_material}</td>
                                  <td style={{ textAlign: 'center' }}>
                                    <span className="badge badge-neutral">{mat.unidad}</span>
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>
                                    {mat.stock_actual.toLocaleString('es-CO')}
                                  </td>
                                  <td style={{ textAlign: 'right' }}>{fmtCOP(mat.costo_promedio)}</td>
                                  <td>
                                    <button type="button"
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => agregarItem(mat)}
                                      disabled={yaAgregado}
                                      style={{ width: '100%' }}>
                                      {yaAgregado ? 'Agregado' : '+ Agregar'}
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Tabla de ítems a despachar */}
                {items.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label className="form-label" style={{ margin: 0 }}>
                        Materiales a despachar
                      </label>
                      {totalSalida > 0 && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>
                          Total: {fmtCOP(totalSalida)}
                        </span>
                      )}
                    </div>
                    <div className="data-table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Material</th>
                            <th style={{ textAlign: 'center', width: 80 }}>Unidad</th>
                            <th style={{ textAlign: 'right', width: 110 }}>Disponible</th>
                            <th style={{ width: 150 }}>Cant. solicitada</th>
                            <th style={{ width: 150 }}>Cant. despachada</th>
                            <th style={{ textAlign: 'right', width: 130 }}>CPP</th>
                            <th style={{ textAlign: 'right', width: 140 }}>Total</th>
                            <th style={{ width: 44 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, idx) => (
                            <tr key={item.material_id}>
                              <td className="td-bold">{item.nombre_material}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="badge badge-neutral">{item.unidad}</span>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>
                                {item.stock_disponible.toLocaleString('es-CO')}
                              </td>
                              <td>
                                <NumericInput
                                  value={item.cantidad_solicitada}
                                  onChange={val => actualizarCantidad(idx, 'cantidad_solicitada', val)}
                                  decimals={2}
                                />
                              </td>
                              <td>
                                <NumericInput
                                  value={item.cantidad_despachada}
                                  onChange={val => actualizarCantidad(idx, 'cantidad_despachada', val)}
                                  decimals={2}
                                  required
                                />
                                {item.cantidad_despachada > item.stock_disponible && (
                                  <span className="hint-error">Supera el stock</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right', color: 'var(--color-text-muted)', fontSize: 12 }}>
                                {fmtCOP(item.costo_promedio)}
                                <span className="form-hint" style={{ display: 'block' }}>CPP — no editable</span>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                                {fmtCOP(item.cantidad_despachada * item.costo_promedio)}
                              </td>
                              <td>
                                <button type="button" className="btn btn-danger btn-sm"
                                  onClick={() => eliminarItem(idx)}
                                  aria-label="Eliminar" style={{ padding: '0 6px' }}>
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Notas */}
                <div className="form-group">
                  <label className="form-label" htmlFor="sa-notas">Notas</label>
                  <textarea id="sa-notas" className="form-textarea" value={form.notas}
                    onChange={e => set('notas', e.target.value)} rows={2}
                    placeholder="Observaciones de la salida" />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary"
                  disabled={cargando || items.length === 0}>
                  {cargando
                    ? <><Loader2 size={14} className="spinner" /> Registrando...</>
                    : 'Registrar salida'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal detalle SA ───────────────────────────────── */}
      {showDetalle && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDetalle(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">Detalle — {saDetalle?.sa_id}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDetalle(false)}
                style={{ padding: '0 6px' }} aria-label="Cerrar"><X size={16} /></button>
            </div>

            <div className="modal-body">
              {cargandoDet ? (
                <div className="page-loading"><Loader2 size={18} className="spinner" /><span>Cargando...</span></div>
              ) : saDetalle && (
                <>
                  <div className="system-values-box" style={{ marginBottom: 16 }}>
                    <div className="form-grid-3">
                      {[
                        { id: 'sa-dp',  label: 'Proyecto',    value: saDetalle.nombre_proyecto },
                        { id: 'sa-de',  label: 'Edificación', value: saDetalle.nombre_edificio },
                        { id: 'sa-dc',  label: 'Capítulo',    value: saDetalle.nombre_capitulo },
                        { id: 'sa-ds',  label: 'Solicitante', value: saDetalle.solicitante },
                        { id: 'sa-ddz', label: 'Destino',     value: saDetalle.destino_zona || '—' },
                        { id: 'sa-dfe', label: 'Fecha',       value: new Date(saDetalle.timestamp).toLocaleDateString('es-CO') },
                      ].map(f => (
                        <div className="form-group" key={f.id}>
                          <label className="form-label" htmlFor={f.id}>{f.label}</label>
                          <input id={f.id} className="form-input" value={f.value} disabled />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th style={{ textAlign: 'center' }}>Unidad</th>
                          <th style={{ textAlign: 'right' }}>Solicitado</th>
                          <th style={{ textAlign: 'right' }}>Despachado</th>
                          <th style={{ textAlign: 'right' }}>CPP</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalleItems.map((d: any) => (
                          <tr key={d.det_id}>
                            <td className="td-bold">{d.nombre_material}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="badge badge-neutral">{d.unidad}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {d.cantidad_solicitada.toLocaleString('es-CO')}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              {d.cantidad_despachada.toLocaleString('es-CO')}
                            </td>
                            <td style={{ textAlign: 'right' }}>{fmtCOP(d.precio_unitario)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                              {fmtCOP(d.valor_total)}
                            </td>
                          </tr>
                        ))}
                        <tr style={{ background: 'var(--color-bg)', borderTop: '2px solid var(--color-border)' }}>
                          <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700 }}>
                            Total salida
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: 'var(--color-primary)' }}>
                            {fmtCOP(detalleItems.reduce((s: number, d: any) => s + d.valor_total, 0))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetalle(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}