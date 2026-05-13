import { useEffect, useState } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import {
  Plus, Warehouse, Loader2, AlertCircle,
  X, Eye
} from 'lucide-react'
import NumericInput from '../../components/ui/NumericInput'
import { usePagination } from '../../hooks/usePagination'
import Pagination from '../../components/ui/Pagination'

interface OcDisponible {
  oc_id: string; nombre_proveedor: string; estado: string
  nombre_proyecto: string; nombre_edificio: string
  edificio_id: string; valor_total: number
  fecha_entrega_esperada: string
}

interface ItemEA {
  det_id: string; material_id: string; nombre_material: string
  unidad: string; pendiente: number; precio_unitario: number
  cantidad_recibida: number; incluir: boolean
}

interface EA {
  ea_id: string; oc_id: string; nombre_proveedor: string
  nombre_edificio: string; nombre_proyecto: string
  nro_remision: string; nro_factura: string
  almacenista: string; estado: string; timestamp: string
}

const fmtCOP = (v: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(v || 0)

const BADGE_ESTADO: Record<string, string> = {
  RECIBIDA_TOTAL: 'badge-success',
  CON_NOVEDAD:    'badge-warning',
}

const BADGE_NOVEDAD: Record<string, string> = {
  OK:       'badge-success',
  FALTANTE: 'badge-warning',
  SOBRANTE: 'badge-info',
  AVERIADO: 'badge-danger',
}

const EMPTY_FORM = { oc_id: '', nro_remision: '', nro_factura: '', notas: '' }

export default function EAPage() {
  const { toast }   = useToast()
  const { usuario } = useAuth()

  const [lista,         setLista]         = useState<EA[]>([])
  const pag = usePagination(lista)
  const [ocDisponibles, setOcDisponibles] = useState<OcDisponible[]>([])

  const [showForm,     setShowForm]     = useState(false)
  const [form,         setForm]         = useState(EMPTY_FORM)
  const [ocSel,        setOcSel]        = useState<OcDisponible | null>(null)
  const [items,        setItems]        = useState<ItemEA[]>([])
  const [cargandoOC,   setCargandoOC]   = useState(false)
  const [error,        setError]        = useState('')
  const [cargando,     setCargando]     = useState(false)

  const [showDetalle,  setShowDetalle]  = useState(false)
  const [eaDetalle,    setEaDetalle]    = useState<EA | null>(null)
  const [detalleItems, setDetalleItems] = useState<any[]>([])
  const [cargandoDet,  setCargandoDet]  = useState(false)

  const [cargandoPagina, setCargandoPagina] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/api/ea'),
      api.get('/api/ea/oc-disponibles/lista'),
    ]).then(([rEA, rOC]) => {
      setLista(rEA.data.data)
      setOcDisponibles(rOC.data.data)
      pag.reset()
    }).finally(() => setCargandoPagina(false))
  }, [])

  const cargarLista = async () => {
    const res = await api.get('/api/ea')
    setLista(res.data.data)
    pag.reset()
  }

  const set = (key: string, val: any) => setForm(s => ({ ...s, [key]: val }))

  const handleOC = async (ocId: string) => {
    set('oc_id', ocId)
    const oc = ocDisponibles.find(o => o.oc_id === ocId) || null
    setOcSel(oc)
    if (!ocId) { setItems([]); return }

    setCargandoOC(true)
    try {
      const res = await api.get(`/api/ea/items-oc/${ocId}`)
      setItems(res.data.data.map((item: any) => ({
        ...item,
        cantidad_recibida: item.pendiente, // default = pendiente
        incluir: true,
      })))
    } finally { setCargandoOC(false) }
  }

  const actualizarCantidad = (idx: number, val: number) => {
    const nuevos = [...items]
    nuevos[idx] = { ...nuevos[idx], cantidad_recibida: val }
    setItems(nuevos)
  }

  const toggleIncluir = (idx: number) => {
    const nuevos = [...items]
    nuevos[idx] = { ...nuevos[idx], incluir: !nuevos[idx].incluir }
    setItems(nuevos)
  }

  // Novedad calculada en tiempo real
  const novedad = (item: ItemEA) => {
    if (!item.incluir) return null
    if (item.cantidad_recibida === item.pendiente) return 'OK'
    if (item.cantidad_recibida < item.pendiente)   return 'FALTANTE'
    return 'SOBRANTE'
  }

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const itemsAEnviar = items.filter(i => i.incluir)
    if (itemsAEnviar.length === 0) { setError('Debe incluir al menos un ítem'); return }

    for (const item of itemsAEnviar) {
      if (item.cantidad_recibida > item.pendiente)
        { setError(`"${item.nombre_material}": la cantidad no puede superar lo pendiente (${item.pendiente})`); return }
      if (item.cantidad_recibida < 0)
        { setError(`"${item.nombre_material}": la cantidad no puede ser negativa`); return }
    }

    setCargando(true); setError('')
    try {
      await api.post('/api/ea', { ...form, items: itemsAEnviar })
      toast.success('Entrada de almacén registrada — stock actualizado')
      setShowForm(false); setForm(EMPTY_FORM); setOcSel(null); setItems([])
      cargarLista()
      const rOC = await api.get('/api/ea/oc-disponibles/lista')
      setOcDisponibles(rOC.data.data)
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al guardar'
      setError(msg); toast.error(msg)
    } finally { setCargando(false) }
  }

  const verDetalle = async (eaId: string) => {
    setCargandoDet(true); setShowDetalle(true)
    try {
      const res  = await api.get(`/api/ea/${eaId}`)
      const data = res.data.data
      setEaDetalle(data); setDetalleItems(data.detalle)
    } finally { setCargandoDet(false) }
  }

  const puedeCrear = ['ADMIN','COORDINADOR','ALMACENISTA'].includes(usuario?.rol || '')

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Entradas de Almacén</h1>
          <p className="page-subtitle">{lista.length} entrada{lista.length !== 1 ? 's' : ''} registrada{lista.length !== 1 ? 's' : ''}</p>
        </div>
        {puedeCrear && (
          <button className="btn btn-primary" onClick={() => {
            setForm(EMPTY_FORM); setOcSel(null)
            setItems([]); setError(''); setShowForm(true)
          }}>
            <Plus size={15} /> Nueva entrada
          </button>
        )}
      </div>

      {/* Tabla */}
      {cargandoPagina ? (
        <div className="page-loading"><Loader2 size={20} className="spinner" /><span>Cargando...</span></div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>EA ID</th><th>OC</th><th>Proveedor</th>
                <th>Edificación</th><th>Nro. Remisión</th>
                <th>Almacenista</th><th>Fecha</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={9}>
                  <div className="search-empty-state">
                    <Warehouse size={32} style={{ color: 'var(--color-text-muted)' }} />
                    <span>No hay entradas de almacén registradas</span>
                  </div>
                </td></tr>
              ) : (
                <>
                  {pag.itemsPagina.map(e => (
                    <tr key={e.ea_id}>
                  <td className="td-id">{e.ea_id}</td>
                  <td className="td-id">{e.oc_id}</td>
                  <td className="td-bold">{e.nombre_proveedor}</td>
                  <td className="td-secondary">{e.nombre_edificio}</td>
                  <td className="td-secondary">{e.nro_remision || '—'}</td>
                  <td className="td-secondary">{e.almacenista}</td>
                  <td className="td-secondary">
                    {new Date(e.timestamp).toLocaleDateString('es-CO')}
                  </td>
                  <td>
                    <span className={`badge ${BADGE_ESTADO[e.estado] || 'badge-neutral'}`}>
                      {e.estado}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => verDetalle(e.ea_id)}>
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

      {/* ── Modal nueva EA ─────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ width: 'min(1000px, 92vw)' }}>
            <div className="modal-header">
              <span className="modal-title">Nueva entrada de almacén</span>
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

                {/* OC */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label required" htmlFor="ea-oc">
                    Orden de compra
                  </label>
                  <select id="ea-oc" className="form-select" value={form.oc_id}
                    onChange={e => handleOC(e.target.value)} required aria-label="Orden de compra">
                    <option value="">Selecciona una OC...</option>
                    {ocDisponibles.map(oc => (
                      <option key={oc.oc_id} value={oc.oc_id}>
                        {oc.oc_id} — {oc.nombre_proveedor} | {oc.nombre_proyecto} |
                        {oc.estado === 'RECIBIDA_PARCIAL' ? ' (Parcial)' : ''}
                      </option>
                    ))}
                  </select>
                  {ocDisponibles.length === 0 && (
                    <span className="form-hint" style={{ color: 'var(--color-warning)' }}>
                      No hay OC aprobadas o con pendientes de recepción
                    </span>
                  )}
                </div>

                {/* Info OC */}
                {ocSel && (
                  <div className="system-values-box" style={{ marginBottom: 16 }}>
                    <p className="system-values-box__title">Datos de la orden</p>
                    <div className="form-grid-3">
                      {[
                        { label: 'Proveedor',   value: ocSel.nombre_proveedor },
                        { label: 'Edificación', value: ocSel.nombre_edificio },
                        { label: 'Estado OC',   value: ocSel.estado },
                      ].map(f => (
                        <div className="form-group" key={f.label}>
                          <label className="form-label">{f.label}</label>
                          <input className="form-input" value={f.value} disabled />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Nro Remisión + Nro Factura */}
                <div className="form-grid-2" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ea-rem">Nro. Remisión</label>
                    <input id="ea-rem" className="form-input" value={form.nro_remision}
                      onChange={e => set('nro_remision', e.target.value)}
                      placeholder="Número de remisión del proveedor" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ea-fac">Nro. Factura</label>
                    <input id="ea-fac" className="form-input" value={form.nro_factura}
                      onChange={e => set('nro_factura', e.target.value)}
                      placeholder="Número de factura" />
                  </div>
                </div>

                {/* Tabla de ítems */}
                {ocSel && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label className="form-label" style={{ margin: 0 }}>
                        Materiales a recibir
                      </label>
                      <span className="form-hint">
                        Desmarca los ítems que no llegaron en esta entrega
                      </span>
                    </div>

                    {cargandoOC ? (
                      <div className="page-loading" style={{ height: 70 }}>
                        <Loader2 size={16} className="spinner" /><span>Cargando ítems...</span>
                      </div>
                    ) : items.length === 0 ? (
                      <div className="alert alert-warning">
                        <AlertCircle size={15} style={{ flexShrink: 0 }} />
                        <span>Esta OC no tiene ítems pendientes de recepción</span>
                      </div>
                    ) : (
                      <div className="data-table-wrapper">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th style={{ width: 44 }}></th>
                              <th>Material</th>
                              <th style={{ textAlign: 'center', width: 80 }}>Unidad</th>
                              <th style={{ textAlign: 'right', width: 120 }}>Pendiente</th>
                              <th style={{ width: 160 }}>Cant. recibida</th>
                              <th style={{ textAlign: 'right', width: 140 }}>P. Unitario</th>
                              <th style={{ textAlign: 'right', width: 140 }}>Total</th>
                              <th style={{ width: 90, textAlign: 'center' }}>Novedad</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item, idx) => {
                              const nov = novedad(item)
                              return (
                                <tr key={item.det_id} style={{
                                  opacity: item.incluir ? 1 : 0.4,
                                  background: !item.incluir ? 'var(--color-bg)' : undefined
                                }}>
                                  {/* Toggle incluir */}
                                  <td style={{ textAlign: 'center' }}>
                                    <button type="button"
                                      className={`toggle ${item.incluir ? 'on' : 'off'}`}
                                      style={{ width: 28, height: 16 }}
                                      onClick={() => toggleIncluir(idx)}
                                      aria-label={item.incluir ? 'Excluir ítem' : 'Incluir ítem'}
                                    />
                                  </td>
                                  <td className="td-bold">{item.nombre_material}</td>
                                  <td style={{ textAlign: 'center' }}>
                                    <span className="badge badge-neutral">{item.unidad}</span>
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-warning)' }}>
                                    {item.pendiente.toLocaleString('es-CO')}
                                  </td>
                                  <td>
                                    <NumericInput
                                      value={item.cantidad_recibida}
                                      onChange={val => actualizarCantidad(idx, val)}
                                      decimals={2}
                                      disabled={!item.incluir}
                                    />
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    {fmtCOP(item.precio_unitario)}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                    {item.incluir ? fmtCOP(item.cantidad_recibida * item.precio_unitario) : '—'}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    {nov && (
                                      <span className={`badge ${BADGE_NOVEDAD[nov]}`}>{nov}</span>
                                    )}
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

                {/* Notas */}
                <div className="form-group">
                  <label className="form-label" htmlFor="ea-notas">Notas</label>
                  <textarea id="ea-notas" className="form-textarea" value={form.notas}
                    onChange={e => set('notas', e.target.value)} rows={2}
                    placeholder="Observaciones de la recepción" />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary"
                  disabled={cargando || !form.oc_id || items.filter(i => i.incluir).length === 0}>
                  {cargando
                    ? <><Loader2 size={14} className="spinner" /> Registrando...</>
                    : 'Registrar entrada'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal detalle EA ───────────────────────────────── */}
      {showDetalle && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDetalle(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">Detalle — {eaDetalle?.ea_id}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDetalle(false)}
                style={{ padding: '0 6px' }} aria-label="Cerrar"><X size={16} /></button>
            </div>

            <div className="modal-body">
              {cargandoDet ? (
                <div className="page-loading"><Loader2 size={18} className="spinner" /><span>Cargando...</span></div>
              ) : eaDetalle && (
                <>
                  <div className="system-values-box" style={{ marginBottom: 16 }}>
                    <div className="form-grid-3">
                      {[
                        { id: 'ea-dp', label: 'Proveedor',    value: eaDetalle.nombre_proveedor },
                        { id: 'ea-de', label: 'Edificación',  value: eaDetalle.nombre_edificio },
                        { id: 'ea-doc',label: 'OC',           value: eaDetalle.oc_id },
                        { id: 'ea-dr', label: 'Nro. Remisión',value: eaDetalle.nro_remision || '—' },
                        { id: 'ea-df', label: 'Nro. Factura', value: eaDetalle.nro_factura  || '—' },
                        { id: 'ea-da', label: 'Almacenista',  value: eaDetalle.almacenista },
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
                          <th style={{ textAlign: 'right' }}>Esperado</th>
                          <th style={{ textAlign: 'right' }}>Recibido</th>
                          <th style={{ textAlign: 'right' }}>Diferencia</th>
                          <th style={{ textAlign: 'right' }}>P. Unitario</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                          <th style={{ textAlign: 'center' }}>Novedad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalleItems.map((d: any) => (
                          <tr key={d.det_id}>
                            <td className="td-bold">{d.nombre_material}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="badge badge-neutral">{d.unidad}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>{d.cantidad_oc.toLocaleString('es-CO')}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              {d.cantidad_recibida.toLocaleString('es-CO')}
                            </td>
                            <td style={{ textAlign: 'right',
                              color: d.diferencia < 0 ? 'var(--color-danger)'
                                : d.diferencia > 0 ? 'var(--color-info)'
                                : 'var(--color-text-muted)',
                              fontWeight: 600 }}>
                              {d.diferencia > 0 ? '+' : ''}{d.diferencia.toLocaleString('es-CO')}
                            </td>
                            <td style={{ textAlign: 'right' }}>{fmtCOP(d.precio_unitario)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCOP(d.valor_total)}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`badge ${BADGE_NOVEDAD[d.novedad] || 'badge-neutral'}`}>
                                {d.novedad}
                              </span>
                            </td>
                          </tr>
                        ))}
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