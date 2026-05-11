import { useEffect, useState } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import {
  Plus, DollarSign, Loader2, AlertCircle,
  X, Eye, Star, Trash2, Check
} from 'lucide-react'
import NumericInput from '../../components/ui/NumericInput'

interface RSDisponible {
  rs_id: string; nombre_proyecto: string
  nombre_edificio: string; nombre_capitulo: string; prioridad: string
}

interface Proveedor {
  proveedor_id: string; nombre: string; nit: string
}

interface ItemCZ {
  material_id: string; nombre_material: string; unidad: string
  cantidad: number; precio_unitario: number
  descuento_pct: number; precio_neto: number; valor_total: number; notas: string
}

interface CZ {
  cz_id: string; rs_id: string; nombre_proveedor: string
  nombre_proyecto: string; nombre_capitulo: string
  condiciones_pago: string; dias_entrega: number
  vigencia_dias: number; valor_total: number
  estado: string; es_ganadora: number; timestamp: string
}

const fmtCOP = (v: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(v || 0)

const BADGE_ESTADO: Record<string, string> = {
  RECIBIDA:     'badge-neutral',
  SELECCIONADA: 'badge-success',
  DESCARTADA:   'badge-danger',
}

const FORMAS_PAGO = ['CONTADO','15 DÍAS','30 DÍAS','45 DÍAS','60 DÍAS','CRÉDITO','CONTRAENTREGA']

const EMPTY_FORM = {
  rs_id: '', proveedor_id: '',
  condiciones_pago: '', dias_entrega: 0,
  vigencia_dias: 30, notas: ''
}

export default function CZPage() {
  const { toast }   = useToast()
  const { usuario } = useAuth()

  const [lista,           setLista]           = useState<CZ[]>([])
  const [rsDisponibles,   setRsDisponibles]   = useState<RSDisponible[]>([])
  const [proveedores,     setProveedores]      = useState<Proveedor[]>([])
  const [filtroEstado,    setFiltroEstado]     = useState('')
  const [filtroRs,        setFiltroRs]         = useState('')

  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [items,     setItems]     = useState<ItemCZ[]>([])
  const [error,     setError]     = useState('')
  const [cargando,  setCargando]  = useState(false)
  const [cargandoItems, setCargandoItems] = useState(false)

  const [showDetalle,  setShowDetalle]  = useState(false)
  const [czDetalle,    setCzDetalle]    = useState<CZ | null>(null)
  const [detalleItems, setDetalleItems] = useState<ItemCZ[]>([])
  const [cargandoDet,  setCargandoDet]  = useState(false)

  const [cargandoPagina, setCargandoPagina] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/api/cz'),
      api.get('/api/cz/rs-disponibles/lista'),
      api.get('/api/proveedores?activo=1'),
    ]).then(([rCZ, rRS, rProv]) => {
      setLista(rCZ.data.data)
      setRsDisponibles(rRS.data.data)
      setProveedores(rProv.data.data)
    }).finally(() => setCargandoPagina(false))
  }, [])

  const cargarLista = async (estado = filtroEstado, rsId = filtroRs) => {
    const params = new URLSearchParams()
    if (estado) params.append('estado', estado)
    if (rsId)   params.append('rs_id', rsId)
    const res = await api.get(`/api/cz?${params}`)
    setLista(res.data.data)
  }

  const set = (key: string, val: any) => setForm(s => ({ ...s, [key]: val }))

  // Al seleccionar RS, carga sus ítems automáticamente
  const handleRs = async (rsId: string) => {
    set('rs_id', rsId)
    if (!rsId) { setItems([]); return }
    setCargandoItems(true)
    try {
      const res = await api.get(`/api/cz/items-rs/${rsId}`)
      setItems(res.data.data.map((item: any) => ({
        material_id:    item.material_id,
        nombre_material: item.nombre_material,
        unidad:          item.unidad,
        cantidad:        item.cantidad,
        precio_unitario: 0,
        descuento_pct:   0,
        precio_neto:     0,
        valor_total:     0,
        notas:           '',
      })))
    } finally { setCargandoItems(false) }
  }

  const actualizarItem = (idx: number, key: string, val: number) => {
    const nuevos = [...items]
    const item   = { ...nuevos[idx], [key]: val }
    const precioNeto  = item.precio_unitario * (1 - (item.descuento_pct || 0) / 100)
    item.precio_neto  = precioNeto
    item.valor_total  = precioNeto * item.cantidad
    nuevos[idx] = item
    setItems(nuevos)
  }

  const totalCotizacion = items.reduce((s, i) => s + (i.valor_total || 0), 0)

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (items.length === 0) { setError('No hay ítems para cotizar'); return }
    for (const item of items) {
      if (!item.precio_unitario || item.precio_unitario <= 0)
        { setError(`Ingresa el precio de "${item.nombre_material}"`); return }
    }
    setCargando(true); setError('')
    try {
      await api.post('/api/cz', { ...form, items })
      toast.success('Cotización registrada correctamente')
      setShowForm(false); setForm(EMPTY_FORM); setItems([])
      cargarLista()
      // Recargar RS disponibles
      const rRS = await api.get('/api/cz/rs-disponibles/lista')
      setRsDisponibles(rRS.data.data)
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al guardar'
      setError(msg); toast.error(msg)
    } finally { setCargando(false) }
  }

  const verDetalle = async (czId: string) => {
    setCargandoDet(true); setShowDetalle(true)
    try {
      const res  = await api.get(`/api/cz/${czId}`)
      const data = res.data.data
      setCzDetalle(data); setDetalleItems(data.detalle)
    } finally { setCargandoDet(false) }
  }

  const seleccionarGanadora = async (czId: string) => {
    if (!confirm('¿Marcar esta cotización como ganadora? Las demás quedarán descartadas.')) return
    try {
      await api.put(`/api/cz/${czId}/seleccionar-ganadora`, {})
      toast.success('Cotización ganadora seleccionada')
      setShowDetalle(false); cargarLista()
      const rRS = await api.get('/api/cz/rs-disponibles/lista')
      setRsDisponibles(rRS.data.data)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error')
    }
  }

  const eliminarCZ = async (czId: string) => {
    if (!confirm('¿Eliminar esta cotización?')) return
    try {
      await api.delete(`/api/cz/${czId}`)
      toast.success('Cotización eliminada')
      setShowDetalle(false); cargarLista()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error')
    }
  }

  const puedeGestionar = ['ADMIN','COORDINADOR','ENC_COMPRAS'].includes(usuario?.rol || '')

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cotizaciones</h1>
          <p className="page-subtitle">{lista.length} cotización{lista.length !== 1 ? 'es' : ''}</p>
        </div>
        {puedeGestionar && (
          <button className="btn btn-primary" onClick={() => {
            setForm(EMPTY_FORM); setItems([]); setError(''); setShowForm(true)
          }}>
            <Plus size={15} /> Nueva cotización
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="page-filters">
        <select className="form-select" value={filtroEstado}
          onChange={e => { setFiltroEstado(e.target.value); cargarLista(e.target.value, filtroRs) }}
          aria-label="Filtrar por estado" style={{ width: 160 }}>
          <option value="">Todos los estados</option>
          <option value="RECIBIDA">RECIBIDA</option>
          <option value="SELECCIONADA">SELECCIONADA</option>
          <option value="DESCARTADA">DESCARTADA</option>
        </select>
        <select className="form-select" value={filtroRs}
          onChange={e => { setFiltroRs(e.target.value); cargarLista(filtroEstado, e.target.value) }}
          aria-label="Filtrar por RS" style={{ width: 240 }}>
          <option value="">Todas las RS</option>
          {lista.filter((v, i, a) => a.findIndex(t => t.rs_id === v.rs_id) === i)
            .map(cz => <option key={cz.rs_id} value={cz.rs_id}>{cz.rs_id} — {cz.nombre_proyecto}</option>)}
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
                <th>CZ ID</th><th>RS</th><th>Proveedor</th>
                <th>Proyecto / Capítulo</th><th>Valor total</th>
                <th>Entrega</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="search-empty-state">
                    <DollarSign size={32} style={{ color: 'var(--color-text-muted)' }} />
                    <span>No hay cotizaciones registradas</span>
                  </div>
                </td></tr>
              ) : lista.map(cz => (
                <tr key={cz.cz_id}>
                  <td className="td-id">
                    {cz.cz_id}
                    {!!cz.es_ganadora && <span className="badge badge-success" style={{ marginLeft: 6 }}>GANADORA</span>}
                  </td>
                  <td className="td-id">{cz.rs_id}</td>
                  <td className="td-bold">{cz.nombre_proveedor}</td>
                  <td>
                    <span className="td-bold">{cz.nombre_proyecto}</span>
                    <span className="td-muted" style={{ display: 'block' }}>{cz.nombre_capitulo}</span>
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{fmtCOP(cz.valor_total)}</td>
                  <td className="td-secondary">{cz.dias_entrega ? `${cz.dias_entrega} días` : '—'}</td>
                  <td><span className={`badge ${BADGE_ESTADO[cz.estado] || 'badge-neutral'}`}>{cz.estado}</span></td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => verDetalle(cz.cz_id)}>
                        <Eye size={13} /> Ver
                      </button>
                      {puedeGestionar && cz.estado === 'RECIBIDA' && (
                        <button className="btn btn-ghost btn-sm" onClick={() => seleccionarGanadora(cz.cz_id)}
                          style={{ color: 'var(--color-warning)' }}>
                          <Star size={13} /> Ganadora
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

      {/* ── Modal nueva CZ ─────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ width: 'min(1080px, 92vw)' }}>
            <div className="modal-header">
              <span className="modal-title">Nueva cotización</span>
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

                {/* RS + Proveedor */}
                <div className="form-grid-2" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="cz-rs">
                      Requisición (RS aprobadas sin OC)
                    </label>
                    <select id="cz-rs" className="form-select" value={form.rs_id}
                      onChange={e => handleRs(e.target.value)} required aria-label="Requisición">
                      <option value="">Selecciona una RS...</option>
                      {rsDisponibles.map(r => (
                        <option key={r.rs_id} value={r.rs_id}>
                          {r.rs_id} — {r.nombre_proyecto} / {r.nombre_capitulo}
                        </option>
                      ))}
                    </select>
                    {rsDisponibles.length === 0 && (
                      <span className="form-hint" style={{ color: 'var(--color-warning)' }}>
                        No hay RS aprobadas disponibles para cotizar
                      </span>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="cz-prov">Proveedor</label>
                    <select id="cz-prov" className="form-select" value={form.proveedor_id}
                      onChange={e => set('proveedor_id', e.target.value)} required aria-label="Proveedor">
                      <option value="">Selecciona un proveedor...</option>
                      {proveedores.map(p => (
                        <option key={p.proveedor_id} value={p.proveedor_id}>
                          {p.nombre} — {p.nit}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Condiciones + Días entrega + Vigencia */}
                <div className="form-grid-3" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="cz-condpago">Condiciones de pago</label>
                    <select id="cz-condpago" className="form-select" value={form.condiciones_pago}
                      onChange={e => set('condiciones_pago', e.target.value)} aria-label="Condiciones de pago">
                      <option value="">Sin especificar</option>
                      {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="cz-dias">Días de entrega</label>
                    <NumericInput id="cz-dias" value={form.dias_entrega}
                      onChange={val => set('dias_entrega', val)} suffix="días" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="cz-vigencia">Vigencia oferta</label>
                    <NumericInput id="cz-vigencia" value={form.vigencia_dias}
                      onChange={val => set('vigencia_dias', val)} suffix="días" />
                  </div>
                </div>

                {/* Tabla de precios */}
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ margin: 0 }}>Precios por material</label>
                  {totalCotizacion > 0 && (
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)' }}>
                      Total: {fmtCOP(totalCotizacion)}
                    </span>
                  )}
                </div>

                {!form.rs_id ? (
                  <div className="alert alert-info" style={{ marginBottom: 16 }}>
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>Selecciona una RS para cargar los materiales a cotizar</span>
                  </div>
                ) : cargandoItems ? (
                  <div className="page-loading" style={{ height: 80 }}>
                    <Loader2 size={16} className="spinner" /><span>Cargando materiales...</span>
                  </div>
                ) : (
                  <div className="data-table-wrapper" style={{ marginBottom: 16 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th style={{ width: 80, textAlign: 'center' }}>Unidad</th>
                          <th style={{ width: 100, textAlign: 'right' }}>Cantidad</th>
                          <th style={{ width: 160 }}>Precio unitario</th>
                          <th style={{ width: 100 }}>Descuento %</th>
                          <th style={{ width: 160, textAlign: 'right' }}>Total ítem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="td-bold">{item.nombre_material}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="badge badge-neutral">{item.unidad}</span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              {item.cantidad.toLocaleString('es-CO')}
                            </td>
                            <td>
                              <NumericInput
                                value={item.precio_unitario}
                                onChange={val => actualizarItem(idx, 'precio_unitario', val)}
                                prefix="$" required
                              />
                            </td>
                            <td>
                              <NumericInput
                                value={item.descuento_pct}
                                onChange={val => actualizarItem(idx, 'descuento_pct', val)}
                                suffix="%" decimals={2}
                              />
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                              {fmtCOP(item.valor_total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Notas */}
                <div className="form-group">
                  <label className="form-label" htmlFor="cz-notas">Notas</label>
                  <textarea id="cz-notas" className="form-textarea" value={form.notas}
                    onChange={e => set('notas', e.target.value)} rows={2}
                    placeholder="Observaciones de la cotización" />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={cargando}>
                  {cargando ? <><Loader2 size={14} className="spinner" /> Guardando...</> : 'Registrar cotización'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal detalle ───────────────────────────────────── */}
      {showDetalle && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDetalle(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">Detalle — {czDetalle?.cz_id}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDetalle(false)}
                style={{ padding: '0 6px' }} aria-label="Cerrar"><X size={16} /></button>
            </div>

            <div className="modal-body">
              {cargandoDet ? (
                <div className="page-loading"><Loader2 size={18} className="spinner" /><span>Cargando...</span></div>
              ) : czDetalle && (
                <>
                  <div className="system-values-box" style={{ marginBottom: 16 }}>
                    <div className="form-grid-3">
                      {[
                        { id: 'cz-dp', label: 'Proveedor',   value: czDetalle.nombre_proveedor },
                        { id: 'cz-dr', label: 'RS',          value: czDetalle.rs_id },
                        { id: 'cz-de', label: 'Estado',      value: czDetalle.estado },
                        { id: 'cz-dc', label: 'Condiciones', value: czDetalle.condiciones_pago || '—' },
                        { id: 'cz-dd', label: 'Entrega',     value: czDetalle.dias_entrega ? `${czDetalle.dias_entrega} días` : '—' },
                        { id: 'cz-dv', label: 'Vigencia',    value: `${czDetalle.vigencia_dias} días` },
                      ].map(f => (
                        <div className="form-group" key={f.id}>
                          <label className="form-label" htmlFor={f.id}>{f.label}</label>
                          <input id={f.id} className="form-input" value={f.value} disabled />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="data-table-wrapper" style={{ marginBottom: 16 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th style={{ textAlign: 'center' }}>Unidad</th>
                          <th style={{ textAlign: 'right' }}>Cantidad</th>
                          <th style={{ textAlign: 'right' }}>P. Unitario</th>
                          <th style={{ textAlign: 'right' }}>Descuento</th>
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
                            <td style={{ textAlign: 'right' }}>{d.cantidad.toLocaleString('es-CO')}</td>
                            <td style={{ textAlign: 'right' }}>{fmtCOP(d.precio_unitario)}</td>
                            <td style={{ textAlign: 'right', color: d.descuento_pct > 0 ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                              {d.descuento_pct > 0 ? `${d.descuento_pct}%` : '—'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtCOP(d.valor_total)}</td>
                          </tr>
                        ))}
                        <tr style={{ background: 'var(--color-bg)' }}>
                          <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600, fontSize: 13 }}>
                            Total cotización
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 14, color: 'var(--color-primary)' }}>
                            {fmtCOP(czDetalle.valor_total)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              {puedeGestionar && czDetalle?.estado === 'RECIBIDA' && (
                <>
                  <button className="btn btn-danger btn-sm" onClick={() => eliminarCZ(czDetalle.cz_id)}>
                    <Trash2 size={14} /> Eliminar
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => seleccionarGanadora(czDetalle.cz_id)}
                    style={{ color: 'var(--color-warning)', borderColor: 'var(--color-warning-border)' }}>
                    <Star size={14} /> Seleccionar ganadora
                  </button>
                </>
              )}
              {puedeGestionar && czDetalle?.estado === 'SELECCIONADA' && (
                <div className="alert alert-success" style={{ margin: 0, flex: 1 }}>
                  <Check size={14} />
                  <span>Esta cotización fue seleccionada como ganadora</span>
                </div>
              )}
              <button className="btn btn-secondary" onClick={() => setShowDetalle(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}