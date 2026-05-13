import { useEffect, useState } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import {
  Plus, DollarSign, Loader2, AlertCircle,
  X, Eye, Check, XCircle
} from 'lucide-react'
import NumericInput from '../../components/ui/NumericInput'
import { usePagination } from '../../hooks/usePagination'
import Pagination from '../../components/ui/Pagination'

interface CTDisponible {
  ct_id: string; nombre_contratista: string
  nombre_proyecto: string; nombre_capitulo: string
  valor_contrato: number; pct_anticipo: number; estado: string
}

interface AN {
  an_id: string; ct_id: string
  nombre_contratista: string; nombre_proyecto: string; nombre_capitulo: string
  monto_anticipo: number; pct_anticipo: number
  amortizado: number; saldo_amortizar: number
  estado: string; timestamp: string; notas: string
}

const fmtCOP = (v: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(v || 0)

const BADGE_ESTADO: Record<string, string> = {
  PENDIENTE_PAGO:    'badge-neutral',
  PAGADO:            'badge-success',
  AMORTIZADO_PARCIAL:'badge-warning',
  AMORTIZADO_TOTAL:  'badge-neutral',
  ANULADO:           'badge-danger',
}

const ESTADOS = ['PENDIENTE_PAGO','PAGADO','AMORTIZADO_PARCIAL','AMORTIZADO_TOTAL','ANULADO']

const EMPTY_FORM = { ct_id: '', monto_anticipo: 0, pct_anticipo: 0, notas: '' }

export default function ANPage() {
  const { toast }   = useToast()
  const { usuario } = useAuth()

  const [lista,        setLista]        = useState<AN[]>([])
  const pag = usePagination(lista)
  const [ctDisponibles, setCtDisponibles] = useState<CTDisponible[]>([])
  const [filtroEstado, setFiltroEstado] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [ctSel,    setCtSel]    = useState<CTDisponible | null>(null)
  const [error,    setError]    = useState('')
  const [cargando, setCargando] = useState(false)

  const [showDetalle,  setShowDetalle]  = useState(false)
  const [anDetalle,    setAnDetalle]    = useState<AN | null>(null)

  const [cargandoPagina, setCargandoPagina] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/api/an'),
      api.get('/api/an/ct-disponibles/lista'),
    ]).then(([rAN, rCT]) => {
      setLista(rAN.data.data)
      setCtDisponibles(rCT.data.data)
      pag.reset()
    }).finally(() => setCargandoPagina(false))
  }, [])

  const cargarLista = async (estado = filtroEstado) => {
    const params = new URLSearchParams()
    if (estado) params.append('estado', estado)
    const res = await api.get(`/api/an?${params}`)
    setLista(res.data.data)
    pag.reset()
  }

  const set = (key: string, val: any) => setForm(s => ({ ...s, [key]: val }))

  const handleCT = (ctId: string) => {
    const ct = ctDisponibles.find(c => c.ct_id === ctId) || null
    setCtSel(ct)
    if (ct) {
      const monto = ct.valor_contrato * (ct.pct_anticipo / 100)
      setForm(s => ({
        ...s, ct_id: ctId,
        pct_anticipo:  ct.pct_anticipo,
        monto_anticipo: monto,
      }))
    } else {
      setForm(s => ({ ...s, ct_id: '', pct_anticipo: 0, monto_anticipo: 0 }))
    }
  }

  // Sincronización bidireccional pct ↔ monto
  const handlePct = (pct: number) => {
    const monto = ctSel ? ctSel.valor_contrato * (pct / 100) : 0
    setForm(s => ({ ...s, pct_anticipo: pct, monto_anticipo: monto }))
  }

  const handleMonto = (monto: number) => {
    const pct = ctSel && ctSel.valor_contrato > 0
      ? (monto / ctSel.valor_contrato) * 100 : 0
    setForm(s => ({ ...s, monto_anticipo: monto, pct_anticipo: Math.round(pct * 100) / 100 }))
  }

  const montoMaximo = ctSel ? ctSel.valor_contrato * (ctSel.pct_anticipo / 100) : 0
  const excedeMonto = ctSel && form.monto_anticipo > montoMaximo

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (excedeMonto)
      { setError(`El anticipo no puede superar ${fmtCOP(montoMaximo)}`); return }

    setCargando(true); setError('')
    try {
      await api.post('/api/an', form)
      toast.success('Anticipo registrado correctamente')
      setShowForm(false); setForm(EMPTY_FORM); setCtSel(null)
      cargarLista()
      const rCT = await api.get('/api/an/ct-disponibles/lista')
      setCtDisponibles(rCT.data.data)
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al guardar'
      setError(msg); toast.error(msg)
    } finally { setCargando(false) }
  }

  const verDetalle = async (anId: string) => {
    const an = lista.find(a => a.an_id === anId) || null
    setAnDetalle(an); setShowDetalle(true)
  }

  const pagar = async (anId: string) => {
    if (!confirm('¿Marcar anticipo como PAGADO? Se sumará al ejecutado del capítulo.')) return
    try {
      await api.put(`/api/an/${anId}/pagar`, {})
      toast.success('Anticipo marcado como pagado — ejecutado actualizado')
      setShowDetalle(false); cargarLista()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  const anular = async (anId: string) => {
    if (!confirm('¿Anular este anticipo?')) return
    try {
      await api.put(`/api/an/${anId}/anular`, {})
      toast.success('Anticipo anulado')
      setShowDetalle(false); cargarLista()
      const rCT = await api.get('/api/an/ct-disponibles/lista')
      setCtDisponibles(rCT.data.data)
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  const puedeGestionar = ['ADMIN','COORDINADOR'].includes(usuario?.rol || '')

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Anticipos</h1>
          <p className="page-subtitle">{lista.length} anticipo{lista.length !== 1 ? 's' : ''}</p>
        </div>
        {puedeGestionar && (
          <button className="btn btn-primary" onClick={() => {
            setForm(EMPTY_FORM); setCtSel(null); setError(''); setShowForm(true)
          }}>
            <Plus size={15} /> Nuevo anticipo
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="page-filters">
        <select className="form-select" value={filtroEstado}
          onChange={e => { setFiltroEstado(e.target.value); cargarLista(e.target.value) }}
          aria-label="Filtrar por estado" style={{ width: 220 }}>
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
                <th>AN ID</th><th>Contrato</th><th>Contratista</th>
                <th>Proyecto / Capítulo</th>
                <th style={{ textAlign: 'right' }}>Monto</th>
                <th style={{ textAlign: 'right' }}>Amortizado</th>
                <th style={{ textAlign: 'right' }}>Saldo</th>
                <th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={9}>
                  <div className="search-empty-state">
                    <DollarSign size={32} style={{ color: 'var(--color-text-muted)' }} />
                    <span>No hay anticipos registrados</span>
                  </div>
                </td></tr>
              ) : (
                <>
                  {pag.itemsPagina.map(a => (
                    <tr key={a.an_id}>
                  <td className="td-id">{a.an_id}</td>
                  <td className="td-id">{a.ct_id}</td>
                  <td className="td-bold">{a.nombre_contratista}</td>
                  <td>
                    <span className="td-bold">{a.nombre_proyecto}</span>
                    <span className="td-muted" style={{ display: 'block' }}>{a.nombre_capitulo}</span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtCOP(a.monto_anticipo)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--color-success)', fontWeight: 600 }}>
                    {fmtCOP(a.amortizado)}
                  </td>
                  <td style={{ textAlign: 'right',
                    color: a.saldo_amortizar > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)',
                    fontWeight: 600 }}>
                    {fmtCOP(a.saldo_amortizar)}
                  </td>
                  <td>
                    <span className={`badge ${BADGE_ESTADO[a.estado] || 'badge-neutral'}`}>
                      {a.estado.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => verDetalle(a.an_id)}>
                        <Eye size={13} /> Ver
                      </button>
                      {puedeGestionar && a.estado === 'PENDIENTE_PAGO' && (
                        <button className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--color-success)' }}
                          onClick={() => pagar(a.an_id)}>
                          <Check size={13} /> Pagar
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

      {/* ── Modal nuevo AN ─────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">Nuevo anticipo</span>
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
                  <label className="form-label required" htmlFor="an-ct">
                    Contrato (activos o en ejecución sin anticipo)
                  </label>
                  <select id="an-ct" className="form-select" value={form.ct_id}
                    onChange={e => handleCT(e.target.value)} required aria-label="Contrato">
                    <option value="">Selecciona un contrato...</option>
                    {ctDisponibles.map(ct => (
                      <option key={ct.ct_id} value={ct.ct_id}>
                        {ct.ct_id} — {ct.nombre_contratista} | {ct.nombre_proyecto} / {ct.nombre_capitulo} | {fmtCOP(ct.valor_contrato)}
                      </option>
                    ))}
                  </select>
                  {ctDisponibles.length === 0 && (
                    <span className="form-hint" style={{ color: 'var(--color-warning)' }}>
                      No hay contratos disponibles para registrar anticipos
                    </span>
                  )}
                </div>

                {/* Info CT */}
                {ctSel && (
                  <div className="system-values-box" style={{ marginBottom: 16 }}>
                    <p className="system-values-box__title">Datos del contrato</p>
                    <div className="form-grid-3">
                      {[
                        { label: 'Valor contrato',  value: fmtCOP(ctSel.valor_contrato) },
                        { label: '% Anticipo CT',   value: `${ctSel.pct_anticipo}%` },
                        { label: 'Monto máximo',    value: fmtCOP(montoMaximo) },
                      ].map(f => (
                        <div className="form-group" key={f.label}>
                          <label className="form-label">{f.label}</label>
                          <input className="form-input font-mono" value={f.value} disabled />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Monto ↔ Porcentaje (bidireccional) */}
                <div className="form-grid-2" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="an-monto">Monto del anticipo (COP)</label>
                    <NumericInput id="an-monto" value={form.monto_anticipo}
                      onChange={handleMonto} prefix="$" required />
                    {excedeMonto && (
                      <span className="hint-error">
                        Supera el máximo: {fmtCOP(montoMaximo)}
                      </span>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="an-pct">Porcentaje</label>
                    <NumericInput id="an-pct" value={form.pct_anticipo}
                      onChange={handlePct} suffix="%" decimals={2} />
                    {ctSel && (
                      <span className={form.pct_anticipo > ctSel.pct_anticipo ? 'hint-error' : 'hint-ok'}>
                        {form.pct_anticipo > ctSel.pct_anticipo
                          ? `Excede el % del contrato (${ctSel.pct_anticipo}%)`
                          : `Máximo según contrato: ${ctSel.pct_anticipo}%`
                        }
                      </span>
                    )}
                  </div>
                </div>

                {/* Notas */}
                <div className="form-group">
                  <label className="form-label" htmlFor="an-notas">Notas</label>
                  <textarea id="an-notas" className="form-textarea" value={form.notas}
                    onChange={e => set('notas', e.target.value)} rows={2}
                    placeholder="Observaciones del anticipo" />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary"
                  disabled={cargando || !!excedeMonto || !form.ct_id}>
                  {cargando
                    ? <><Loader2 size={14} className="spinner" /> Guardando...</>
                    : 'Registrar anticipo'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal detalle AN ───────────────────────────────── */}
      {showDetalle && anDetalle && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDetalle(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Anticipo — {anDetalle.an_id}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDetalle(false)}
                style={{ padding: '0 6px' }} aria-label="Cerrar"><X size={16} /></button>
            </div>

            <div className="modal-body">
              <div className="system-values-box" style={{ marginBottom: 20 }}>
                <div className="form-grid-2">
                  {[
                    { id: 'an-dc', label: 'Contrato',    value: anDetalle.ct_id },
                    { id: 'an-dn', label: 'Contratista', value: anDetalle.nombre_contratista },
                    { id: 'an-dp', label: 'Proyecto',    value: anDetalle.nombre_proyecto },
                    { id: 'an-dca',label: 'Capítulo',    value: anDetalle.nombre_capitulo },
                  ].map(f => (
                    <div className="form-group" key={f.id}>
                      <label className="form-label" htmlFor={f.id}>{f.label}</label>
                      <input id={f.id} className="form-input" value={f.value} disabled />
                    </div>
                  ))}
                </div>
              </div>

              {/* Valores */}
              <div className="form-grid-3" style={{ marginBottom: 20 }}>
                {[
                  { label: 'Monto anticipo', value: fmtCOP(anDetalle.monto_anticipo), color: 'var(--color-primary)' },
                  { label: 'Amortizado',     value: fmtCOP(anDetalle.amortizado),     color: 'var(--color-success)' },
                  { label: 'Saldo',          value: fmtCOP(anDetalle.saldo_amortizar), color: anDetalle.saldo_amortizar > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)' },
                ].map(f => (
                  <div key={f.label} style={{
                    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)', padding: '12px 16px', textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                      {f.label}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: f.color }}>{f.value}</div>
                  </div>
                ))}
              </div>

              {/* Barra de amortización */}
              {anDetalle.monto_anticipo > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Progreso amortización</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>
                      {((anDetalle.amortizado / anDetalle.monto_anticipo) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ height: 10, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min((anDetalle.amortizado / anDetalle.monto_anticipo) * 100, 100)}%`,
                      background: anDetalle.estado === 'AMORTIZADO_TOTAL'
                        ? 'var(--color-success)' : 'var(--color-primary)',
                      borderRadius: 5,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              )}

              {/* Estado */}
              <div style={{ textAlign: 'center' }}>
                <span className={`badge ${BADGE_ESTADO[anDetalle.estado] || 'badge-neutral'}`}
                  style={{ fontSize: 12, padding: '4px 12px' }}>
                  {anDetalle.estado.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            <div className="modal-footer">
              {puedeGestionar && anDetalle.estado === 'PENDIENTE_PAGO' && (
                <button className="btn btn-primary btn-sm" onClick={() => pagar(anDetalle.an_id)}>
                  <Check size={14} /> Marcar como pagado
                </button>
              )}
              {puedeGestionar && !['ANULADO','AMORTIZADO_TOTAL'].includes(anDetalle.estado) && (
                <button className="btn btn-danger btn-sm" onClick={() => anular(anDetalle.an_id)}>
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