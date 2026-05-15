import { useEffect, useState } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { usePagination } from '../../hooks/usePagination'
import Pagination from '../../components/ui/Pagination'
import {
  Plus, FileText, Loader2, AlertCircle, X,
  Eye, Play, Pause, XCircle, CheckCircle2, Trash2
} from 'lucide-react'
import NumericInput from '../../components/ui/NumericInput'

interface Proyecto    { proyecto_id: string; nombre: string }
interface Edificacion { edificio_id: string; nombre: string; proyecto_id: string }
interface CapDisponible {
  capitulo_id: string; codigo: string; nombre_capitulo: string
  nombre_edificio: string; nombre_proyecto: string
  proyecto_id: string; edificio_id: string
  valor_presupuestado: number; valor_comprometido: number
}
interface Contratista { contratista_id: string; nombre: string; nit: string; especialidad: string }

interface ItemCT {
  capitulo_id: string; nombre_capitulo: string; codigo: string
  descripcion: string; unidad: string
  valor_unidad: number; cantidad: number; valor_total: number
}

interface CTDetalle {
  det_id: string; capitulo_id: string; nombre_capitulo: string
  descripcion: string; unidad: string
  valor_unidad: number; cantidad: number
  valor_total: number; holgura: number; valor_con_holgura: number
}

interface CT {
  ct_id: string; proyecto_id: string; nombre_proyecto: string
  edificio_id: string; nombre_edificio: string
  capitulo_id: string; nombre_capitulo: string
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
  BORRADOR:       'badge-neutral',
  ACTIVO:         'badge-success',
  'EN_EJECUCIÓN': 'badge-info',
  SUSPENDIDO:     'badge-warning',
  LIQUIDADO:      'badge-neutral',
  ANULADO:        'badge-danger',
}

const FORMAS_PAGO = ['ACTA_AVANCE','MENSUAL','QUINCENAL','CONTRAENTREGA','PRECIO_GLOBAL']
const ESTADOS     = ['BORRADOR','ACTIVO','EN_EJECUCIÓN','SUSPENDIDO','LIQUIDADO','ANULADO']

const EMPTY_FORM = {
  proyecto_id: '', edificio_id: '',
  contratista_id: '', objeto_contrato: '',
  forma_pago: '', pct_anticipo: 0,
  fecha_inicio: '', fecha_fin: '', notas: ''
}

const EMPTY_ITEM: ItemCT = {
  capitulo_id: '', nombre_capitulo: '', codigo: '',
  descripcion: '', unidad: 'ML',
  valor_unidad: 0, cantidad: 0, valor_total: 0
}

export default function CTPage() {
  const { toast }   = useToast()
  const { usuario } = useAuth()

  const [lista,        setLista]        = useState<CT[]>([])
  const [proyectos,    setProyectos]    = useState<Proyecto[]>([])
  const [edificaciones,setEdificaciones]= useState<Edificacion[]>([])
  const [capsDisp,     setCapsDisp]     = useState<CapDisponible[]>([])
  const [contratistas, setContratistas] = useState<Contratista[]>([])
  const [filtroEstado, setFiltroEstado] = useState('')

  // Modal nuevo CT
  const [showForm,    setShowForm]    = useState(false)
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [items,       setItems]       = useState<ItemCT[]>([])
  const [edifModal,   setEdifModal]   = useState<Edificacion[]>([])
  const [capsModal,   setCapsModal]   = useState<CapDisponible[]>([])
  const [error,       setError]       = useState('')
  const [cargando,    setCargando]    = useState(false)
  const [maxAnticipoPct, setMaxAnticipoPct] = useState(50)

  // Modal detalle
  const [showDetalle,  setShowDetalle]  = useState(false)
  const [ctDetalle,    setCtDetalle]    = useState<CT | null>(null)
  const [detItems,     setDetItems]     = useState<CTDetalle[]>([])
  const [cargandoDet,  setCargandoDet]  = useState(false)

  // Modal holgura
  const [showHolgura,  setShowHolgura]  = useState(false)
  const [holguraDet,   setHolguraDet]   = useState<CTDetalle | null>(null)
  const [montoHolgura, setMontoHolgura] = useState(0)
  const [cargandoHol,  setCargandoHol]  = useState(false)

  const [cargandoPagina, setCargandoPagina] = useState(true)

  const pag = usePagination(lista)

  useEffect(() => {
    Promise.all([
      api.get('/api/ct'),
      api.get('/api/proyectos'),
      api.get('/api/edificaciones'),
      api.get('/api/ct/capitulos-disponibles/lista'),
      api.get('/api/contratistas?activo=1'),
      api.get('/api/config/anticipo'),
    ]).then(([rCT, rP, rE, rCap, rCont, rConf]) => {
      setLista(rCT.data.data)
      setProyectos(rP.data.data)
      setEdificaciones(rE.data.data)
      setCapsDisp(rCap.data.data)
      setContratistas(rCont.data.data)
      setMaxAnticipoPct(Number(rConf.data.valor || 50))
    }).finally(() => setCargandoPagina(false))
  }, [])

  const cargarLista = async (estado = filtroEstado) => {
    const params = new URLSearchParams()
    if (estado) params.append('estado', estado)
    const res = await api.get(`/api/ct?${params}`)
    setLista(res.data.data); pag.reset()
  }

  const set = (key: string, val: any) => setForm(s => ({ ...s, [key]: val }))

  // Cascada proyecto → edificación
  const handleProyecto = (proyId: string) => {
    setForm(s => ({ ...s, proyecto_id: proyId, edificio_id: '' }))
    setEdifModal(edificaciones.filter(e => e.proyecto_id === proyId))
    setCapsModal([])
    setItems([])
  }

  // Cascada edificación → capítulos disponibles
  const handleEdificio = (edifId: string) => {
    setForm(s => ({ ...s, edificio_id: edifId }))
    setCapsModal(capsDisp.filter(c => c.edificio_id === edifId))
    setItems([])
  }

  // Agregar capítulo al contrato
  const agregarItem = () => setItems(s => [...s, { ...EMPTY_ITEM }])

  const eliminarItem = (idx: number) =>
    setItems(s => s.filter((_, i) => i !== idx))

  const actualizarItem = (idx: number, key: string, val: any) => {
    const nuevos = [...items]
    nuevos[idx] = { ...nuevos[idx], [key]: val }

    // Si cambia capítulo, auto-llenar nombre y código
    if (key === 'capitulo_id') {
      const cap = capsModal.find(c => c.capitulo_id === val)
      nuevos[idx].nombre_capitulo = cap?.nombre_capitulo || ''
      nuevos[idx].codigo          = cap?.codigo          || ''
    }

    // Recalcular valor_total
    if (['valor_unidad','cantidad'].includes(key)) {
      nuevos[idx].valor_total = nuevos[idx].valor_unidad * nuevos[idx].cantidad
    }

    setItems(nuevos)
  }

  const totalContrato     = items.reduce((s, i) => s + i.valor_total, 0)
  const montoAnticipo     = totalContrato * ((form.pct_anticipo || 0) / 100)
  const anticipoExcede    = form.pct_anticipo > maxAnticipoPct
  const capsDuplicadas    = items.map(i => i.capitulo_id)
    .filter((v, i, a) => v && a.indexOf(v) !== i).length > 0

  // Capítulos ya seleccionados en el form (para deshabilitar en otros dropdowns)
  const capsSeleccionadas = items.map(i => i.capitulo_id).filter(Boolean)

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (items.length === 0)  { setError('Agregue al menos un capítulo'); return }
    if (capsDuplicadas)      { setError('Hay capítulos duplicados'); return }
    if (totalContrato <= 0)  { setError('El valor total debe ser mayor a cero'); return }
    if (anticipoExcede)      { setError(`El anticipo no puede superar el ${maxAnticipoPct}%`); return }
    if (form.fecha_inicio && form.fecha_fin && form.fecha_fin < form.fecha_inicio)
      { setError('La fecha de fin no puede ser anterior a la fecha de inicio'); return }

    for (const item of items) {
      if (!item.capitulo_id)   { setError('Todos los ítems deben tener un capítulo'); return }
      if (!item.descripcion)   { setError('Todos los ítems deben tener una descripción'); return }
      if (item.valor_total <= 0) { setError(`El valor de "${item.nombre_capitulo}" debe ser mayor a cero`); return }
    }

    setCargando(true); setError('')
    try {
      await api.post('/api/ct', { ...form, items })
      toast.success('Contrato creado correctamente')
      setShowForm(false); setForm(EMPTY_FORM); setItems([])
      cargarLista()
      const rCap = await api.get('/api/ct/capitulos-disponibles/lista')
      setCapsDisp(rCap.data.data)
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
      setDetItems(res.data.data.detalle || [])
    } finally { setCargandoDet(false) }
  }

  const activar = async (ctId: string) => {
    if (!confirm('¿Activar este contrato? Se sumará al comprometido de cada capítulo.')) return
    try {
      await api.put(`/api/ct/${ctId}/activar`, {})
      toast.success('Contrato activado — comprometido actualizado por capítulo')
      setShowDetalle(false); cargarLista()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  const transicion = async (ctId: string, nuevoEstado: string, msg: string) => {
    if (!confirm(msg)) return
    try {
      await api.put(`/api/ct/${ctId}/transicion`, { nuevo_estado: nuevoEstado })
      toast.success(`Contrato → ${nuevoEstado}`)
      setShowDetalle(false); cargarLista()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  const abrirHolgura = (det: CTDetalle) => {
    setHolguraDet(det); setMontoHolgura(0); setShowHolgura(true)
  }

  const guardarHolgura = async () => {
    if (!holguraDet || montoHolgura <= 0)
      { toast.error('El monto debe ser mayor a cero'); return }
    setCargandoHol(true)
    try {
      await api.put(`/api/ct/${ctDetalle?.ct_id}/detalle/${holguraDet.det_id}/holgura`, {
        holgura: montoHolgura
      })
      toast.success('Holgura agregada — comprometido actualizado')
      setShowHolgura(false)
      // Refrescar detalle
      const res = await api.get(`/api/ct/${ctDetalle?.ct_id}`)
      setCtDetalle(res.data.data)
      setDetItems(res.data.data.detalle || [])
      cargarLista()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error')
    } finally { setCargandoHol(false) }
  }

  const puedeGestionar = ['ADMIN','COORDINADOR'].includes(usuario?.rol || '')

  const accionesCT = (ct: CT) => {
    if (!puedeGestionar) return null
    const btns = []
    if (ct.estado === 'BORRADOR') btns.push(
      <button key="act" className="btn btn-primary btn-sm" onClick={() => activar(ct.ct_id)}>
        <Play size={13} /> Activar
      </button>,
      <button key="anu" className="btn btn-danger btn-sm"
        onClick={() => transicion(ct.ct_id, 'ANULADO', '¿Anular?')}>
        <XCircle size={13} /> Anular
      </button>
    )
    if (ct.estado === 'ACTIVO') btns.push(
      <button key="eje" className="btn btn-primary btn-sm"
        onClick={() => transicion(ct.ct_id, 'EN_EJECUCIÓN', '¿Pasar a En Ejecución?')}>
        <Play size={13} /> En ejecución
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
    if (ct.estado === 'EN_EJECUCIÓN') btns.push(
      <button key="liq" className="btn btn-primary btn-sm"
        onClick={() => transicion(ct.ct_id, 'LIQUIDADO', '¿Liquidar?')}>
        <CheckCircle2 size={13} /> Liquidar
      </button>,
      <button key="sus" className="btn btn-ghost btn-sm"
        style={{ color: 'var(--color-warning)' }}
        onClick={() => transicion(ct.ct_id, 'SUSPENDIDO', '¿Suspender?')}>
        <Pause size={13} /> Suspender
      </button>,
      <button key="anu" className="btn btn-danger btn-sm"
        onClick={() => transicion(ct.ct_id, 'ANULADO', '¿Anular?')}>
        <XCircle size={13} /> Anular
      </button>
    )
    if (ct.estado === 'SUSPENDIDO') btns.push(
      <button key="rea" className="btn btn-primary btn-sm"
        onClick={() => transicion(ct.ct_id, 'EN_EJECUCIÓN', '¿Reanudar?')}>
        <Play size={13} /> Reanudar
      </button>,
      <button key="anu" className="btn btn-danger btn-sm"
        onClick={() => transicion(ct.ct_id, 'ANULADO', '¿Anular?')}>
        <XCircle size={13} /> Anular
      </button>
    )
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
            setForm(EMPTY_FORM); setItems([])
            setEdifModal([]); setCapsModal([])
            setError(''); setShowForm(true)
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
                <th>Proyecto</th><th>Capítulos</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pag.itemsPagina.length === 0 ? (
                <tr><td colSpan={7}>
                  <div className="search-empty-state">
                    <FileText size={32} style={{ color: 'var(--color-text-muted)' }} />
                    <span>No hay contratos registrados</span>
                  </div>
                </td></tr>
              ) : pag.itemsPagina.map(ct => (
                <tr key={ct.ct_id}>
                  <td className="td-id">{ct.ct_id}</td>
                  <td className="td-bold">{ct.nombre_contratista}</td>
                  <td className="td-secondary">{ct.nombre_proyecto || '—'}</td>
                  <td>
                    <span className="td-bold">{ct.nombre_capitulo}</span>
                    <span className="td-muted" style={{ display: 'block', fontSize: 11 }}>
                      primer capítulo
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {fmtCOP(ct.valor_contrato)}
                  </td>
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
            </tbody>
          </table>
          <Pagination {...pag} />
        </div>
      )}

      {/* ── Modal nuevo CT ─────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ width: 'min(1100px, 92vw)' }}>
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

                {/* Cascada Proyecto → Edificación */}
                <div className="form-grid-2" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="ct-proy">Proyecto</label>
                    <select id="ct-proy" className="form-select" value={form.proyecto_id}
                      onChange={e => handleProyecto(e.target.value)} required aria-label="Proyecto">
                      <option value="">Selecciona un proyecto...</option>
                      {proyectos.map(p => (
                        <option key={p.proyecto_id} value={p.proyecto_id}>
                          {p.proyecto_id} — {p.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="ct-edif">Edificación</label>
                    <select id="ct-edif" className="form-select" value={form.edificio_id}
                      onChange={e => handleEdificio(e.target.value)}
                      required disabled={!form.proyecto_id} aria-label="Edificación">
                      <option value="">
                        {!form.proyecto_id ? 'Primero elige proyecto' : 'Selecciona...'}
                      </option>
                      {edifModal.map(e => (
                        <option key={e.edificio_id} value={e.edificio_id}>{e.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Contratista + Forma de pago */}
                <div className="form-grid-2" style={{ marginBottom: 16 }}>
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
                  <div className="form-group">
                    <label className="form-label" htmlFor="ct-pago">Forma de pago</label>
                    <select id="ct-pago" className="form-select" value={form.forma_pago}
                      onChange={e => set('forma_pago', e.target.value)} aria-label="Forma de pago">
                      <option value="">Sin especificar</option>
                      {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                </div>

                {/* Objeto del contrato */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label required" htmlFor="ct-objeto">Objeto del contrato</label>
                  <textarea id="ct-objeto" className="form-textarea"
                    value={form.objeto_contrato}
                    onChange={e => set('objeto_contrato', e.target.value)}
                    required rows={2}
                    placeholder="Descripción del trabajo a realizar (mínimo 10 caracteres)" />
                  {form.objeto_contrato.length > 0 && form.objeto_contrato.length < 10 && (
                    <span className="hint-error">Mínimo 10 caracteres</span>
                  )}
                </div>

                {/* Anticipo + Fechas */}
                <div className="form-grid-3" style={{ marginBottom: 16 }}>
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
                          ? `Excede el máximo (${maxAnticipoPct}%)`
                          : `Monto: ${fmtCOP(montoAnticipo)}`}
                      </span>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ct-ini">Fecha inicio</label>
                    <input id="ct-ini" type="date" className="form-input"
                      value={form.fecha_inicio}
                      onChange={e => set('fecha_inicio', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ct-fin">Fecha fin</label>
                    <input id="ct-fin" type="date" className="form-input"
                      value={form.fecha_fin}
                      min={form.fecha_inicio || undefined}
                      onChange={e => set('fecha_fin', e.target.value)} />
                  </div>
                </div>

                {/* ── Tabla de capítulos ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    Capítulos del contrato
                    {capsDuplicadas && <span className="hint-error" style={{ marginLeft: 8 }}>Hay capítulos duplicados</span>}
                  </label>
                  <button type="button" className="btn btn-secondary btn-sm"
                    onClick={agregarItem}
                    disabled={!form.edificio_id}>
                    <Plus size={13} /> Agregar capítulo
                  </button>
                </div>

                {!form.edificio_id ? (
                  <div className="alert alert-info" style={{ marginBottom: 16 }}>
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>Selecciona proyecto y edificación para agregar capítulos</span>
                  </div>
                ) : items.length === 0 ? (
                  <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>Haz clic en "Agregar capítulo" para comenzar</span>
                  </div>
                ) : (
                  <div className="data-table-wrapper" style={{ marginBottom: 16 }}>
                    <table className="data-table" style={{ tableLayout: 'fixed' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '22%' }}>Capítulo</th>
                          <th style={{ width: '22%' }}>Descripción ítem</th>
                          <th style={{ width: '8%' }}>Unidad</th>
                          <th style={{ width: '14%' }}>Valor unitario</th>
                          <th style={{ width: '10%' }}>Cantidad</th>
                          <th style={{ width: '16%', textAlign: 'right' }}>Valor total</th>
                          <th style={{ width: '8%' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx}>
                            <td>
                              <select className="form-select" style={{ fontSize: 12 }}
                                value={item.capitulo_id}
                                onChange={e => actualizarItem(idx, 'capitulo_id', e.target.value)}
                                aria-label={`Capítulo ${idx + 1}`}>
                                <option value="">Selecciona...</option>
                                {capsModal.map(c => (
                                  <option key={c.capitulo_id} value={c.capitulo_id}
                                    disabled={capsSeleccionadas.includes(c.capitulo_id) && item.capitulo_id !== c.capitulo_id}>
                                    {c.codigo} — {c.nombre_capitulo}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input className="form-input" style={{ fontSize: 12 }}
                                value={item.descripcion}
                                onChange={e => actualizarItem(idx, 'descripcion', e.target.value)}
                                placeholder="Actividad o ítem"
                                aria-label="Descripción" />
                            </td>
                            <td>
                              <input className="form-input" style={{ fontSize: 12 }}
                                value={item.unidad}
                                onChange={e => actualizarItem(idx, 'unidad', e.target.value.toUpperCase())}
                                placeholder="M2"
                                aria-label="Unidad" />
                            </td>
                            <td>
                              <NumericInput
                                value={item.valor_unidad}
                                onChange={val => actualizarItem(idx, 'valor_unidad', val)}
                                prefix="$" />
                            </td>
                            <td>
                              <NumericInput
                                value={item.cantidad}
                                onChange={val => actualizarItem(idx, 'cantidad', val)}
                                decimals={2} />
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                              {fmtCOP(item.valor_total)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button type="button" className="btn btn-danger btn-sm"
                                onClick={() => eliminarItem(idx)}
                                style={{ padding: '0 6px' }} aria-label="Eliminar">
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {/* Total */}
                        {items.length > 1 && (
                          <tr style={{ background: 'var(--color-bg)', borderTop: '2px solid var(--color-border)' }}>
                            <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                              Valor total del contrato
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: 'var(--color-primary)' }}>
                              {fmtCOP(totalContrato)}
                            </td>
                            <td />
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Notas */}
                <div className="form-group">
                  <label className="form-label" htmlFor="ct-notas">Notas</label>
                  <textarea id="ct-notas" className="form-textarea" value={form.notas}
                    onChange={e => set('notas', e.target.value)} rows={2}
                    placeholder="Condiciones especiales del contrato" />
                </div>
              </div>

              <div className="modal-footer">
                <div style={{ flex: 1, fontSize: 13 }}>
                  {totalContrato > 0 && (
                    <span>
                      <strong>Total: {fmtCOP(totalContrato)}</strong>
                      {montoAnticipo > 0 && ` · Anticipo: ${fmtCOP(montoAnticipo)}`}
                    </span>
                  )}
                </div>
                <button type="button" className="btn btn-secondary"
                  onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary"
                  disabled={cargando || anticipoExcede || capsDuplicadas}>
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
          <div className="modal" style={{ width: 'min(960px, 92vw)' }}>
            <div className="modal-header">
              <span className="modal-title">Contrato — {ctDetalle?.ct_id}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDetalle(false)}
                style={{ padding: '0 6px' }} aria-label="Cerrar"><X size={16} /></button>
            </div>

            <div className="modal-body">
              {cargandoDet ? (
                <div className="page-loading"><Loader2 size={18} className="spinner" /><span>Cargando...</span></div>
              ) : ctDetalle && (
                <>
                  <div className="system-values-box" style={{ marginBottom: 16 }}>
                    <div className="form-grid-3">
                      {[
                        { id: 'ct-dc',  label: 'Contratista',  value: ctDetalle.nombre_contratista },
                        { id: 'ct-dp',  label: 'Proyecto',     value: ctDetalle.nombre_proyecto || '—' },
                        { id: 'ct-de',  label: 'Estado',       value: ctDetalle.estado },
                        { id: 'ct-df',  label: 'Forma pago',   value: ctDetalle.forma_pago || '—' },
                        { id: 'ct-dpc', label: '% Anticipo',   value: `${ctDetalle.pct_anticipo}%` },
                        { id: 'ct-dap', label: 'Aprobado por', value: ctDetalle.aprobado_por || '—' },
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
                    <textarea className="form-textarea" value={ctDetalle.objeto_contrato} disabled rows={2} />
                  </div>

                  {/* Detalle por capítulos */}
                  <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" style={{ margin: 0 }}>Capítulos contratados</label>
                    {['ACTIVO','EN_EJECUCIÓN'].includes(ctDetalle.estado) && puedeGestionar && (
                      <span className="form-hint">Clic en "Holgura" para adicionar valor a un capítulo</span>
                    )}
                  </div>

                  <div className="data-table-wrapper" style={{ marginBottom: 16 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Capítulo</th>
                          <th>Descripción</th>
                          <th style={{ textAlign: 'center' }}>Unidad</th>
                          <th style={{ textAlign: 'right' }}>V. Unitario</th>
                          <th style={{ textAlign: 'right' }}>Cantidad</th>
                          <th style={{ textAlign: 'right' }}>Valor base</th>
                          <th style={{ textAlign: 'right' }}>Holgura</th>
                          <th style={{ textAlign: 'right' }}>Total c/holgura</th>
                          {['ACTIVO','EN_EJECUCIÓN'].includes(ctDetalle.estado) && puedeGestionar && (
                            <th style={{ width: 90 }}></th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {detItems.map(det => (
                          <tr key={det.det_id}>
                            <td>
                              <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-primary)' }}>
                                {det.capitulo_id}
                              </span>
                              <span className="td-bold" style={{ display: 'block' }}>{det.nombre_capitulo}</span>
                            </td>
                            <td className="td-secondary">{det.descripcion}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="badge badge-neutral">{det.unidad}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>{fmtCOP(det.valor_unidad)}</td>
                            <td style={{ textAlign: 'right' }}>{det.cantidad.toLocaleString('es-CO')}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCOP(det.valor_total)}</td>
                            <td style={{ textAlign: 'right',
                              color: det.holgura > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)',
                              fontWeight: det.holgura > 0 ? 600 : 400 }}>
                              {det.holgura > 0 ? `+${fmtCOP(det.holgura)}` : '—'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                              {fmtCOP(det.valor_con_holgura)}
                            </td>
                            {['ACTIVO','EN_EJECUCIÓN'].includes(ctDetalle.estado) && puedeGestionar && (
                              <td>
                                <button className="btn btn-ghost btn-sm"
                                  style={{ color: 'var(--color-warning)', fontSize: 11 }}
                                  onClick={() => abrirHolgura(det)}>
                                  + Holgura
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                        <tr style={{ background: 'var(--color-bg)', borderTop: '2px solid var(--color-border)' }}>
                          <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700 }}>Total contrato</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {fmtCOP(detItems.reduce((s, d) => s + d.valor_total, 0))}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-warning)' }}>
                            {detItems.some(d => d.holgura > 0)
                              ? `+${fmtCOP(detItems.reduce((s, d) => s + d.holgura, 0))}`
                              : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 15, color: 'var(--color-primary)' }}>
                            {fmtCOP(ctDetalle.valor_contrato)}
                          </td>
                          {['ACTIVO','EN_EJECUCIÓN'].includes(ctDetalle.estado) && puedeGestionar && <td />}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                {ctDetalle && accionesCT(ctDetalle)}
              </div>
              <button className="btn btn-secondary" onClick={() => setShowDetalle(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal holgura ──────────────────────────────────── */}
      {showHolgura && holguraDet && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowHolgura(false)}>
          <div className="modal" style={{ width: 480 }}>
            <div className="modal-header">
              <span className="modal-title">Adicionar holgura — {holguraDet.nombre_capitulo}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowHolgura(false)}
                style={{ padding: '0 6px' }} aria-label="Cerrar"><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="system-values-box" style={{ marginBottom: 16 }}>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Valor base</label>
                    <input className="form-input font-mono" value={fmtCOP(holguraDet.valor_total)} disabled />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Holgura acumulada</label>
                    <input className="form-input font-mono"
                      value={holguraDet.holgura > 0 ? fmtCOP(holguraDet.holgura) : '—'} disabled />
                  </div>
                </div>
              </div>

              <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>El monto ingresado se sumará al comprometido del capítulo y al valor total del contrato.</span>
              </div>

              <div className="form-group">
                <label className="form-label required" htmlFor="hol-monto">
                  Monto a adicionar (COP)
                </label>
                <NumericInput id="hol-monto" value={montoHolgura}
                  onChange={setMontoHolgura} prefix="$" required />
                {montoHolgura > 0 && (
                  <span className="hint-ok">
                    Nuevo total del capítulo: {fmtCOP(holguraDet.valor_con_holgura + montoHolgura)}
                  </span>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowHolgura(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarHolgura}
                disabled={cargandoHol || montoHolgura <= 0}>
                {cargandoHol
                  ? <><Loader2 size={14} className="spinner" /> Guardando...</>
                  : 'Confirmar adición'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}