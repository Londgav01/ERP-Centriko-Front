import { useEffect, useState } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import {
  Plus, ShoppingCart, Loader2, AlertCircle,
  X, Eye, Check, XCircle
} from 'lucide-react'
import NumericInput from '../../components/ui/NumericInput'

interface CZDisponible {
  cz_id: string; rs_id: string; nombre_proveedor: string
  nombre_proyecto: string; nombre_capitulo: string
  nombre_edificio: string; condiciones_pago: string
  valor_total: number; capitulo_id: string
}

interface OC {
  oc_id: string; rs_id: string; cz_id: string
  nombre_proveedor: string; nombre_proyecto: string
  nombre_capitulo: string; subtotal: number
  iva_pct: number; valor_iva: number; valor_total: number
  estado: string; fecha_entrega_esperada: string
  forma_pago: string; aprobado_por: string
}

const fmtCOP = (v: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(v || 0)

const BADGE_ESTADO: Record<string, string> = {
  BORRADOR:         'badge-neutral',
  APROBADA:         'badge-success',
  ENVIADA_PROV:     'badge-info',
  RECIBIDA_PARCIAL: 'badge-warning',
  RECIBIDA_TOTAL:   'badge-success',
  ANULADA:          'badge-danger',
}

const FORMAS_PAGO = ['CONTADO','15 DÍAS','30 DÍAS','45 DÍAS','60 DÍAS','CRÉDITO','CONTRAENTREGA']
const ESTADOS     = ['BORRADOR','APROBADA','ENVIADA_PROV','RECIBIDA_PARCIAL','RECIBIDA_TOTAL','ANULADA']

const EMPTY_FORM = {
  cz_id: '', forma_pago: '', fecha_entrega_esperada: '',
  lugar_entrega: '', iva_pct: 19, notas: ''
}

export default function OCPage() {
  const { toast }   = useToast()
  const { usuario } = useAuth()

  const [lista,         setLista]         = useState<OC[]>([])
  const [czDisponibles, setCzDisponibles] = useState<CZDisponible[]>([])
  const [filtroEstado,  setFiltroEstado]  = useState('')

  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [czSel,     setCzSel]     = useState<CZDisponible | null>(null)
  const [error,     setError]     = useState('')
  const [cargando,  setCargando]  = useState(false)

  const [showDetalle,  setShowDetalle]  = useState(false)
  const [ocDetalle,    setOcDetalle]    = useState<OC | null>(null)
  const [detalleItems, setDetalleItems] = useState<any[]>([])
  const [cargandoDet,  setCargandoDet]  = useState(false)

  const [cargandoPagina, setCargandoPagina] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/api/oc'),
      api.get('/api/oc/cz-disponibles/lista'),
    ]).then(([rOC, rCZ]) => {
      setLista(rOC.data.data)
      setCzDisponibles(rCZ.data.data)
    }).finally(() => setCargandoPagina(false))
  }, [])

  const cargarLista = async (estado = filtroEstado) => {
    const params = new URLSearchParams()
    if (estado) params.append('estado', estado)
    const res = await api.get(`/api/oc?${params}`)
    setLista(res.data.data)
  }

  const set = (key: string, val: any) => setForm(s => ({ ...s, [key]: val }))

  // Al seleccionar CZ, autocompleta forma de pago
  const handleCZ = (czId: string) => {
    set('cz_id', czId)
    const cz = czDisponibles.find(c => c.cz_id === czId) || null
    setCzSel(cz)
    if (cz?.condiciones_pago) set('forma_pago', cz.condiciones_pago)
  }

  // Cálculos IVA en tiempo real
  const subtotal   = czSel?.valor_total || 0
  const valorIva   = subtotal * ((form.iva_pct || 0) / 100)
  const valorTotal = subtotal + valorIva

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setCargando(true); setError('')
    try {
      await api.post('/api/oc', form)
      toast.success('Orden de compra creada correctamente')
      setShowForm(false); setForm(EMPTY_FORM); setCzSel(null)
      cargarLista()
      const rCZ = await api.get('/api/oc/cz-disponibles/lista')
      setCzDisponibles(rCZ.data.data)
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al guardar'
      setError(msg); toast.error(msg)
    } finally { setCargando(false) }
  }

  const verDetalle = async (ocId: string) => {
    setCargandoDet(true); setShowDetalle(true)
    try {
      const res  = await api.get(`/api/oc/${ocId}`)
      const data = res.data.data
      setOcDetalle(data); setDetalleItems(data.detalle)
    } finally { setCargandoDet(false) }
  }

  const aprobar = async (ocId: string) => {
    if (!confirm('¿Aprobar esta orden de compra? Se sumará al comprometido del capítulo.')) return
    try {
      await api.put(`/api/oc/${ocId}/aprobar`, {})
      toast.success('OC aprobada — comprometido actualizado')
      setShowDetalle(false); cargarLista()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  const anular = async (ocId: string) => {
    if (!confirm('¿Anular esta OC? Se revertirá el comprometido si ya estaba aprobada.')) return
    try {
      await api.put(`/api/oc/${ocId}/anular`, {})
      toast.success('OC anulada')
      setShowDetalle(false); cargarLista()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  const puedeGestionar = ['ADMIN','COORDINADOR','ENC_COMPRAS'].includes(usuario?.rol || '')
  const puedeAprobar   = ['ADMIN','COORDINADOR'].includes(usuario?.rol || '')

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Órdenes de Compra</h1>
          <p className="page-subtitle">{lista.length} orden{lista.length !== 1 ? 'es' : ''}</p>
        </div>
        {puedeGestionar && (
          <button className="btn btn-primary" onClick={() => {
            setForm(EMPTY_FORM); setCzSel(null); setError(''); setShowForm(true)
          }}>
            <Plus size={15} /> Nueva OC
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="page-filters">
        <select className="form-select" value={filtroEstado}
          onChange={e => { setFiltroEstado(e.target.value); cargarLista(e.target.value) }}
          aria-label="Filtrar por estado" style={{ width: 200 }}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
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
                <th>OC ID</th><th>Proveedor</th><th>Proyecto / Capítulo</th>
                <th>Forma de pago</th><th>Subtotal</th>
                <th>IVA</th><th>Total</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={9}>
                  <div className="search-empty-state">
                    <ShoppingCart size={32} style={{ color: 'var(--color-text-muted)' }} />
                    <span>No hay órdenes de compra registradas</span>
                  </div>
                </td></tr>
              ) : lista.map(o => (
                <tr key={o.oc_id}>
                  <td className="td-id">{o.oc_id}</td>
                  <td className="td-bold">{o.nombre_proveedor}</td>
                  <td>
                    <span className="td-bold">{o.nombre_proyecto}</span>
                    <span className="td-muted" style={{ display: 'block' }}>{o.nombre_capitulo}</span>
                  </td>
                  <td className="td-secondary">{o.forma_pago || '—'}</td>
                  <td>{fmtCOP(o.subtotal)}</td>
                  <td className="td-secondary">{o.iva_pct}%</td>
                  <td style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {fmtCOP(o.valor_total)}
                  </td>
                  <td>
                    <span className={`badge ${BADGE_ESTADO[o.estado] || 'badge-neutral'}`}>
                      {o.estado}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => verDetalle(o.oc_id)}>
                        <Eye size={13} /> Ver
                      </button>
                      {puedeAprobar && o.estado === 'BORRADOR' && (
                        <button className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--color-success)' }}
                          onClick={() => aprobar(o.oc_id)}>
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

      {/* ── Modal nueva OC ─────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">Nueva orden de compra</span>
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

                {/* CZ ganadora */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label required" htmlFor="oc-cz">
                    Cotización ganadora
                  </label>
                  <select id="oc-cz" className="form-select" value={form.cz_id}
                    onChange={e => handleCZ(e.target.value)} required aria-label="Cotización">
                    <option value="">Selecciona una cotización ganadora...</option>
                    {czDisponibles.map(cz => (
                      <option key={cz.cz_id} value={cz.cz_id}>
                        {cz.cz_id} — {cz.nombre_proveedor} | {cz.nombre_proyecto} / {cz.nombre_capitulo} | {fmtCOP(cz.valor_total)}
                      </option>
                    ))}
                  </select>
                  {czDisponibles.length === 0 && (
                    <span className="form-hint" style={{ color: 'var(--color-warning)' }}>
                      No hay cotizaciones ganadoras disponibles. Selecciona una CZ ganadora primero.
                    </span>
                  )}
                </div>

                {/* Info de la CZ seleccionada */}
                {czSel && (
                  <div className="system-values-box" style={{ marginBottom: 16 }}>
                    <p className="system-values-box__title">Datos de la cotización seleccionada</p>
                    <div className="form-grid-3">
                      {[
                        { label: 'Proveedor',   value: czSel.nombre_proveedor },
                        { label: 'Proyecto',    value: czSel.nombre_proyecto },
                        { label: 'Capítulo',    value: czSel.nombre_capitulo },
                      ].map(f => (
                        <div className="form-group" key={f.label}>
                          <label className="form-label">{f.label}</label>
                          <input className="form-input" value={f.value} disabled />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Forma de pago + Fecha entrega + Lugar */}
                <div className="form-grid-3" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="oc-pago">Forma de pago</label>
                    <select id="oc-pago" className="form-select" value={form.forma_pago}
                      onChange={e => set('forma_pago', e.target.value)} aria-label="Forma de pago">
                      <option value="">Sin especificar</option>
                      {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="oc-fecha">Fecha entrega esperada</label>
                    <input id="oc-fecha" type="date" className="form-input"
                      value={form.fecha_entrega_esperada}
                      onChange={e => set('fecha_entrega_esperada', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="oc-lugar">Lugar de entrega</label>
                    <input id="oc-lugar" className="form-input" value={form.lugar_entrega}
                      onChange={e => set('lugar_entrega', e.target.value)}
                      placeholder="Ej: Bodega obra Torre A" />
                  </div>
                </div>

                {/* IVA + Resumen de valores */}
                <div className="form-grid-2" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="oc-iva">IVA (%)</label>
                    <NumericInput id="oc-iva" value={form.iva_pct}
                      onChange={val => set('iva_pct', val)}
                      suffix="%" decimals={1} placeholder="19" />
                    <span className="form-hint">Default 19% — configurable por OC</span>
                  </div>

                  {/* Resumen financiero */}
                  {czSel && (
                    <div style={{
                      background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)', padding: '12px 16px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>Subtotal</span>
                        <span style={{ fontWeight: 600 }}>{fmtCOP(subtotal)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>IVA ({form.iva_pct}%)</span>
                        <span style={{ fontWeight: 600 }}>{fmtCOP(valorIva)}</span>
                      </div>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        paddingTop: 8, borderTop: '1px solid var(--color-border)',
                      }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>Total OC</span>
                        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-primary)' }}>
                          {fmtCOP(valorTotal)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notas */}
                <div className="form-group">
                  <label className="form-label" htmlFor="oc-notas">Notas</label>
                  <textarea id="oc-notas" className="form-textarea" value={form.notas}
                    onChange={e => set('notas', e.target.value)} rows={2}
                    placeholder="Instrucciones especiales para el proveedor" />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={cargando || !form.cz_id}>
                  {cargando
                    ? <><Loader2 size={14} className="spinner" /> Guardando...</>
                    : 'Crear OC'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal detalle OC ───────────────────────────────── */}
      {showDetalle && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDetalle(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">Detalle — {ocDetalle?.oc_id}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDetalle(false)}
                style={{ padding: '0 6px' }} aria-label="Cerrar"><X size={16} /></button>
            </div>

            <div className="modal-body">
              {cargandoDet ? (
                <div className="page-loading"><Loader2 size={18} className="spinner" /><span>Cargando...</span></div>
              ) : ocDetalle && (
                <>
                  <div className="system-values-box" style={{ marginBottom: 16 }}>
                    <div className="form-grid-3">
                      {[
                        { id: 'oc-dp', label: 'Proveedor',   value: ocDetalle.nombre_proveedor },
                        { id: 'oc-dr', label: 'RS / CZ',     value: `${ocDetalle.rs_id} / ${ocDetalle.cz_id}` },
                        { id: 'oc-de', label: 'Estado',      value: ocDetalle.estado },
                        { id: 'oc-df', label: 'Forma pago',  value: ocDetalle.forma_pago || '—' },
                        { id: 'oc-dfe',label: 'Fecha entrega',value: ocDetalle.fecha_entrega_esperada || '—' },
                        { id: 'oc-dap',label: 'Aprobado por',value: ocDetalle.aprobado_por || '—' },
                      ].map(f => (
                        <div className="form-group" key={f.id}>
                          <label className="form-label" htmlFor={f.id}>{f.label}</label>
                          <input id={f.id} className="form-input" value={f.value} disabled />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tabla ítems */}
                  <div className="data-table-wrapper" style={{ marginBottom: 16 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th style={{ textAlign: 'center' }}>Unidad</th>
                          <th style={{ textAlign: 'right' }}>Cantidad</th>
                          <th style={{ textAlign: 'right' }}>P. Unitario</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                          <th style={{ textAlign: 'right' }}>Recibido</th>
                          <th style={{ textAlign: 'right' }}>Pendiente</th>
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
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCOP(d.valor_total)}</td>
                            <td style={{ textAlign: 'right', color: 'var(--color-success)', fontWeight: 600 }}>
                              {d.cant_recibida.toLocaleString('es-CO')}
                            </td>
                            <td style={{ textAlign: 'right',
                              color: d.pendiente > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)',
                              fontWeight: 600 }}>
                              {d.pendiente.toLocaleString('es-CO')}
                            </td>
                          </tr>
                        ))}

                        {/* Resumen financiero */}
                        <tr style={{ background: 'var(--color-bg)' }}>
                          <td colSpan={4} style={{ textAlign: 'right', fontSize: 12, color: 'var(--color-text-secondary)' }}>Subtotal</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCOP(ocDetalle.subtotal)}</td>
                          <td colSpan={2} />
                        </tr>
                        <tr style={{ background: 'var(--color-bg)' }}>
                          <td colSpan={4} style={{ textAlign: 'right', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                            IVA ({ocDetalle.iva_pct}%)
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCOP(ocDetalle.valor_iva)}</td>
                          <td colSpan={2} />
                        </tr>
                        <tr style={{ background: 'var(--color-bg)', borderTop: '2px solid var(--color-border)' }}>
                          <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700 }}>Total OC</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: 'var(--color-primary)' }}>
                            {fmtCOP(ocDetalle.valor_total)}
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              {puedeAprobar && ocDetalle?.estado === 'BORRADOR' && (
                <button className="btn btn-primary btn-sm" onClick={() => aprobar(ocDetalle.oc_id)}>
                  <Check size={14} /> Aprobar OC
                </button>
              )}
              {puedeAprobar && ocDetalle && ['BORRADOR','APROBADA','ENVIADA_PROV'].includes(ocDetalle.estado) && (
                <button className="btn btn-danger btn-sm" onClick={() => anular(ocDetalle.oc_id)}>
                  <XCircle size={14} /> Anular
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setShowDetalle(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}