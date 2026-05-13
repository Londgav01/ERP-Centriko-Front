import { useEffect, useState } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import {
  Plus, FileText, Loader2, AlertCircle,
  X, Eye, XCircle, Play, Pause, CheckCircle2
} from 'lucide-react'
import NumericInput from '../../components/ui/NumericInput'
import { usePagination } from '../../hooks/usePagination'
import Pagination from '../../components/ui/Pagination'

interface CapituloDisponible {
  capitulo_id: string; codigo: string; nombre_capitulo: string
  nombre_edificio: string; nombre_proyecto: string
  proyecto_id: string; edificio_id: string
  valor_presupuestado: number; valor_comprometido: number
}

interface Contratista { contratista_id: string; nombre: string; nit: string; especialidad: string }

interface CT {
  ct_id: string; proyecto_id: string; nombre_proyecto: string
  nombre_edificio: string; capitulo_id: string; nombre_capitulo: string
  contratista_id: string; nombre_contratista: string
  objeto_contrato: string; valor_contrato: number
  forma_pago: string; pct_anticipo: number
  fecha_inicio: string; fecha_fin: string
  estado: string; aprobado_por: string; notas: string
}

const fmtCOP = (v: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(v || 0)

const BADGE_ESTADO: Record<string, string> = {
  BORRADOR:      'badge-neutral',
  ACTIVO:        'badge-success',
  'EN_EJECUCIÓN':'badge-info',
  SUSPENDIDO:    'badge-warning',
  LIQUIDADO:     'badge-neutral',
  ANULADO:       'badge-danger',
}

const FORMAS_PAGO = ['ACTA_AVANCE','MENSUAL','QUINCENAL','CONTRAENTREGA','PRECIO_GLOBAL']
const ESTADOS     = ['BORRADOR','ACTIVO','EN_EJECUCIÓN','SUSPENDIDO','LIQUIDADO','ANULADO']

const EMPTY_FORM = {
  capitulo_id: '', contratista_id: '', objeto_contrato: '',
  valor_contrato: 0, forma_pago: '', pct_anticipo: 0,
  fecha_inicio: '', fecha_fin: '', notas: ''
}

export default function CTPage() {
  const { toast }   = useToast()
  const { usuario } = useAuth()

  const [lista,          setLista]          = useState<CT[]>([])
  const pag = usePagination(lista)
  const [capitulos,      setCapitulos]      = useState<CapituloDisponible[]>([])
  const [contratistas,   setContratistas]   = useState<Contratista[]>([])
  const [filtroEstado,   setFiltroEstado]   = useState('')
  const [maxAnticipoPct, setMaxAnticipoPct] = useState(50)

  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [capSel,    setCapSel]    = useState<CapituloDisponible | null>(null)
  const [error,     setError]     = useState('')
  const [cargando,  setCargando]  = useState(false)

  const [showDetalle, setShowDetalle] = useState(false)
  const [ctDetalle,   setCtDetalle]   = useState<CT | null>(null)
  const [cargandoDet, setCargandoDet] = useState(false)

  const [cargandoPagina, setCargandoPagina] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/api/ct'),
      api.get('/api/ct/capitulos-disponibles/lista'),
      api.get('/api/contratistas?activo=1'),
    ]).then(([rCT, rCap, rCont]) => {
      setLista(rCT.data.data)
      setCapitulos(rCap.data.data)
      setContratistas(rCont.data.data)
      pag.reset()
    }).finally(() => setCargandoPagina(false))

    // Cargar % máximo anticipo desde CONFIG
    api.get('/api/config/anticipo').then(res => {
      setMaxAnticipoPct(Number(res.data.valor || 50))
    }).catch(() => {})
  }, [])

  const cargarLista = async (estado = filtroEstado) => {
    const params = new URLSearchParams()
    if (estado) params.append('estado', estado)
    const res = await api.get(`/api/ct?${params}`)
    setLista(res.data.data)
    pag.reset()
  }

  const set = (key: string, val: any) => setForm(s => ({ ...s, [key]: val }))

  const handleCapitulo = (capId: string) => {
    set('capitulo_id', capId)
    const cap = capitulos.find(c => c.capitulo_id === capId) || null
    setCapSel(cap)
  }

  // Anticipo calculado en tiempo real
  const montoAnticipo = form.valor_contrato * ((form.pct_anticipo || 0) / 100)
  const anticipoExcede = form.pct_anticipo > maxAnticipoPct

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (anticipoExcede)
      { setError(`El anticipo no puede superar el ${maxAnticipoPct}%`); return }

    setCargando(true); setError('')
    try {
      await api.post('/api/ct', form)
      toast.success('Contrato creado correctamente')
      setShowForm(false); setForm(EMPTY_FORM); setCapSel(null)
      cargarLista()
      const rCap = await api.get('/api/ct/capitulos-disponibles/lista')
      setCapitulos(rCap.data.data)
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al guardar'
      setError(msg); toast.error(msg)
    } finally { setCargando(false) }
  }

  const verDetalle = async (ctId: string) => {
    setCargandoDet(true); setShowDetalle(true)
    try {
      const res = await api.get(`/api/ct/${ctId}`)
      setCtDetalle(res.data.data)
    } finally { setCargandoDet(false) }
  }

  const activar = async (ctId: string) => {
    if (!confirm('¿Activar este contrato? Se sumará al comprometido del capítulo.')) return
    try {
      await api.put(`/api/ct/${ctId}/activar`, {})
      toast.success('Contrato activado — comprometido actualizado')
      setShowDetalle(false); cargarLista()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  const transicion = async (ctId: string, nuevoEstado: string, mensaje: string) => {
    if (!confirm(mensaje)) return
    try {
      await api.put(`/api/ct/${ctId}/transicion`, { nuevo_estado: nuevoEstado })
      toast.success(`Contrato actualizado a ${nuevoEstado}`)
      setShowDetalle(false); cargarLista()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  const puedeGestionar = ['ADMIN','COORDINADOR'].includes(usuario?.rol || '')

  // Botones de acción según estado
  const accionesCT = (ct: CT) => {
    if (!puedeGestionar) return null
    const btns = []

    if (ct.estado === 'BORRADOR') {
      btns.push(
        <button key="act" className="btn btn-primary btn-sm"
          onClick={() => activar(ct.ct_id)}>
          <Play size={13} /> Activar
        </button>,
        <button key="anu" className="btn btn-danger btn-sm"
          onClick={() => transicion(ct.ct_id, 'ANULADO', '¿Anular este contrato?')}>
          <XCircle size={13} /> Anular
        </button>
      )
    }
    if (ct.estado === 'ACTIVO') {
      btns.push(
        <button key="eje" className="btn btn-primary btn-sm"
          onClick={() => transicion(ct.ct_id, 'EN_EJECUCIÓN', '¿Pasar a En Ejecución?')}>
          <Play size={13} /> En ejecución
        </button>,
        <button key="sus" className="btn btn-ghost btn-sm"
          style={{ color: 'var(--color-warning)' }}
          onClick={() => transicion(ct.ct_id, 'SUSPENDIDO', '¿Suspender este contrato?')}>
          <Pause size={13} /> Suspender
        </button>,
        <button key="anu" className="btn btn-danger btn-sm"
          onClick={() => transicion(ct.ct_id, 'ANULADO', '¿Anular? Se revertirá el comprometido.')}>
          <XCircle size={13} /> Anular
        </button>
      )
    }
    if (ct.estado === 'EN_EJECUCIÓN') {
      btns.push(
        <button key="liq" className="btn btn-primary btn-sm"
          onClick={() => transicion(ct.ct_id, 'LIQUIDADO', '¿Liquidar este contrato?')}>
          <CheckCircle2 size={13} /> Liquidar
        </button>,
        <button key="sus" className="btn btn-ghost btn-sm"
          style={{ color: 'var(--color-warning)' }}
          onClick={() => transicion(ct.ct_id, 'SUSPENDIDO', '¿Suspender?')}>
          <Pause size={13} /> Suspender
        </button>,
        <button key="anu" className="btn btn-danger btn-sm"
          onClick={() => transicion(ct.ct_id, 'ANULADO', '¿Anular? Se revertirá el comprometido.')}>
          <XCircle size={13} /> Anular
        </button>
      )
    }
    if (ct.estado === 'SUSPENDIDO') {
      btns.push(
        <button key="rea" className="btn btn-primary btn-sm"
          onClick={() => transicion(ct.ct_id, 'EN_EJECUCIÓN', '¿Reanudar el contrato?')}>
          <Play size={13} /> Reanudar
        </button>,
        <button key="anu" className="btn btn-danger btn-sm"
          onClick={() => transicion(ct.ct_id, 'ANULADO', '¿Anular? Se revertirá el comprometido.')}>
          <XCircle size={13} /> Anular
        </button>
      )
    }
    return btns
  }

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Contratos de Obra</h1>
          <p className="page-subtitle">{lista.length} contrato{lista.length !== 1 ? 's' : ''}</p>
        </div>
        {puedeGestionar && (
          <button className="btn btn-primary" onClick={() => {
            setForm(EMPTY_FORM); setCapSel(null); setError(''); setShowForm(true)
          }}>
            <Plus size={15} /> Nuevo contrato
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
                <th>CT ID</th><th>Contratista</th>
                <th>Proyecto / Capítulo</th><th>Objeto</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th>Forma pago</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="search-empty-state">
                    <FileText size={32} style={{ color: 'var(--color-text-muted)' }} />
                    <span>No hay contratos registrados</span>
                  </div>
                </td></tr>
              ) : (
                <>
                  {pag.itemsPagina.map(ct => (
                    <tr key={ct.ct_id}>
                  <td className="td-id">{ct.ct_id}</td>
                  <td className="td-bold">{ct.nombre_contratista}</td>
                  <td>
                    <span className="td-bold">{ct.nombre_proyecto}</span>
                    <span className="td-muted" style={{ display: 'block' }}>{ct.nombre_capitulo}</span>
                  </td>
                  <td className="td-secondary" style={{
                    maxWidth: 200, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {ct.objeto_contrato}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {fmtCOP(ct.valor_contrato)}
                  </td>
                  <td className="td-secondary">{ct.forma_pago || '—'}</td>
                  <td>
                    <span className={`badge ${BADGE_ESTADO[ct.estado] || 'badge-neutral'}`}>
                      {ct.estado}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => verDetalle(ct.ct_id)}>
                        <Eye size={13} /> Ver
                      </button>
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

      {/* ── Modal nuevo CT ─────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">Nuevo contrato de obra</span>
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

                {/* Capítulo + Contratista */}
                <div className="form-grid-2" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="ct-cap">Capítulo</label>
                    <select id="ct-cap" className="form-select" value={form.capitulo_id}
                      onChange={e => handleCapitulo(e.target.value)}
                      required aria-label="Capítulo">
                      <option value="">Selecciona un capítulo...</option>
                      {capitulos.map(c => (
                        <option key={c.capitulo_id} value={c.capitulo_id}>
                          {c.nombre_proyecto} / {c.nombre_edificio} / {c.codigo} — {c.nombre_capitulo}
                        </option>
                      ))}
                    </select>
                    {capitulos.length === 0 && (
                      <span className="form-hint" style={{ color: 'var(--color-warning)' }}>
                        No hay capítulos disponibles sin contrato activo
                      </span>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="ct-cont">Contratista</label>
                    <select id="ct-cont" className="form-select" value={form.contratista_id}
                      onChange={e => set('contratista_id', e.target.value)}
                      required aria-label="Contratista">
                      <option value="">Selecciona un contratista...</option>
                      {contratistas.map(c => (
                        <option key={c.contratista_id} value={c.contratista_id}>
                          {c.nombre} — {c.especialidad || c.nit}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Info capítulo */}
                {capSel && (
                  <div className="system-values-box" style={{ marginBottom: 16 }}>
                    <p className="system-values-box__title">Presupuesto del capítulo</p>
                    <div className="form-grid-3">
                      {[
                        { label: 'Presupuestado', value: fmtCOP(capSel.valor_presupuestado) },
                        { label: 'Comprometido',  value: fmtCOP(capSel.valor_comprometido) },
                        { label: 'Disponible',    value: fmtCOP(capSel.valor_presupuestado - capSel.valor_comprometido) },
                      ].map(f => (
                        <div className="form-group" key={f.label}>
                          <label className="form-label">{f.label}</label>
                          <input className="form-input font-mono" value={f.value} disabled />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Objeto del contrato */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label required" htmlFor="ct-objeto">Objeto del contrato</label>
                  <textarea id="ct-objeto" className="form-textarea" value={form.objeto_contrato}
                    onChange={e => set('objeto_contrato', e.target.value)}
                    required rows={3}
                    placeholder="Descripción del trabajo a realizar (mínimo 10 caracteres)" />
                  {form.objeto_contrato.length > 0 && form.objeto_contrato.length < 10 && (
                    <span className="hint-error">Mínimo 10 caracteres ({form.objeto_contrato.length}/10)</span>
                  )}
                </div>

                {/* Valor + Anticipo */}
                <div className="form-grid-2" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="ct-valor">Valor del contrato (COP)</label>
                    <NumericInput id="ct-valor" value={form.valor_contrato}
                      onChange={val => set('valor_contrato', val)}
                      prefix="$" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ct-pct">
                      % Anticipo (máx. {maxAnticipoPct}%)
                    </label>
                    <NumericInput id="ct-pct" value={form.pct_anticipo}
                      onChange={val => set('pct_anticipo', val)}
                      suffix="%" decimals={1} />
                    {montoAnticipo > 0 && (
                      <span className={anticipoExcede ? 'hint-error' : 'hint-ok'}>
                        {anticipoExcede
                          ? `Excede el máximo permitido (${maxAnticipoPct}%)`
                          : `Monto anticipo: ${fmtCOP(montoAnticipo)}`
                        }
                      </span>
                    )}
                  </div>
                </div>

                {/* Forma de pago + Fechas */}
                <div className="form-grid-3" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ct-pago">Forma de pago</label>
                    <select id="ct-pago" className="form-select" value={form.forma_pago}
                      onChange={e => set('forma_pago', e.target.value)} aria-label="Forma de pago">
                      <option value="">Sin especificar</option>
                      {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ct-inicio">Fecha inicio</label>
                    <input id="ct-inicio" type="date" className="form-input"
                      value={form.fecha_inicio}
                      onChange={e => set('fecha_inicio', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ct-fin">Fecha fin</label>
                    <input id="ct-fin" type="date" className="form-input"
                      value={form.fecha_fin}
                      onChange={e => set('fecha_fin', e.target.value)} />
                  </div>
                </div>

                {/* Notas */}
                <div className="form-group">
                  <label className="form-label" htmlFor="ct-notas">Notas</label>
                  <textarea id="ct-notas" className="form-textarea" value={form.notas}
                    onChange={e => set('notas', e.target.value)} rows={2}
                    placeholder="Condiciones especiales del contrato" />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary"
                  onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary"
                  disabled={cargando || anticipoExcede}>
                  {cargando
                    ? <><Loader2 size={14} className="spinner" /> Guardando...</>
                    : 'Crear contrato'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal detalle CT ───────────────────────────────── */}
      {showDetalle && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDetalle(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">Contrato — {ctDetalle?.ct_id}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDetalle(false)}
                style={{ padding: '0 6px' }} aria-label="Cerrar"><X size={16} /></button>
            </div>

            <div className="modal-body">
              {cargandoDet ? (
                <div className="page-loading">
                  <Loader2 size={18} className="spinner" /><span>Cargando...</span>
                </div>
              ) : ctDetalle && (
                <>
                  <div className="system-values-box" style={{ marginBottom: 16 }}>
                    <div className="form-grid-3">
                      {[
                        { id: 'ct-dp',  label: 'Contratista',  value: ctDetalle.nombre_contratista },
                        { id: 'ct-dpr', label: 'Proyecto',     value: ctDetalle.nombre_proyecto },
                        { id: 'ct-dc',  label: 'Capítulo',     value: ctDetalle.nombre_capitulo },
                        { id: 'ct-de',  label: 'Estado',       value: ctDetalle.estado },
                        { id: 'ct-df',  label: 'Forma pago',   value: ctDetalle.forma_pago || '—' },
                        { id: 'ct-da',  label: 'Aprobado por', value: ctDetalle.aprobado_por || '—' },
                      ].map(f => (
                        <div className="form-group" key={f.id}>
                          <label className="form-label" htmlFor={f.id}>{f.label}</label>
                          <input id={f.id} className="form-input" value={f.value} disabled />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Objeto */}
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label">Objeto del contrato</label>
                    <textarea className="form-textarea" value={ctDetalle.objeto_contrato}
                      disabled rows={3} />
                  </div>

                  {/* Valores */}
                  <div className="form-grid-3">
                    {[
                      { label: 'Valor contrato', value: fmtCOP(ctDetalle.valor_contrato), bold: true },
                      { label: '% Anticipo',     value: `${ctDetalle.pct_anticipo}%` },
                      { label: 'Monto anticipo', value: fmtCOP(ctDetalle.valor_contrato * ctDetalle.pct_anticipo / 100) },
                      { label: 'Fecha inicio',   value: ctDetalle.fecha_inicio || '—' },
                      { label: 'Fecha fin',      value: ctDetalle.fecha_fin    || '—' },
                    ].map(f => (
                      <div className="form-group" key={f.label}>
                        <label className="form-label">{f.label}</label>
                        <input className={`form-input ${f.bold ? 'font-mono' : ''}`}
                          value={f.value} disabled
                          style={f.bold ? { fontWeight: 700, color: 'var(--color-primary)' } : undefined} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                {ctDetalle && accionesCT(ctDetalle)}
              </div>
              <button className="btn btn-secondary" onClick={() => setShowDetalle(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}