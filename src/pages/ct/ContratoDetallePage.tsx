import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import {
  ArrowLeft, FileText, Play, Pause, XCircle,
  CheckCircle2, Loader2, Check, Eye, X,
  AlertCircle, ChevronRight
} from 'lucide-react'

interface CTDetalle {
  ct_id: string; nombre_contratista: string; nombre_proyecto: string
  nombre_edificio: string; nombre_capitulo: string
  objeto_contrato: string; tipo_contrato: string
  valor_contrato: number; pct_anticipo: number; rete_garantia_pct: number
  forma_pago: string; fecha_inicio: string; fecha_fin: string
  estado: string; aprobado_por: string; notas: string
  valor_ejecutado_ct: number; valor_por_ejecutar: number
  rete_garantia_valor: number; anticipo_por_amortizar: number
  detalle: ItemDetalle[]
}

interface ItemDetalle {
  det_id: string; nombre_capitulo: string; descripcion: string
  unidad: string; valor_unidad: number; cantidad: number
  valor_total: number; holgura: number; holgura_cantidad: number
  valor_con_holgura: number
}

interface AV {
  av_id: string; periodo_desde: string; periodo_hasta: string
  pct_avance_acumulado: number; pct_avance_este_acta: number
  valor_acta: number; vr_amortiz_anticipo: number
  retencion_pct: number; vr_retencion: number
  valor_neto_pagar: number; estado: string
  aprobado_por: string; timestamp: string
}

const fmtCOP = (v: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(v || 0)

const BADGE_ESTADO_CT: Record<string, string> = {
  BORRADOR:       'badge-neutral',
  ACTIVO:         'badge-success',
  'EN_EJECUCIÓN': 'badge-info',
  SUSPENDIDO:     'badge-warning',
  LIQUIDADO:      'badge-neutral',
  ANULADO:        'badge-danger',
}

const BADGE_ESTADO_AV: Record<string, string> = {
  BORRADOR:  'badge-neutral',
  APROBADA:  'badge-success',
  PAGADA:    'badge-success',
  RECHAZADA: 'badge-danger',
}

const TIPOS_CONTRATO: Record<string, string> = {
  TODO_COSTO:       'Todo costo',
  MANO_DE_OBRA:     'Mano de obra',
  ALQUILER_EQUIPOS: 'Alquiler de equipos',
}

export default function ContratoDetallePage() {
  const { ct_id }   = useParams<{ ct_id: string }>()
  const navigate    = useNavigate()
  const { toast }   = useToast()
  const { usuario } = useAuth()

  const [ct,       setCt]       = useState<CTDetalle | null>(null)
  const [actas,    setActas]    = useState<AV[]>([])
  const [cargando, setCargando] = useState(true)

  const puedeGestionar = ['ADMIN','COORDINADOR'].includes(usuario?.rol || '')

  useEffect(() => {
    if (!ct_id) return
    Promise.all([
      api.get(`/api/ct/${ct_id}`),
      api.get(`/api/av?ct_id=${ct_id}`),
    ]).then(([rCT, rAV]) => {
      setCt(rCT.data.data)
      setActas(rAV.data.data)
    }).catch(() => {
      toast.error('No se pudo cargar el contrato')
      navigate('/contratos')
    }).finally(() => setCargando(false))
  }, [ct_id])

  const transicion = async (nuevoEstado: string, msg: string) => {
    if (!confirm(msg)) return
    try {
      await api.put(`/api/ct/${ct_id}/transicion`, { nuevo_estado: nuevoEstado })
      toast.success(`Contrato → ${nuevoEstado}`)
      const res = await api.get(`/api/ct/${ct_id}`)
      setCt(res.data.data)
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  const activar = async () => {
    if (!confirm('¿Activar este contrato? Se sumará al comprometido de cada capítulo.')) return
    try {
      await api.put(`/api/ct/${ct_id}/activar`, {})
      toast.success('Contrato activado')
      const res = await api.get(`/api/ct/${ct_id}`)
      setCt(res.data.data)
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  const aprobarAV = async (avId: string) => {
    if (!confirm('¿Aprobar esta acta?')) return
    try {
      await api.put(`/api/av/${avId}/aprobar`, {})
      toast.success('Acta aprobada')
      const res = await api.get(`/api/av?ct_id=${ct_id}`)
      setActas(res.data.data)
      const rCT = await api.get(`/api/ct/${ct_id}`)
      setCt(rCT.data.data)
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  if (cargando) return (
    <MainLayout>
      <div className="page-loading" style={{ height: '60vh' }}>
        <Loader2 size={24} className="spinner" />
        <span>Cargando contrato...</span>
      </div>
    </MainLayout>
  )

  if (!ct) return null

  const pctEjecutado = ct.valor_contrato > 0
    ? (ct.valor_ejecutado_ct / ct.valor_contrato) * 100 : 0

  return (
    <MainLayout>
      {/* Header con breadcrumb */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-sm"
            onClick={() => navigate('/contratos')}
            style={{ padding: '0 8px' }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)', cursor: 'pointer' }}
                onClick={() => navigate('/contratos')}>
                Contratos
              </span>
              <ChevronRight size={12} style={{ color: 'var(--color-text-muted)' }} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>{ct.ct_id}</span>
            </div>
            <h1 className="page-title" style={{ margin: 0 }}>
              {ct.nombre_contratista}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span className={`badge ${BADGE_ESTADO_CT[ct.estado] || 'badge-neutral'}`}>
                {ct.estado}
              </span>
              <span className="td-muted" style={{ fontSize: 12 }}>
                {TIPOS_CONTRATO[ct.tipo_contrato] || ct.tipo_contrato}
              </span>
              <span className="td-muted" style={{ fontSize: 12 }}>·</span>
              <span className="td-muted" style={{ fontSize: 12 }}>
                {ct.nombre_proyecto} / {ct.nombre_edificio}
              </span>
            </div>
          </div>
        </div>

        {/* Acciones según estado */}
        {puedeGestionar && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ct.estado === 'BORRADOR' && (
              <button className="btn btn-primary" onClick={activar}>
                <Play size={14} /> Activar
              </button>
            )}
            {ct.estado === 'ACTIVO' && (
              <button className="btn btn-primary"
                onClick={() => transicion('EN_EJECUCIÓN', '¿Pasar a En Ejecución?')}>
                <Play size={14} /> En ejecución
              </button>
            )}
            {ct.estado === 'EN_EJECUCIÓN' && (
              <button className="btn btn-primary"
                onClick={() => transicion('LIQUIDADO', '¿Liquidar este contrato?')}>
                <CheckCircle2 size={14} /> Liquidar
              </button>
            )}
            {['ACTIVO','EN_EJECUCIÓN'].includes(ct.estado) && (
              <button className="btn btn-ghost btn-sm"
                style={{ color: 'var(--color-warning)' }}
                onClick={() => transicion('SUSPENDIDO', '¿Suspender?')}>
                <Pause size={14} /> Suspender
              </button>
            )}
            {ct.estado === 'SUSPENDIDO' && (
              <button className="btn btn-primary"
                onClick={() => transicion('EN_EJECUCIÓN', '¿Reanudar?')}>
                <Play size={14} /> Reanudar
              </button>
            )}
            {!['LIQUIDADO','ANULADO'].includes(ct.estado) && (
              <button className="btn btn-danger btn-sm"
                onClick={() => transicion('ANULADO', '¿Anular? Se revertirá el comprometido.')}>
                <XCircle size={14} /> Anular
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Resumen financiero ──────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 12, marginBottom: 24
      }}>
        {[
          { label: 'Valor contrato',    value: fmtCOP(ct.valor_contrato),          color: 'var(--color-primary)' },
          { label: 'Retegarantía',      value: ct.rete_garantia_pct > 0 ? `${ct.rete_garantia_pct}% · ${fmtCOP(ct.rete_garantia_valor)}` : '—', color: 'var(--color-warning)' },
          { label: 'Ejecutado',         value: fmtCOP(ct.valor_ejecutado_ct),       color: 'var(--color-success)' },
          { label: 'Por ejecutar',      value: fmtCOP(ct.valor_por_ejecutar),       color: 'var(--color-info)' },
          { label: 'Anticipo x amort.', value: fmtCOP(ct.anticipo_por_amortizar),   color: ct.anticipo_por_amortizar > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)' },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <span className="kpi-label">{k.label}</span>
            <div style={{ fontWeight: 700, fontSize: 14, color: k.color, marginTop: 6 }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Barra de progreso ejecución */}
      <div style={{
        background: 'white', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 24
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Progreso de ejecución</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>
            {pctEjecutado.toFixed(1)}%
          </span>
        </div>
        <div style={{ height: 10, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 5,
            width: `${Math.min(pctEjecutado, 100)}%`,
            background: pctEjecutado >= 100 ? 'var(--color-success)' : 'var(--color-primary)',
            transition: 'width 0.5s ease'
          }} />
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginTop: 6, fontSize: 11, color: 'var(--color-text-muted)'
        }}>
          <span>Ejecutado: {fmtCOP(ct.valor_ejecutado_ct)}</span>
          <span>Contrato: {fmtCOP(ct.valor_contrato)}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

        {/* ── Info del contrato ─────────────────────────── */}
        <div style={{
          background: 'white', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', padding: '20px'
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
            <FileText size={14} style={{ marginRight: 6 }} />
            Información del contrato
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Contrato',      value: ct.ct_id },
              { label: 'Contratista',   value: ct.nombre_contratista },
              { label: 'Forma de pago', value: ct.forma_pago || '—' },
              { label: '% Anticipo',    value: `${ct.pct_anticipo}%` },
              { label: 'Fecha inicio',  value: ct.fecha_inicio || '—' },
              { label: 'Fecha fin',     value: ct.fecha_fin    || '—' },
              { label: 'Aprobado por',  value: ct.aprobado_por || '—' },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 10, color: 'var(--color-text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                  {f.label}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{f.value}</div>
              </div>
            ))}
          </div>
          {ct.objeto_contrato && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Objeto
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                {ct.objeto_contrato}
              </div>
            </div>
          )}
        </div>

        {/* ── Ítems contratados ─────────────────────────── */}
        <div style={{
          background: 'white', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', padding: '20px'
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
            Ítems contratados
          </h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Ítem</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600 }}>Und.</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600 }}>Cant.</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', fontWeight: 600 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(ct.detalle || []).map(det => (
                  <tr key={det.det_id}
                    style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '7px 8px' }}>
                      <div style={{ fontWeight: 500 }}>{det.descripcion}</div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                        {det.nombre_capitulo}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', padding: '7px 8px' }}>
                      <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                        {det.unidad}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '7px 8px' }}>
                      {det.cantidad.toLocaleString('es-CO')}
                      {det.holgura_cantidad > 0 && (
                        <span style={{ color: 'var(--color-warning)', fontSize: 10,
                          display: 'block' }}>
                          +{det.holgura_cantidad.toLocaleString('es-CO')}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', padding: '7px 8px', fontWeight: 600,
                      color: 'var(--color-primary)' }}>
                      {fmtCOP(det.valor_con_holgura)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Actas de avance ──────────────────────────────── */}
      <div style={{
        background: 'white', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: 24
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
            Actas de avance
            <span className="td-muted" style={{ marginLeft: 8, fontWeight: 400 }}>
              ({actas.length} acta{actas.length !== 1 ? 's' : ''})
            </span>
          </h2>
          {ct.estado === 'EN_EJECUCIÓN' && puedeGestionar && (
            <button className="btn btn-primary btn-sm"
              onClick={() => navigate('/actas')}>
              <CheckCircle2 size={13} /> Nueva acta
            </button>
          )}
        </div>

        {actas.length === 0 ? (
          <div className="search-empty-state" style={{ padding: '30px 0' }}>
            <CheckCircle2 size={28} style={{ color: 'var(--color-text-muted)' }} />
            <span>No hay actas registradas para este contrato</span>
          </div>
        ) : (
          <div className="data-table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: 800 }}>
              <thead>
                <tr>
                  <th>Acta</th>
                  <th>Período</th>
                  <th style={{ textAlign: 'center' }}>Avance</th>
                  <th style={{ textAlign: 'right' }}>Valor acta</th>
                  <th style={{ textAlign: 'right' }}>Retención</th>
                  <th style={{ textAlign: 'right' }}>Amortización</th>
                  <th style={{ textAlign: 'right' }}>Neto a pagar</th>
                  <th>Estado</th>
                  {puedeGestionar && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {actas.map(av => (
                  <tr key={av.av_id}>
                    <td className="td-id">{av.av_id}</td>
                    <td className="td-secondary" style={{ fontSize: 11 }}>
                      {av.periodo_desde && av.periodo_hasta
                        ? `${av.periodo_desde} / ${av.periodo_hasta}`
                        : new Date(av.timestamp).toLocaleDateString('es-CO')
                      }
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center',
                        gap: 6, justifyContent: 'center' }}>
                        <div style={{ width: 50, height: 5, background: '#e2e8f0',
                          borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 3,
                            width: `${Math.min(av.pct_avance_acumulado, 100)}%`,
                            background: 'var(--color-primary)'
                          }} />
                        </div>
                        <span style={{ fontSize: 12 }}>{av.pct_avance_acumulado}%</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {fmtCOP(av.valor_acta)}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12,
                      color: 'var(--color-danger)' }}>
                      {av.vr_retencion > 0 ? `- ${fmtCOP(av.vr_retencion)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 12,
                      color: 'var(--color-warning)' }}>
                      {av.vr_amortiz_anticipo > 0 ? `- ${fmtCOP(av.vr_amortiz_anticipo)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700,
                      color: 'var(--color-success)' }}>
                      {fmtCOP(av.valor_neto_pagar)}
                    </td>
                    <td>
                      <span className={`badge ${BADGE_ESTADO_AV[av.estado] || 'badge-neutral'}`}>
                        {av.estado}
                      </span>
                    </td>
                    {puedeGestionar && (
                      <td>
                        {av.estado === 'BORRADOR' && (
                          <button className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--color-success)' }}
                            onClick={() => aprobarAV(av.av_id)}>
                            <Check size={13} /> Aprobar
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>

              {/* Totales */}
              {actas.length > 1 && (
                <tfoot>
                  <tr style={{ background: 'var(--color-bg)',
                    borderTop: '2px solid var(--color-border)', fontWeight: 700 }}>
                    <td colSpan={3} style={{ padding: '10px 16px', textAlign: 'right' }}>
                      Totales
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 16px' }}>
                      {fmtCOP(actas.reduce((s, a) => s + a.valor_acta, 0))}
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 16px',
                      color: 'var(--color-danger)' }}>
                      - {fmtCOP(actas.reduce((s, a) => s + a.vr_retencion, 0))}
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 16px',
                      color: 'var(--color-warning)' }}>
                      - {fmtCOP(actas.reduce((s, a) => s + a.vr_amortiz_anticipo, 0))}
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 16px',
                      color: 'var(--color-success)' }}>
                      {fmtCOP(actas.reduce((s, a) => s + a.valor_neto_pagar, 0))}
                    </td>
                    <td colSpan={puedeGestionar ? 2 : 1} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  )
}