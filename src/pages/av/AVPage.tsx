import { useEffect, useState } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { usePagination } from '../../hooks/usePagination'
import Pagination from '../../components/ui/Pagination'
import {
  Plus, CheckCircle2, Loader2, AlertCircle,
  X, Eye, Check, XCircle
} from 'lucide-react'
import NumericInput from '../../components/ui/NumericInput'

interface CTDisponible {
  ct_id: string; nombre_contratista: string
  nombre_proyecto: string; nombre_capitulo: string
  valor_contrato: number; pct_anticipo: number
  valor_ejecutado_ct: number
}

interface ItemCT {
  det_id: string; capitulo_id: string; nombre_capitulo: string
  descripcion: string; unidad: string
  valor_unidad: number; cantidad: number
  valor_total: number; valor_con_holgura: number
  cant_ejecutada_anterior: number; cant_disponible: number
  // Campos que llena el usuario
  cant_ejec_este_acta: number
  cant_ejec_acumulada: number
  pct_avance: number
  valor_ejecutado_item: number
  notas: string
}

interface AnticipActivo {
  an_id: string; monto_anticipo: number
  amortizado: number; saldo_amortizar: number
}

interface AV {
  av_id: string; ct_id: string; nombre_capitulo: string
  nombre_contratista: string; valor_contrato: number
  pct_avance_acumulado: number; pct_avance_este_acta: number
  valor_acta: number; vr_amortiz_anticipo: number
  retencion_pct: number; vr_retencion: number
  valor_neto_pagar: number; estado: string; timestamp: string
}

const fmtCOP = (v: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(v || 0)

const BADGE_ESTADO: Record<string, string> = {
  BORRADOR:  'badge-neutral',
  APROBADA:  'badge-success',
  PAGADA:    'badge-success',
  RECHAZADA: 'badge-danger',
}

const EMPTY_FORM = {
  ct_id: '', periodo_desde: '', periodo_hasta: '',
  retencion_pct: 5, notas: ''
}

export default function AVPage() {
  const { toast }   = useToast()
  const { usuario } = useAuth()

  const [lista,        setLista]        = useState<AV[]>([])
  const [ctDisponibles, setCtDisponibles] = useState<CTDisponible[]>([])
  const [filtroEstado, setFiltroEstado] = useState('')

  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [ctSel,      setCtSel]      = useState<CTDisponible | null>(null)
  const [itemsCT,    setItemsCT]    = useState<ItemCT[]>([])
  const [anticipo,   setAnticipo]   = useState<AnticipActivo | null>(null)
  const [error,      setError]      = useState('')
  const [cargando,   setCargando]   = useState(false)
  const [cargandoCT, setCargandoCT] = useState(false)

  const [showDetalle,  setShowDetalle]  = useState(false)
  const [avDetalle,    setAvDetalle]    = useState<AV | null>(null)
  const [detalleItems, setDetalleItems] = useState<any[]>([])
  const [cargandoDet,  setCargandoDet]  = useState(false)

  const [cargandoPagina, setCargandoPagina] = useState(true)
  const pag = usePagination(lista)

  useEffect(() => {
    Promise.all([
      api.get('/api/av'),
      api.get('/api/av/ct-disponibles/lista'),
    ]).then(([rAV, rCT]) => {
      setLista(rAV.data.data)
      setCtDisponibles(rCT.data.data)
    }).finally(() => setCargandoPagina(false))
  }, [])

  const cargarLista = async (estado = filtroEstado) => {
    const params = new URLSearchParams()
    if (estado) params.append('estado', estado)
    const res = await api.get(`/api/av?${params}`)
    setLista(res.data.data); pag.reset()
  }

  const set = (key: string, val: any) => setForm(s => ({ ...s, [key]: val }))

  const handleCT = async (ctId: string) => {
    const ct = ctDisponibles.find(c => c.ct_id === ctId) || null
    setCtSel(ct)
    setForm(s => ({ ...s, ct_id: ctId }))
    setItemsCT([]); setAnticipo(null)

    if (!ctId) return
    setCargandoCT(true)
    try {
      const [rItems, rAN] = await Promise.all([
        api.get(`/api/av/items-ct/${ctId}`),
        api.get(`/api/av/anticipo-activo/${ctId}`),
      ])
      setAnticipo(rAN.data.data)

      // Inicializar ítems con valores vacíos para que el usuario los llene
      setItemsCT(rItems.data.data.map((item: any) => ({
        ...item,
        cant_ejec_este_acta:  0,
        cant_ejec_acumulada:  item.cant_ejecutada_anterior,
        pct_avance:           item.cantidad > 0
          ? Math.round((item.cant_ejecutada_anterior / item.cantidad) * 1000) / 10
          : 0,
        valor_ejecutado_item: 0,
        notas: '',
      })))
    } finally { setCargandoCT(false) }
  }

  // Actualizar ítem y recalcular automáticamente
  const actualizarItem = (idx: number, key: string, val: number | string) => {
    const nuevos = [...itemsCT]
    const item   = { ...nuevos[idx], [key]: val }

    if (key === 'cant_ejec_este_acta') {
      // Acumulada = anterior + este acta
      item.cant_ejec_acumulada = item.cant_ejecutada_anterior + Number(val)
      // % avance = acumulada / contratada × 100
      item.pct_avance = item.cantidad > 0
        ? Math.round((item.cant_ejec_acumulada / item.cantidad) * 1000) / 10
        : 0
    }

    // Valor ejecutado = este acta × valor unitario
    item.valor_ejecutado_item = item.cant_ejec_este_acta * item.valor_unidad

    nuevos[idx] = item
    setItemsCT(nuevos)
  }

  // Cálculos globales en tiempo real
  const valorActa    = itemsCT.reduce((s, i) => s + i.valor_ejecutado_item, 0)
  const saldoCT      = ctSel ? ctSel.valor_contrato - ctSel.valor_ejecutado_ct : 0
  const superaSaldo  = valorActa > saldoCT && saldoCT > 0

  const vrAmortiz = (() => {
    if (!anticipo || anticipo.saldo_amortizar <= 0 || !ctSel) return 0
    const calc = (valorActa / ctSel.valor_contrato) * anticipo.monto_anticipo
    return Math.min(calc, anticipo.saldo_amortizar)
  })()

  const vrRetencion = valorActa * ((form.retencion_pct || 0) / 100)
  const valorNeto   = valorActa - vrAmortiz - vrRetencion

  // Avance físico ponderado
  const avanceFisicoGlobal = itemsCT.length > 0
    ? itemsCT.reduce((s, i) => s + (i.pct_avance * (i.cantidad || 1)), 0) /
      itemsCT.reduce((s, i) => s + (i.cantidad || 1), 0)
    : 0

  // Validación: algún ítem supera lo contratado
  const itemsConError = itemsCT.filter(i =>
    i.cant_ejec_acumulada > i.cantidad
  )

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault()

    if (itemsCT.length === 0) { setError('No hay capítulos cargados'); return }
    if (valorActa <= 0)  { setError('El valor del acta debe ser mayor a cero'); return }
    if (superaSaldo)     { setError(`El valor supera el saldo del contrato (${fmtCOP(saldoCT)})`); return }
    if (form.periodo_desde && form.periodo_hasta && form.periodo_hasta < form.periodo_desde)
      { setError('La fecha de fin del período no puede ser anterior a la fecha de inicio'); return }
    if (itemsConError.length > 0)
      { setError(`"${itemsConError[0].nombre_capitulo}": la cantidad acumulada supera lo contratado`); return }

    setCargando(true); setError('')
    try {
      await api.post('/api/av', {
        ...form,
        items_capitulos: itemsCT.map(i => ({
          det_id:              i.det_id,
          capitulo_id:         i.capitulo_id,
          nombre_capitulo:     i.nombre_capitulo,
          descripcion:         i.descripcion,
          unidad:              i.unidad,
          valor_unidad:        i.valor_unidad,
          cantidad_contratada: i.cantidad,
          cant_ejec_acumulada: i.cant_ejec_acumulada,
          cant_ejec_este_acta: i.cant_ejec_este_acta,
          pct_avance:          i.pct_avance,
          notas:               i.notas,
        }))
      })
      toast.success('Acta de avance creada correctamente')
      setShowForm(false); setForm(EMPTY_FORM)
      setCtSel(null); setAnticipo(null); setItemsCT([])
      cargarLista()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al guardar'
      setError(msg); toast.error(msg)
    } finally { setCargando(false) }
  }

  const verDetalle = async (avId: string) => {
    setCargandoDet(true); setShowDetalle(true)
    try {
      const res  = await api.get(`/api/av/${avId}`)
      const data = res.data.data
      setAvDetalle(data); setDetalleItems(data.detalle)
    } finally { setCargandoDet(false) }
  }

  const aprobar = async (avId: string) => {
    if (!confirm('¿Aprobar esta acta? Se actualizará el ejecutado y el avance físico de cada capítulo.')) return
    try {
      await api.put(`/api/av/${avId}/aprobar`, {})
      toast.success('Acta aprobada — ejecutado y avance actualizados por capítulo')
      setShowDetalle(false); cargarLista()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  const rechazar = async (avId: string) => {
    if (!confirm('¿Rechazar esta acta?')) return
    try {
      await api.put(`/api/av/${avId}/rechazar`, {})
      toast.success('Acta rechazada')
      setShowDetalle(false); cargarLista()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  const puedeCrear   = ['ADMIN','COORDINADOR','ING_RESIDENTE'].includes(usuario?.rol || '')
  const puedeAprobar = ['ADMIN','COORDINADOR'].includes(usuario?.rol || '')

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Actas de Avance</h1>
          <p className="page-subtitle">{lista.length} acta{lista.length !== 1 ? 's' : ''}</p>
        </div>
        {puedeCrear && (
          <button className="btn btn-primary" onClick={() => {
            setForm(EMPTY_FORM); setCtSel(null)
            setAnticipo(null); setItemsCT([])
            setError(''); setShowForm(true)
          }}>
            <Plus size={15} /> Nueva acta
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="page-filters">
        <select className="form-select" value={filtroEstado}
          onChange={e => { setFiltroEstado(e.target.value); cargarLista(e.target.value) }}
          aria-label="Filtrar por estado" style={{ width: 180 }}>
          <option value="">Todos los estados</option>
          <option value="BORRADOR">BORRADOR</option>
          <option value="APROBADA">APROBADA</option>
          <option value="PAGADA">PAGADA</option>
          <option value="RECHAZADA">RECHAZADA</option>
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
                <th>AV ID</th><th>Contrato</th><th>Contratista</th>
                <th style={{ textAlign: 'right' }}>Valor acta</th>
                <th style={{ textAlign: 'center' }}>Avance</th>
                <th style={{ textAlign: 'right' }}>Neto a pagar</th>
                <th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pag.itemsPagina.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="search-empty-state">
                    <CheckCircle2 size={32} style={{ color: 'var(--color-text-muted)' }} />
                    <span>No hay actas de avance registradas</span>
                  </div>
                </td></tr>
              ) : pag.itemsPagina.map(a => (
                <tr key={a.av_id}>
                  <td className="td-id">{a.av_id}</td>
                  <td className="td-id">{a.ct_id}</td>
                  <td className="td-bold">{a.nombre_contratista}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtCOP(a.valor_acta)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                      <div style={{ width: 50, height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(a.pct_avance_acumulado, 100)}%`,
                          background: 'var(--color-primary)', borderRadius: 3
                        }} />
                      </div>
                      <span style={{ fontSize: 12 }}>{a.pct_avance_acumulado}%</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>
                    {fmtCOP(a.valor_neto_pagar)}
                  </td>
                  <td>
                    <span className={`badge ${BADGE_ESTADO[a.estado] || 'badge-neutral'}`}>
                      {a.estado}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => verDetalle(a.av_id)}>
                        <Eye size={13} /> Ver
                      </button>
                      {puedeAprobar && a.estado === 'BORRADOR' && (
                        <button className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--color-success)' }}
                          onClick={() => aprobar(a.av_id)}>
                          <Check size={13} /> Aprobar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination {...pag} />
        </div>
      )}

      {/* ── Modal nueva AV ─────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ width: 'min(1100px, 92vw)' }}>
            <div className="modal-header">
              <span className="modal-title">Nueva acta de avance</span>
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

                {/* CT */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label required" htmlFor="av-ct">Contrato en ejecución</label>
                  <select id="av-ct" className="form-select" value={form.ct_id}
                    onChange={e => handleCT(e.target.value)} required aria-label="Contrato">
                    <option value="">Selecciona un contrato...</option>
                    {ctDisponibles.map(ct => (
                      <option key={ct.ct_id} value={ct.ct_id}>
                        {ct.ct_id} — {ct.nombre_contratista} | {ct.nombre_proyecto}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Info CT */}
                {ctSel && (
                  <div className="system-values-box" style={{ marginBottom: 16 }}>
                    <p className="system-values-box__title">Estado financiero del contrato</p>
                    <div className="form-grid-3">
                      {[
                        { label: 'Valor contrato',   value: fmtCOP(ctSel.valor_contrato) },
                        { label: 'Ejecutado a hoy',  value: fmtCOP(ctSel.valor_ejecutado_ct) },
                        { label: 'Saldo disponible', value: fmtCOP(saldoCT),
                          color: saldoCT <= 0 ? 'var(--color-danger)' : 'var(--color-success)' },
                      ].map(f => (
                        <div className="form-group" key={f.label}>
                          <label className="form-label">{f.label}</label>
                          <input className="form-input font-mono" value={f.value} disabled
                            style={f.color ? { color: f.color, fontWeight: 700 } : undefined} />
                        </div>
                      ))}
                    </div>

                    {anticipo && (
                      <div style={{ marginTop: 10, padding: '8px 12px',
                        background: 'var(--color-warning-bg)', borderRadius: 'var(--radius-md)', fontSize: 12 }}>
                        <strong style={{ color: 'var(--color-warning)' }}>Anticipo activo: </strong>
                        {fmtCOP(anticipo.monto_anticipo)} — Saldo: <strong>{fmtCOP(anticipo.saldo_amortizar)}</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* Período + Retención */}
                <div className="form-grid-3" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="av-desde">Período desde</label>
                    <input id="av-desde" type="date" className="form-input"
                      value={form.periodo_desde}
                      onChange={e => set('periodo_desde', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="av-hasta">Período hasta</label>
                    <input id="av-hasta" type="date" className="form-input"
                      value={form.periodo_hasta}
                      min={form.periodo_desde || undefined}
                      onChange={e => set('periodo_hasta', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="av-ret">Retención (%)</label>
                    <NumericInput id="av-ret" value={form.retencion_pct}
                      onChange={val => set('retencion_pct', val)}
                      suffix="%" decimals={1} />
                  </div>
                </div>

                {/* Tabla de capítulos */}
                {cargandoCT ? (
                  <div className="page-loading" style={{ height: 80 }}>
                    <Loader2 size={16} className="spinner" /><span>Cargando capítulos...</span>
                  </div>
                ) : itemsCT.length > 0 ? (
                  <>
                    <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>
                      Ejecución por capítulo
                      <span className="form-hint" style={{ marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                        Ingresa la cantidad ejecutada en este acta — el resto se calcula automáticamente
                      </span>
                    </label>

                    <div className="data-table-wrapper" style={{ marginBottom: 16 }}>
                      <table className="data-table" style={{ tableLayout: 'fixed' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '18%' }}>Capítulo</th>
                            <th style={{ width: '16%' }}>Ítem</th>
                            <th style={{ width: '6%' }}>Und.</th>
                            <th style={{ width: '10%', textAlign: 'right' }}>Contratado</th>
                            <th style={{ width: '10%', textAlign: 'right' }}>Ant. ejec.</th>
                            <th style={{ width: '12%' }}>Este acta</th>
                            <th style={{ width: '10%', textAlign: 'right' }}>Acumulado</th>
                            <th style={{ width: '8%', textAlign: 'right' }}>% Avance</th>
                            <th style={{ width: '10%', textAlign: 'right' }}>Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemsCT.map((item, idx) => {
                            const excede = item.cant_ejec_acumulada > item.cantidad
                            return (
                              <tr key={item.det_id}
                                style={{ background: excede ? 'rgba(220,38,38,0.04)' : undefined }}>
                                <td>
                                  <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-primary)' }}>
                                    {item.capitulo_id}
                                  </span>
                                  <span className="td-muted" style={{ display: 'block', fontSize: 11 }}>
                                    {item.nombre_capitulo}
                                  </span>
                                </td>
                                <td className="td-secondary" style={{ fontSize: 12 }}>{item.descripcion}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className="badge badge-neutral" style={{ fontSize: 10 }}>{item.unidad}</span>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                  {item.cantidad.toLocaleString('es-CO')}
                                </td>
                                <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                                  {item.cant_ejecutada_anterior.toLocaleString('es-CO')}
                                </td>
                                <td>
                                  <NumericInput
                                    value={item.cant_ejec_este_acta}
                                    onChange={val => actualizarItem(idx, 'cant_ejec_este_acta', val)}
                                    decimals={2}
                                  />
                                  {excede && (
                                    <span className="hint-error" style={{ fontSize: 10 }}>
                                      Supera contratado
                                    </span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right',
                                  fontWeight: 600,
                                  color: excede ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                                  {item.cant_ejec_acumulada.toLocaleString('es-CO')}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700,
                                  color: item.pct_avance >= 100 ? 'var(--color-success)' : 'var(--color-primary)' }}>
                                  {item.pct_avance.toFixed(1)}%
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                                  {fmtCOP(item.valor_ejecutado_item)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Resumen financiero */}
                    {valorActa > 0 && (
                      <div style={{
                        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 16
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 32 }}>
                          {/* Avance físico */}
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)',
                              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                              Avance físico ponderado
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%', borderRadius: 4,
                                  width: `${Math.min(avanceFisicoGlobal, 100)}%`,
                                  background: 'var(--color-primary)',
                                }} />
                              </div>
                              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-primary)', minWidth: 50 }}>
                                {avanceFisicoGlobal.toFixed(1)}%
                              </span>
                            </div>
                          </div>

                          {/* Liquidación */}
                          <div style={{ minWidth: 240 }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)',
                              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                              Liquidación del acta
                            </p>
                            {[
                              { label: 'Valor bruto',      value: fmtCOP(valorActa),    color: 'var(--color-text-primary)' },
                              { label: `Retención (${form.retencion_pct}%)`, value: `- ${fmtCOP(vrRetencion)}`, color: 'var(--color-danger)' },
                              { label: 'Amortización',     value: `- ${fmtCOP(vrAmortiz)}`, color: 'var(--color-warning)' },
                            ].map(f => (
                              <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                                <span style={{ color: 'var(--color-text-secondary)' }}>{f.label}</span>
                                <span style={{ fontWeight: 600, color: f.color }}>{f.value}</span>
                              </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between',
                              paddingTop: 8, borderTop: '2px solid var(--color-border)', marginTop: 4 }}>
                              <span style={{ fontWeight: 700 }}>Neto a pagar</span>
                              <span style={{ fontWeight: 700, fontSize: 15,
                                color: superaSaldo ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                {fmtCOP(valorNeto)}
                              </span>
                            </div>
                            {superaSaldo && (
                              <div className="hint-error" style={{ marginTop: 6 }}>
                                El valor supera el saldo del contrato ({fmtCOP(saldoCT)})
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : form.ct_id && !cargandoCT ? (
                  <div className="alert alert-warning">
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>Este contrato no tiene capítulos registrados en CT_DETALLE</span>
                  </div>
                ) : null}

                {/* Notas */}
                <div className="form-group">
                  <label className="form-label" htmlFor="av-notas">Notas</label>
                  <textarea id="av-notas" className="form-textarea" value={form.notas}
                    onChange={e => set('notas', e.target.value)} rows={2}
                    placeholder="Observaciones del acta" />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary"
                  disabled={cargando || superaSaldo || itemsConError.length > 0 || !form.ct_id || valorActa <= 0}>
                  {cargando
                    ? <><Loader2 size={14} className="spinner" /> Guardando...</>
                    : 'Crear acta'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal detalle AV ───────────────────────────────── */}
      {showDetalle && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDetalle(false)}>
          <div className="modal" style={{ width: 'min(960px, 92vw)' }}>
            <div className="modal-header">
              <span className="modal-title">Acta — {avDetalle?.av_id}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDetalle(false)}
                style={{ padding: '0 6px' }} aria-label="Cerrar"><X size={16} /></button>
            </div>

            <div className="modal-body">
              {cargandoDet ? (
                <div className="page-loading"><Loader2 size={18} className="spinner" /><span>Cargando...</span></div>
              ) : avDetalle && (
                <>
                  <div className="system-values-box" style={{ marginBottom: 16 }}>
                    <div className="form-grid-3">
                      {[
                        { id: 'avd-ct', label: 'Contrato',    value: avDetalle.ct_id },
                        { id: 'avd-cn', label: 'Contratista', value: avDetalle.nombre_contratista },
                        { id: 'avd-es', label: 'Estado',      value: avDetalle.estado },
                      ].map(f => (
                        <div className="form-group" key={f.id}>
                          <label className="form-label" htmlFor={f.id}>{f.label}</label>
                          <input id={f.id} className="form-input" value={f.value} disabled />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Avance */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Avance físico acumulado</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                        {avDetalle.pct_avance_acumulado}%
                        <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 6 }}>
                          (+{avDetalle.pct_avance_este_acta}% este acta)
                        </span>
                      </span>
                    </div>
                    <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        width: `${Math.min(avDetalle.pct_avance_acumulado, 100)}%`,
                        background: 'var(--color-primary)',
                      }} />
                    </div>
                  </div>

                  {/* Detalle capítulos */}
                  {detalleItems.length > 0 && (
                    <div className="data-table-wrapper" style={{ marginBottom: 16 }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Ítem</th>
                            <th style={{ textAlign: 'center' }}>Und.</th>
                            <th style={{ textAlign: 'right' }}>Contratado</th>
                            <th style={{ textAlign: 'right' }}>Acumulado</th>
                            <th style={{ textAlign: 'right' }}>Este acta</th>
                            <th style={{ textAlign: 'right' }}>% Avance</th>
                            <th style={{ textAlign: 'right' }}>Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalleItems.map((d: any) => (
                            <tr key={d.det_id}>
                              <td>
                                <span className="td-bold">{d.descripcion_actividad}</span>
                                <span className="td-muted" style={{ display: 'block', fontSize: 11 }}>
                                  {d.capitulo_id}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="badge badge-neutral">{d.unidad}</span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {d.cantidad_contratada.toLocaleString('es-CO')}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                {d.cant_ejec_acumulada.toLocaleString('es-CO')}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {d.cant_ejec_este_acta.toLocaleString('es-CO')}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                                {d.pct_avance}%
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                {fmtCOP(d.valor_ejecutado)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Liquidación */}
                  <div style={{
                    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)', padding: '14px 16px'
                  }}>
                    <p className="system-values-box__title" style={{ marginBottom: 10 }}>Liquidación</p>
                    {[
                      { label: 'Valor acta',            value: fmtCOP(avDetalle.valor_acta),           color: 'var(--color-text-primary)' },
                      { label: `Retención (${avDetalle.retencion_pct}%)`, value: `- ${fmtCOP(avDetalle.vr_retencion)}`, color: 'var(--color-danger)' },
                      { label: 'Amortización anticipo', value: `- ${fmtCOP(avDetalle.vr_amortiz_anticipo)}`, color: 'var(--color-warning)' },
                    ].map(f => (
                      <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>{f.label}</span>
                        <span style={{ fontWeight: 600, color: f.color }}>{f.value}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between',
                      paddingTop: 10, borderTop: '2px solid var(--color-border)' }}>
                      <span style={{ fontWeight: 700 }}>Neto a pagar</span>
                      <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-success)' }}>
                        {fmtCOP(avDetalle.valor_neto_pagar)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              {puedeAprobar && avDetalle?.estado === 'BORRADOR' && (
                <>
                  <button className="btn btn-danger btn-sm" onClick={() => rechazar(avDetalle.av_id)}>
                    <XCircle size={14} /> Rechazar
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => aprobar(avDetalle.av_id)}>
                    <Check size={14} /> Aprobar acta
                  </button>
                </>
              )}
              <button className="btn btn-secondary" onClick={() => setShowDetalle(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}