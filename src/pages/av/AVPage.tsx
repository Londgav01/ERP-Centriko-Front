import { useEffect, useState } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import {
  Plus, CheckCircle2, Loader2, AlertCircle,
  X, Eye, Check, XCircle, Trash2
} from 'lucide-react'
import NumericInput from '../../components/ui/NumericInput'
import { usePagination } from '../../hooks/usePagination'
import Pagination from '../../components/ui/Pagination'

interface CTDisponible {
  ct_id: string; nombre_contratista: string
  nombre_proyecto: string; nombre_capitulo: string
  valor_contrato: number; pct_anticipo: number
  avance_anterior: number; valor_ejecutado_ct: number
}

interface AnticipActivo {
  an_id: string; monto_anticipo: number
  amortizado: number; saldo_amortizar: number; estado: string
}

interface Actividad {
  descripcion_actividad: string; unidad: string
  cantidad_contratada: number; cant_ejec_acumulada: number
  cant_ejec_este_acta: number; pct_avance: number
  precio_unitario: number; notas: string
}

interface AV {
  av_id: string; ct_id: string; capitulo_id: string
  nombre_capitulo: string; nombre_contratista: string
  nombre_proyecto?: string; valor_contrato: number
  periodo_desde: string; periodo_hasta: string
  pct_avance_acumulado: number; pct_avance_este_acta: number
  valor_acta: number; vr_amortiz_anticipo: number
  retencion_pct: number; vr_retencion: number
  valor_neto_pagar: number; estado: string
  aprobado_por: string; notas: string; timestamp: string
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
  pct_avance_acumulado: 0, valor_acta: 0,
  retencion_pct: 5, notas: ''
}

const EMPTY_ACTIVIDAD: Actividad = {
  descripcion_actividad: '', unidad: '',
  cantidad_contratada: 0, cant_ejec_acumulada: 0,
  cant_ejec_este_acta: 0, pct_avance: 0,
  precio_unitario: 0, notas: ''
}

export default function AVPage() {
  const { toast }   = useToast()
  const { usuario } = useAuth()

  const [lista,        setLista]        = useState<AV[]>([])
  const pag = usePagination(lista)
  const [ctDisponibles, setCtDisponibles] = useState<CTDisponible[]>([])
  const [filtroEstado, setFiltroEstado] = useState('')

  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [ctSel,      setCtSel]      = useState<CTDisponible | null>(null)
  const [anticipo,   setAnticipo]   = useState<AnticipActivo | null>(null)
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [error,      setError]      = useState('')
  const [cargando,   setCargando]   = useState(false)
  const [cargandoCT, setCargandoCT] = useState(false)

  const [showDetalle,  setShowDetalle]  = useState(false)
  const [avDetalle,    setAvDetalle]    = useState<AV | null>(null)
  const [detalleItems, setDetalleItems] = useState<any[]>([])
  const [cargandoDet,  setCargandoDet]  = useState(false)

  const [cargandoPagina, setCargandoPagina] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/api/av'),
      api.get('/api/av/ct-disponibles/lista'),
    ]).then(([rAV, rCT]) => {
      setLista(rAV.data.data)
      setCtDisponibles(rCT.data.data)
      pag.reset()
    }).finally(() => setCargandoPagina(false))
  }, [])

  const cargarLista = async (estado = filtroEstado) => {
    const params = new URLSearchParams()
    if (estado) params.append('estado', estado)
    const res = await api.get(`/api/av?${params}`)
    setLista(res.data.data)
    pag.reset()
  }

  const set = (key: string, val: any) => setForm(s => ({ ...s, [key]: val }))

  const handleCT = async (ctId: string) => {
    const ct = ctDisponibles.find(c => c.ct_id === ctId) || null
    setCtSel(ct)
    setForm(s => ({
      ...s, ct_id: ctId,
      pct_avance_acumulado: ct?.avance_anterior || 0
    }))
    setAnticipo(null)

    if (ctId) {
      setCargandoCT(true)
      try {
        const res = await api.get(`/api/av/anticipo-activo/${ctId}`)
        setAnticipo(res.data.data)
      } finally { setCargandoCT(false) }
    }
  }

  // Cálculos en tiempo real
  const pctAnterior  = ctSel?.avance_anterior || 0
  const pctEsteActa  = form.pct_avance_acumulado - pctAnterior
  const saldoCT      = ctSel ? ctSel.valor_contrato - ctSel.valor_ejecutado_ct : 0

  const vrAmortiz = (() => {
    if (!anticipo || anticipo.saldo_amortizar <= 0 || !ctSel) return 0
    const calc = (form.valor_acta / ctSel.valor_contrato) * anticipo.monto_anticipo
    return Math.min(calc, anticipo.saldo_amortizar)
  })()

  const vrRetencion  = form.valor_acta * ((form.retencion_pct || 0) / 100)
  const valorNeto    = form.valor_acta - vrAmortiz - vrRetencion

  const avanceRetrocede = form.pct_avance_acumulado < pctAnterior
  const superaSaldo     = form.valor_acta > saldoCT && saldoCT > 0

  // Actividades
  const agregarActividad = () =>
    setActividades(s => [...s, { ...EMPTY_ACTIVIDAD }])

  const eliminarActividad = (idx: number) =>
    setActividades(s => s.filter((_, i) => i !== idx))

  const actualizarActividad = (idx: number, key: string, val: any) => {
    const nuevas = [...actividades]
    nuevas[idx] = { ...nuevas[idx], [key]: val }
    // Calcular pct_avance de la actividad
    if (key === 'cant_ejec_este_acta' || key === 'cantidad_contratada') {
      const pct = nuevas[idx].cantidad_contratada > 0
        ? (nuevas[idx].cant_ejec_este_acta / nuevas[idx].cantidad_contratada) * 100 : 0
      nuevas[idx].pct_avance = Math.round(pct * 10) / 10
    }
    setActividades(nuevas)
  }

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (avanceRetrocede) { setError(`El avance no puede retroceder. Anterior: ${pctAnterior}%`); return }
    if (superaSaldo) { setError(`El valor supera el saldo del contrato (${fmtCOP(saldoCT)})`); return }

    setCargando(true); setError('')
    try {
      await api.post('/api/av', { ...form, actividades })
      toast.success('Acta de avance creada correctamente')
      setShowForm(false); setForm(EMPTY_FORM)
      setCtSel(null); setAnticipo(null); setActividades([])
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
    if (!confirm('¿Aprobar esta acta? Se actualizará el ejecutado y el avance físico del capítulo.')) return
    try {
      await api.put(`/api/av/${avId}/aprobar`, {})
      toast.success('Acta aprobada — ejecutado y avance actualizados')
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
            setAnticipo(null); setActividades([])
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
                <th>Capítulo</th>
                <th style={{ textAlign: 'right' }}>Valor acta</th>
                <th style={{ textAlign: 'center' }}>Avance</th>
                <th style={{ textAlign: 'right' }}>Neto a pagar</th>
                <th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={9}>
                  <div className="search-empty-state">
                    <CheckCircle2 size={32} style={{ color: 'var(--color-text-muted)' }} />
                    <span>No hay actas de avance registradas</span>
                  </div>
                </td></tr>
              ) : (
                <>
                  {pag.itemsPagina.map(a => (
                    <tr key={a.av_id}>
                  <td className="td-id">{a.av_id}</td>
                  <td className="td-id">{a.ct_id}</td>
                  <td className="td-bold">{a.nombre_contratista}</td>
                  <td className="td-secondary">{a.nombre_capitulo}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtCOP(a.valor_acta)}</td>
                  <td style={{ textAlign: 'center' }}>
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
                </>
              )}
            </tbody>
          </table>
          <Pagination {...pag} />
        </div>
      )}

      {/* ── Modal nueva AV ─────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ width: 'min(1060px, 92vw)' }}>
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
                  <label className="form-label required" htmlFor="av-ct">
                    Contrato en ejecución
                  </label>
                  <select id="av-ct" className="form-select" value={form.ct_id}
                    onChange={e => handleCT(e.target.value)} required aria-label="Contrato">
                    <option value="">Selecciona un contrato...</option>
                    {ctDisponibles.map(ct => (
                      <option key={ct.ct_id} value={ct.ct_id}>
                        {ct.ct_id} — {ct.nombre_contratista} | {ct.nombre_proyecto} / {ct.nombre_capitulo}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Info CT + avance */}
                {ctSel && (
                  <div className="system-values-box" style={{ marginBottom: 16 }}>
                    <p className="system-values-box__title">Estado del contrato</p>
                    <div className="form-grid-3" style={{ marginBottom: 12 }}>
                      {[
                        { label: 'Valor contrato',   value: fmtCOP(ctSel.valor_contrato) },
                        { label: 'Ejecutado a hoy',  value: fmtCOP(ctSel.valor_ejecutado_ct) },
                        { label: 'Saldo disponible', value: fmtCOP(saldoCT) },
                      ].map(f => (
                        <div className="form-group" key={f.label}>
                          <label className="form-label">{f.label}</label>
                          <input className="form-input font-mono" value={f.value} disabled />
                        </div>
                      ))}
                    </div>

                    {/* Barra de avance */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>Avance anterior</span>
                        <span style={{ fontWeight: 600 }}>{pctAnterior}%</span>
                      </div>
                      <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                        <div style={{
                          height: '100%', borderRadius: 4,
                          width: `${Math.min(form.pct_avance_acumulado, 100)}%`,
                          background: avanceRetrocede ? 'var(--color-danger)' : 'var(--color-primary)',
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
                        <span>0%</span>
                        {pctAnterior > 0 && (
                          <span style={{ color: 'var(--color-primary)' }}>Anterior: {pctAnterior}%</span>
                        )}
                        <span>100%</span>
                      </div>
                    </div>

                    {/* Anticipo activo */}
                    {cargandoCT ? (
                      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-text-muted)' }}>
                        Cargando anticipo...
                      </div>
                    ) : anticipo ? (
                      <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--color-warning-bg)', borderRadius: 'var(--radius-md)', fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-warning)' }}>Anticipo activo: </span>
                        {fmtCOP(anticipo.monto_anticipo)} — Saldo por amortizar: <strong>{fmtCOP(anticipo.saldo_amortizar)}</strong>
                      </div>
                    ) : (
                      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-text-muted)' }}>
                        Sin anticipo activo — no se calculará amortización
                      </div>
                    )}
                  </div>
                )}

                {/* Periodo */}
                <div className="form-grid-2" style={{ marginBottom: 16 }}>
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
                      onChange={e => set('periodo_hasta', e.target.value)} />
                  </div>
                </div>

                {/* Avance + Valor + Retención */}
                <div className="form-grid-3" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="av-pct">
                      % Avance acumulado
                    </label>
                    <NumericInput id="av-pct" value={form.pct_avance_acumulado}
                      onChange={val => set('pct_avance_acumulado', val)}
                      suffix="%" decimals={1} required />
                    {avanceRetrocede && (
                      <span className="hint-error">
                        No puede retroceder (anterior: {pctAnterior}%)
                      </span>
                    )}
                    {!avanceRetrocede && pctEsteActa > 0 && (
                      <span className="hint-ok">
                        Este acta: +{pctEsteActa.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="av-valor">Valor del acta (COP)</label>
                    <NumericInput id="av-valor" value={form.valor_acta}
                      onChange={val => set('valor_acta', val)}
                      prefix="$" required />
                    {superaSaldo && (
                      <span className="hint-error">
                        Supera el saldo: {fmtCOP(saldoCT)}
                      </span>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="av-ret">Retención (%)</label>
                    <NumericInput id="av-ret" value={form.retencion_pct}
                      onChange={val => set('retencion_pct', val)}
                      suffix="%" decimals={1} />
                  </div>
                </div>

                {/* Resumen financiero */}
                {form.valor_acta > 0 && (
                  <div style={{
                    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 16
                  }}>
                    <p className="system-values-box__title" style={{ marginBottom: 10 }}>
                      Liquidación del acta
                    </p>
                    {[
                      { label: 'Valor bruto acta',    value: fmtCOP(form.valor_acta), color: 'var(--color-text-primary)' },
                      { label: `Retención (${form.retencion_pct}%)`, value: `- ${fmtCOP(vrRetencion)}`, color: 'var(--color-danger)' },
                      { label: 'Amortización anticipo', value: `- ${fmtCOP(vrAmortiz)}`, color: 'var(--color-warning)' },
                    ].map(f => (
                      <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>{f.label}</span>
                        <span style={{ fontWeight: 600, color: f.color }}>{f.value}</span>
                      </div>
                    ))}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      paddingTop: 10, marginTop: 4,
                      borderTop: '2px solid var(--color-border)',
                    }}>
                      <span style={{ fontWeight: 700 }}>Neto a pagar</span>
                      <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-success)' }}>
                        {fmtCOP(valorNeto)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Tabla de actividades */}
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    Actividades ejecutadas <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(opcional)</span>
                  </label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={agregarActividad}>
                    <Plus size={13} /> Agregar actividad
                  </button>
                </div>

                {actividades.length > 0 && (
                  <div className="data-table-wrapper" style={{ marginBottom: 16 }}>
                    <table className="data-table" style={{ tableLayout: 'fixed' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '28%' }}>Descripción actividad</th>
                          <th style={{ width: '7%' }}>Unidad</th>
                          <th style={{ width: '11%' }}>Cant. contratada</th>
                          <th style={{ width: '11%' }}>Cant. acumulada</th>
                          <th style={{ width: '11%' }}>Este acta</th>
                          <th style={{ width: '8%' }}>% Avance</th>
                          <th style={{ width: '13%' }}>P. Unitario</th>
                          <th style={{ width: '7%' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {actividades.map((act, idx) => (
                          <tr key={idx}>
                            <td>
                              <input className="form-input" style={{ fontSize: 12 }}
                                value={act.descripcion_actividad}
                                onChange={e => actualizarActividad(idx, 'descripcion_actividad', e.target.value)}
                                placeholder="Descripción"
                                aria-label={`Actividad ${idx + 1}`} />
                            </td>
                            <td>
                              <input className="form-input" style={{ fontSize: 12 }}
                                value={act.unidad}
                                onChange={e => actualizarActividad(idx, 'unidad', e.target.value)}
                                placeholder="UN"
                                aria-label="Unidad" />
                            </td>
                            <td>
                              <NumericInput value={act.cantidad_contratada}
                                onChange={val => actualizarActividad(idx, 'cantidad_contratada', val)}
                                decimals={2} />
                            </td>
                            <td>
                              <NumericInput value={act.cant_ejec_acumulada}
                                onChange={val => actualizarActividad(idx, 'cant_ejec_acumulada', val)}
                                decimals={2} />
                            </td>
                            <td>
                              <NumericInput value={act.cant_ejec_este_acta}
                                onChange={val => actualizarActividad(idx, 'cant_ejec_este_acta', val)}
                                decimals={2} />
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 600,
                              color: act.pct_avance > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                              {act.pct_avance.toFixed(1)}%
                            </td>
                            <td>
                              <NumericInput value={act.precio_unitario}
                                onChange={val => actualizarActividad(idx, 'precio_unitario', val)}
                                prefix="$" decimals={0} />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button type="button" className="btn btn-danger btn-sm"
                                onClick={() => eliminarActividad(idx)}
                                style={{ padding: '0 6px' }}
                                aria-label="Eliminar actividad">
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

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
                  disabled={cargando || avanceRetrocede || superaSaldo || !form.ct_id}>
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
          <div className="modal" style={{ width: 'min(900px, 92vw)' }}>
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
                        { id: 'av-dc',  label: 'Contrato',    value: avDetalle.ct_id },
                        { id: 'av-dn',  label: 'Contratista', value: avDetalle.nombre_contratista },
                        { id: 'av-dca', label: 'Capítulo',    value: avDetalle.nombre_capitulo },
                        { id: 'av-de',  label: 'Estado',      value: avDetalle.estado },
                        { id: 'av-dd',  label: 'Período',     value: avDetalle.periodo_desde && avDetalle.periodo_hasta ? `${avDetalle.periodo_desde} / ${avDetalle.periodo_hasta}` : '—' },
                        { id: 'av-da',  label: 'Aprobado por',value: avDetalle.aprobado_por || '—' },
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
                      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Avance acumulado</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                        {avDetalle.pct_avance_acumulado}% (+{avDetalle.pct_avance_este_acta.toFixed(1)}% este acta)
                      </span>
                    </div>
                    <div style={{ height: 10, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 5,
                        width: `${Math.min(avDetalle.pct_avance_acumulado, 100)}%`,
                        background: 'var(--color-primary)',
                      }} />
                    </div>
                  </div>

                  {/* Liquidación */}
                  <div style={{
                    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 16
                  }}>
                    <p className="system-values-box__title" style={{ marginBottom: 10 }}>Liquidación</p>
                    {[
                      { label: 'Valor acta',            value: fmtCOP(avDetalle.valor_acta), color: 'var(--color-text-primary)' },
                      { label: `Retención (${avDetalle.retencion_pct}%)`, value: `- ${fmtCOP(avDetalle.vr_retencion)}`, color: 'var(--color-danger)' },
                      { label: 'Amortización anticipo', value: `- ${fmtCOP(avDetalle.vr_amortiz_anticipo)}`, color: 'var(--color-warning)' },
                    ].map(f => (
                      <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: 'var(--color-text-secondary)' }}>{f.label}</span>
                        <span style={{ fontWeight: 600, color: f.color }}>{f.value}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '2px solid var(--color-border)' }}>
                      <span style={{ fontWeight: 700 }}>Neto a pagar</span>
                      <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-success)' }}>
                        {fmtCOP(avDetalle.valor_neto_pagar)}
                      </span>
                    </div>
                  </div>

                  {/* Actividades */}
                  {detalleItems.length > 0 && (
                    <div className="data-table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Actividad</th>
                            <th style={{ textAlign: 'center' }}>Unidad</th>
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
                              <td className="td-bold">{d.descripcion_actividad}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="badge badge-neutral">{d.unidad}</span>
                              </td>
                              <td style={{ textAlign: 'right' }}>{d.cantidad_contratada.toLocaleString('es-CO')}</td>
                              <td style={{ textAlign: 'right' }}>{d.cant_ejec_acumulada.toLocaleString('es-CO')}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{d.cant_ejec_este_acta.toLocaleString('es-CO')}</td>
                              <td style={{ textAlign: 'right', color: 'var(--color-primary)', fontWeight: 600 }}>
                                {d.pct_avance}%
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCOP(d.valor_ejecutado)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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