import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { useProyecto } from '../../context/ProyectoContext'
import AlertaProyecto from '../../components/ui/AlertaProyecto'
import { usePagination } from '../../hooks/usePagination'
import Pagination from '../../components/ui/Pagination'
import {
  Plus, FileText, Loader2, AlertCircle, X,
  Eye, Play, Pause, XCircle, CheckCircle2, Trash2, Pencil
} from 'lucide-react'
import NumericInput from '../../components/ui/NumericInput'

interface Proyecto { proyecto_id: string; nombre: string }
interface Edificacion { edificio_id: string; nombre: string; proyecto_id: string }
interface Contratista { contratista_id: string; nombre: string; nit: string; especialidad: string }

interface ItemCT {
  actividad_id: string
  capitulo_id: string
  nombre_capitulo: string
  codigo_cap: string
  codigo_sub: string
  nombre_actividad: string
  unidad: string
  vr_unitario: number
  cantidad: number
  cantidad_disponible: number
  cantidad_contratada: number
  valor_total: number
}

interface CTDetalle {
  det_id: string;
  capitulo_id: string;
  nombre_capitulo: string
  descripcion: string;
  unidad: string
  valor_unidad: number;
  cantidad: number
  valor_total: number;
  holgura: number;
  holgura_cantidad: number
  valor_con_holgura: number
}

interface CT {
  ct_id: string;
  proyecto_id: string;
  nombre_proyecto: string;
  edificio_id: string;
  nombre_edificio: string;
  capitulo_id: string;
  nombre_capitulo: string;
  contratista_id: string;
  nombre_contratista: string;
  objeto_contrato: string;
  valor_contrato: number;
  forma_pago: string;
  pct_anticipo: number;
  fecha_inicio: string;
  fecha_fin: string
  estado: string;
  aprobado_por: string;
  notas: string;
  tipo_contrato: string;
  valor_ejecutado_ct: number
  valor_por_ejecutar: number
  rete_garantia_valor: number
  rete_garantia_pct: number
  anticipo_por_amortizar: number
  valor_facturado: number
}

const fmtCOP = (v: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(v || 0)

const BADGE_ESTADO: Record<string, string> = {
  BORRADOR: 'badge-neutral',
  ACTIVO: 'badge-success',
  'EN_EJECUCIÓN': 'badge-info',
  SUSPENDIDO: 'badge-warning',
  LIQUIDADO: 'badge-neutral',
  ANULADO: 'badge-danger',
}

const TIPOS_CONTRATO: { valor: string; label: string; desc: string; color: string }[] = [
  {
    valor: 'TODO_COSTO',
    label: 'Todo costo',
    desc: 'Incluye materiales, mano de obra y equipos',
    color: 'badge-primary',
  },
  {
    valor: 'MANO_DE_OBRA',
    label: 'Mano de obra',
    desc: 'Solo mano de obra — materiales por separado',
    color: 'badge-info',
  },
  {
    valor: 'ALQUILER_EQUIPOS',
    label: 'Alquiler de equipos',
    desc: 'Alquiler de maquinaria o equipos especializados',
    color: 'badge-warning',
  },
]

const FORMAS_PAGO = ['ACTA_AVANCE', 'MENSUAL', 'QUINCENAL', 'CONTRAENTREGA', 'PRECIO_GLOBAL']
const ESTADOS = ['BORRADOR', 'ACTIVO', 'EN_EJECUCIÓN', 'SUSPENDIDO', 'LIQUIDADO', 'ANULADO']

const EMPTY_FORM = {
  proyecto_id: '', edificio_id: '',
  contratista_id: '', objeto_contrato: '',
  tipo_contrato: 'TODO_COSTO',
  forma_pago: '', pct_anticipo: 0,
  rete_garantia_pct: 0,
  fecha_inicio: '', fecha_fin: '', notas: ''
}

const EMPTY_ITEM: ItemCT = {
  actividad_id: '', capitulo_id: '', nombre_capitulo: '',
  codigo_cap: '', codigo_sub: '', nombre_actividad: '',
  unidad: '', vr_unitario: 0, cantidad: 0,
  cantidad_disponible: 0, cantidad_contratada: 0, valor_total: 0,
}

export default function CTPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { usuario } = useAuth()
  const { proyecto } = useProyecto()

  const [lista, setLista] = useState<CT[]>([])
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [edificaciones, setEdificaciones] = useState<Edificacion[]>([])
  const [contratistas, setContratistas] = useState<Contratista[]>([])
  const [filtroEstado, setFiltroEstado] = useState('')

  // Modal nuevo CT
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [items, setItems] = useState<ItemCT[]>([])
  const [edifModal, setEdifModal] = useState<Edificacion[]>([])
  const [actsDisp, setActsDisp] = useState<any[]>([])
  const [cargandoActs, setCargandoActs] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [maxAnticipoPct, setMaxAnticipoPct] = useState(50)

  // Modal detalle
  const [showDetalle, setShowDetalle] = useState(false)
  const [ctDetalle, setCtDetalle] = useState<CT | null>(null)
  const [detItems, setDetItems] = useState<CTDetalle[]>([])
  const [cargandoDet] = useState(false)

  // Modal holgura
  const [showHolgura, setShowHolgura] = useState(false)
  const [holguraDet, setHolguraDet] = useState<CTDetalle | null>(null)
  const [cantHolgura, setCantHolgura] = useState(0)
  const [cargandoHol, setCargandoHol] = useState(false)

  const [cargandoPagina, setCargandoPagina] = useState(true)

  const [showEditar, setShowEditar] = useState(false)
  const [formEditar, setFormEditar] = useState<any>({})
  const [guardandoEd, setGuardandoEd] = useState(false)
  const [errorEd, setErrorEd] = useState('')

  const pag = usePagination(lista)

  useEffect(() => {
    Promise.all([
      api.get('/api/ct'),
      api.get('/api/proyectos'),
      api.get('/api/edificaciones'),
      api.get('/api/contratistas?activo=1'),
      api.get('/api/config/anticipo'),
    ]).then(([rCT, rP, rE, rCont, rConf]) => {
      setLista(rCT.data.data)
      setProyectos(rP.data.data)
      setEdificaciones(rE.data.data)
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
    setActsDisp([])
    setItems([])
  }

  // Cascada edificación → actividades disponibles
  const handleEdificio = async (edifId: string) => {
    setForm(s => ({ ...s, edificio_id: edifId }))
    setItems([])
    if (!edifId) { setActsDisp([]); return }

    setCargandoActs(true)
    try {
      const params = new URLSearchParams()
      if (form.proyecto_id) params.append('proyecto_id', form.proyecto_id)
      params.append('edificio_id', edifId)
      const res = await api.get(`/api/ct/actividades-disponibles/lista?${params}`)
      setActsDisp(res.data.data)
    } finally { setCargandoActs(false) }
  }

  const agregarItem = () => setItems(s => [...s, { ...EMPTY_ITEM }])

  const eliminarItem = (idx: number) =>
    setItems(s => s.filter((_, i) => i !== idx))

  const seleccionarActividad = (idx: number, actId: string) => {
    const act = actsDisp.find(a => a.actividad_id === actId)
    if (!act) return
    const nuevos = [...items]
    nuevos[idx] = {
      actividad_id: act.actividad_id,
      capitulo_id: act.capitulo_id,
      nombre_capitulo: act.nombre_capitulo,
      codigo_cap: act.codigo_cap,
      codigo_sub: act.codigo_sub,
      nombre_actividad: act.nombre_actividad,
      unidad: act.unidad,
      vr_unitario: act.vr_unitario,
      cantidad: act.cantidad,
      cantidad_disponible: act.cantidad_disponible,
      cantidad_contratada: act.cantidad_disponible,
      valor_total: act.cantidad_disponible * act.vr_unitario,
    }
    setItems(nuevos)
  }

  const actualizarCantidad = (idx: number, val: number) => {
    const nuevos = [...items]
    nuevos[idx] = {
      ...nuevos[idx],
      cantidad_contratada: val,
      valor_total: val * nuevos[idx].vr_unitario,
    }
    setItems(nuevos)
  }

  const totalContrato = items.reduce((s, i) => s + i.valor_total, 0)
  const montoAnticipo = totalContrato * ((form.pct_anticipo || 0) / 100)
  const anticipoExcede = form.pct_anticipo > maxAnticipoPct
  const actsDuplicadas = items.map(i => i.actividad_id)
    .filter((v, i, a) => v && a.indexOf(v) !== i).length > 0

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (items.length === 0) { setError('Agregue al menos una actividad'); return }
    if (actsDuplicadas) { setError('Hay actividades duplicadas'); return }
    if (totalContrato <= 0) { setError('El valor total debe ser mayor a cero'); return }
    if (anticipoExcede) { setError(`El anticipo no puede superar el ${maxAnticipoPct}%`); return }
    if (form.fecha_inicio && form.fecha_fin && form.fecha_fin < form.fecha_inicio) { setError('La fecha de fin no puede ser anterior a la fecha de inicio'); return }

    for (const item of items) {
      if (!item.actividad_id) { setError('Todos los ítems deben tener una actividad'); return }
      if (item.cantidad_contratada <= 0) { setError(`La cantidad de "${item.nombre_actividad}" debe ser mayor a cero`); return }
      if (item.valor_total <= 0) { setError(`El valor de "${item.nombre_actividad}" debe ser mayor a cero`); return }
    }

    setCargando(true); setError('')
    try {
      await api.post('/api/ct', {
        ...form,
        items: items.map(i => ({
          actividad_id: i.actividad_id,
          capitulo_id: i.capitulo_id,
          nombre_capitulo: i.nombre_capitulo,
          nombre_actividad: i.nombre_actividad,
          unidad: i.unidad,
          vr_unitario: i.vr_unitario,
          cantidad_contratada: i.cantidad_contratada,
        }))
      })
      toast.success('Contrato creado correctamente')
      setShowForm(false); setForm(EMPTY_FORM); setItems([])
      cargarLista()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al guardar'
      setError(msg); toast.error(msg)
    } finally { setCargando(false) }
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
    setHolguraDet(det)
    setCantHolgura(0)
    setShowHolgura(true)
  }

  const guardarHolgura = async () => {
    if (!holguraDet || cantHolgura <= 0) { toast.error('La cantidad debe ser mayor a cero'); return }

    setCargandoHol(true)
    try {
      await api.put(
        `/api/ct/${ctDetalle?.ct_id}/detalle/${holguraDet.det_id}/holgura`,
        { holgura_cantidad: cantHolgura }
      )
      toast.success('Holgura agregada — comprometido actualizado')
      setShowHolgura(false)
      const res = await api.get(`/api/ct/${ctDetalle?.ct_id}`)
      setCtDetalle(res.data.data)
      setDetItems(res.data.data.detalle || [])
      cargarLista()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error')
    } finally { setCargandoHol(false) }
  }

  const puedeGestionar = ['ADMIN', 'COORDINADOR'].includes(usuario?.rol || '')

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

  const abrirEditar = (ct: CT) => {
    setFormEditar({
      objeto_contrato: ct.objeto_contrato,
      tipo_contrato: ct.tipo_contrato || 'TODO_COSTO',
      forma_pago: ct.forma_pago || '',
      pct_anticipo: ct.pct_anticipo || 0,
      fecha_inicio: ct.fecha_inicio || '',
      fecha_fin: ct.fecha_fin || '',
      notas: ct.notas || '',
    })
    setErrorEd('')
    setShowEditar(true)
  }

  const guardarEdicion = async () => {
    setGuardandoEd(true); setErrorEd('')
    try {
      await api.put(`/api/ct/${ctDetalle?.ct_id}`, formEditar)
      toast.success('Contrato actualizado')
      setShowEditar(false)
      // Refrescar detalle
      const res = await api.get(`/api/ct/${ctDetalle?.ct_id}`)
      setCtDetalle(res.data.data)
      setDetItems(res.data.data.detalle || [])
      cargarLista()
    } catch (err: any) {
      setErrorEd(err.response?.data?.error || 'Error al guardar')
    } finally { setGuardandoEd(false) }
  }

  return (
    <MainLayout>
      <AlertaProyecto />
      <div className="page-header">
        <div>
          <h1 className="page-title">Contratos de Obra</h1>
          <p className="page-subtitle">{lista.length} contrato{lista.length !== 1 ? 's' : ''}</p>
        </div>
        {puedeGestionar && (
          <button className="btn btn-primary" onClick={() => {
            setForm({ ...EMPTY_FORM, proyecto_id: proyecto?.proyecto_id || '' }); setItems([])
            setEdifModal([]); setActsDisp([])
            setError(''); setShowForm(true)
            if (proyecto?.proyecto_id) handleProyecto(proyecto.proyecto_id)
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
        <div className="data-table-wrapper" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th>Contrato</th>
                <th>Contratista</th>
                <th>Tipo</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th style={{ textAlign: 'right' }}>Retegarantía</th>
                <th style={{ textAlign: 'right' }}>Ejecutado</th>
                <th style={{ textAlign: 'right' }}>Por ejecutar</th>
                <th style={{ textAlign: 'right' }}>Anticipo amort.</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pag.itemsPagina.length === 0 ? (
                <tr><td colSpan={10}>
                  <div className="search-empty-state">
                    <FileText size={32} style={{ color: 'var(--color-text-muted)' }} />
                    <span>No hay contratos registrados</span>
                  </div>
                </td></tr>
              ) : pag.itemsPagina.map(ct => (
                <tr key={ct.ct_id}>
                  <td>
                    <span className="td-id">{ct.ct_id}</span>
                    <span className="td-muted" style={{ display: 'block', fontSize: 11 }}>
                      {ct.nombre_proyecto}
                    </span>
                  </td>
                  <td className="td-bold">{ct.nombre_contratista}</td>
                  <td>
                    {(() => {
                      const t = TIPOS_CONTRATO.find(t => t.valor === ct.tipo_contrato)
                      return <span className={`badge ${t?.color || 'badge-neutral'}`}
                        style={{ fontSize: 10 }}>{t?.label || 'Todo costo'}</span>
                    })()}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {fmtCOP(ct.valor_contrato)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {ct.rete_garantia_pct > 0 ? (
                      <>
                        <span style={{ fontWeight: 600, color: 'var(--color-warning)' }}>
                          {fmtCOP(ct.rete_garantia_valor)}
                        </span>
                        <span className="td-muted" style={{ display: 'block', fontSize: 10 }}>
                          {ct.rete_garantia_pct}%
                        </span>
                      </>
                    ) : <span className="td-muted">—</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {ct.valor_ejecutado_ct > 0 ? (
                      <>
                        <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                          {fmtCOP(ct.valor_ejecutado_ct)}
                        </span>
                        <div style={{ height: 3, background: '#e2e8f0', borderRadius: 2, marginTop: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 2,
                            width: `${Math.min((ct.valor_ejecutado_ct / ct.valor_contrato) * 100, 100)}%`,
                            background: 'var(--color-success)'
                          }} />
                        </div>
                      </>
                    ) : <span className="td-muted">$ 0</span>}
                  </td>
                  <td style={{
                    textAlign: 'right',
                    color: ct.valor_por_ejecutar > 0 ? 'var(--color-info)' : 'var(--color-text-muted)',
                    fontWeight: 600
                  }}>
                    {fmtCOP(ct.valor_por_ejecutar)}
                  </td>
                  <td style={{
                    textAlign: 'right',
                    color: ct.anticipo_por_amortizar > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)',
                    fontWeight: ct.anticipo_por_amortizar > 0 ? 600 : 400
                  }}>
                    {ct.anticipo_por_amortizar > 0 ? fmtCOP(ct.anticipo_por_amortizar) : '—'}
                  </td>
                  <td>
                    <span className={`badge ${BADGE_ESTADO[ct.estado] || 'badge-neutral'}`}>
                      {ct.estado}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/contratos/${ct.ct_id}`)}>
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

                {/* Tipo de contrato */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label required">Tipo de contrato</label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {TIPOS_CONTRATO.map(t => (
                      <label key={t.valor} style={{
                        flex: 1, minWidth: 160, cursor: 'pointer',
                        border: `2px solid ${form.tipo_contrato === t.valor ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        borderRadius: 'var(--radius-md)', padding: '10px 14px',
                        background: form.tipo_contrato === t.valor ? 'var(--color-primary-light)' : 'white',
                        transition: 'all var(--transition)',
                      }}>
                        <input type="radio" name="tipo_contrato" value={t.valor}
                          checked={form.tipo_contrato === t.valor}
                          onChange={() => set('tipo_contrato', t.valor)}
                          style={{ display: 'none' }} />
                        <div style={{
                          fontWeight: 600, fontSize: 13,
                          color: form.tipo_contrato === t.valor ? 'var(--color-primary)' : 'var(--color-text-primary)',
                          marginBottom: 3
                        }}>
                          {t.label}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {t.desc}
                        </div>
                      </label>
                    ))}
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

                {/* Anticipo + Retegarantía + Fecha inicio */}
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
                    <label className="form-label" htmlFor="ct-rete">
                      % Retegarantía
                    </label>
                    <NumericInput id="ct-rete" value={form.rete_garantia_pct}
                      onChange={val => set('rete_garantia_pct', val)}
                      suffix="%" decimals={1} />
                    <span className="form-hint">Porcentaje de garantía sobre lo ejecutado</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ct-ini">Fecha inicio</label>
                    <input id="ct-ini" type="date" className="form-input"
                      value={form.fecha_inicio}
                      onChange={e => set('fecha_inicio', e.target.value)} />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label" htmlFor="ct-fin">Fecha fin</label>
                  <input id="ct-fin" type="date" className="form-input"
                    value={form.fecha_fin}
                    min={form.fecha_inicio || undefined}
                    onChange={e => set('fecha_fin', e.target.value)} />
                </div>

                {/* ── Tabla de actividades ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    Actividades del contrato
                  </label>
                  <button type="button" className="btn btn-secondary btn-sm"
                    onClick={agregarItem} disabled={!form.edificio_id || cargandoActs}>
                    {cargandoActs
                      ? <><Loader2 size={13} className="spinner" /> Cargando...</>
                      : <><Plus size={13} /> Agregar actividad</>
                    }
                  </button>
                </div>

                {!form.edificio_id ? (
                  <div className="alert alert-info" style={{ marginBottom: 16 }}>
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>Selecciona proyecto y edificación para agregar actividades</span>
                  </div>
                ) : actsDisp.length === 0 && !cargandoActs ? (
                  <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>No hay actividades con presupuesto disponible en esta edificación</span>
                  </div>
                ) : items.length > 0 ? (
                  <div className="data-table-wrapper" style={{ marginBottom: 16 }}>
                    <table className="data-table" style={{ tableLayout: 'fixed' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '30%' }}>Actividad</th>
                          <th style={{ width: '8%', textAlign: 'center' }}>Und.</th>
                          <th style={{ width: '13%', textAlign: 'right' }}>V. Unitario</th>
                          <th style={{ width: '11%', textAlign: 'right' }}>Disponible</th>
                          <th style={{ width: '14%' }}>A contratar</th>
                          <th style={{ width: '16%', textAlign: 'right' }}>Total</th>
                          <th style={{ width: '8%' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx} style={{
                            background: item.cantidad_contratada > item.cantidad_disponible
                              ? 'rgba(220,38,38,0.04)' : undefined
                          }}>
                            <td>
                              <select className="form-select" style={{ fontSize: 11 }}
                                value={item.actividad_id}
                                onChange={e => seleccionarActividad(idx, e.target.value)}
                                aria-label={`Actividad ${idx + 1}`}>
                                <option value="">Selecciona actividad...</option>
                                {actsDisp.map(a => (
                                  <option key={a.actividad_id} value={a.actividad_id}
                                    disabled={items.some((i, i2) => i2 !== idx && i.actividad_id === a.actividad_id)}>
                                    {a.codigo_cap}.{a.codigo_sub} — {a.nombre_actividad}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {item.unidad
                                ? <span className="badge badge-neutral">{item.unidad}</span>
                                : <span className="td-muted">—</span>
                              }
                            </td>
                            <td style={{ textAlign: 'right', fontSize: 12 }}>
                              {item.vr_unitario > 0 ? (
                                <>
                                  <span style={{ fontWeight: 600 }}>{fmtCOP(item.vr_unitario)}</span>
                                  <span className="form-hint" style={{ display: 'block', fontSize: 9 }}>
                                    del presupuesto
                                  </span>
                                </>
                              ) : '—'}
                            </td>
                            <td style={{
                              textAlign: 'right', fontSize: 12,
                              color: 'var(--color-success)', fontWeight: 600
                            }}>
                              {item.cantidad_disponible > 0
                                ? item.cantidad_disponible.toLocaleString('es-CO')
                                : '—'}
                            </td>
                            <td>
                              <NumericInput
                                value={item.cantidad_contratada}
                                onChange={val => actualizarCantidad(idx, val)}
                                decimals={2} />
                              {item.cantidad_contratada > item.cantidad_disponible && item.cantidad_disponible > 0 && (
                                <span className="hint-error" style={{ fontSize: 10 }}>Supera disponible</span>
                              )}
                            </td>
                            <td style={{
                              textAlign: 'right', fontWeight: 700,
                              color: 'var(--color-primary)', fontSize: 12
                            }}>
                              {item.valor_total > 0 ? fmtCOP(item.valor_total) : '—'}
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
                        {items.length > 1 && (
                          <tr style={{ background: 'var(--color-bg)', borderTop: '2px solid var(--color-border)' }}>
                            <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                              Valor total del contrato
                            </td>
                            <td style={{
                              textAlign: 'right', fontWeight: 700, fontSize: 15,
                              color: 'var(--color-primary)'
                            }}>
                              {fmtCOP(totalContrato)}
                            </td>
                            <td />
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>Haz clic en "Agregar actividad" para comenzar</span>
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
                  disabled={cargando || anticipoExcede || actsDuplicadas}>
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
                        {
                          id: 'ct-tipo', label: 'Tipo', value:
                            TIPOS_CONTRATO.find(t => t.valor === ctDetalle.tipo_contrato)?.label || 'Todo costo'
                        },
                        { id: 'ct-dc', label: 'Contratista', value: ctDetalle.nombre_contratista },
                        { id: 'ct-dp', label: 'Proyecto', value: ctDetalle.nombre_proyecto || '—' },
                        { id: 'ct-de', label: 'Estado', value: ctDetalle.estado },
                        { id: 'ct-df', label: 'Forma pago', value: ctDetalle.forma_pago || '—' },
                        { id: 'ct-dpc', label: '% Anticipo', value: `${ctDetalle.pct_anticipo}%` },
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

                  {/* Resumen financiero */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: 10, marginBottom: 16
                  }}>
                    {[
                      { label: 'Valor contrato',    value: fmtCOP(ctDetalle.valor_contrato),          color: 'var(--color-primary)' },
                      { label: 'Retegarantía',       value: fmtCOP(ctDetalle.rete_garantia_valor),     color: 'var(--color-warning)' },
                      { label: 'Ejecutado',          value: fmtCOP(ctDetalle.valor_ejecutado_ct),      color: 'var(--color-success)' },
                      { label: 'Por ejecutar',       value: fmtCOP(ctDetalle.valor_por_ejecutar),      color: 'var(--color-info)' },
                      { label: 'Anticipo x amort.',  value: fmtCOP(ctDetalle.anticipo_por_amortizar),  color: ctDetalle.anticipo_por_amortizar > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)' },
                    ].map(k => (
                      <div key={k.label} style={{
                        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)', padding: '10px 14px', textAlign: 'center'
                      }}>
                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)',
                          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                          {k.label}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: k.color }}>
                          {k.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Detalle por capítulos */}
                  <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" style={{ margin: 0 }}>Capítulos contratados</label>
                    {['ACTIVO', 'EN_EJECUCIÓN'].includes(ctDetalle.estado) && puedeGestionar && (
                      <span className="form-hint">Clic en "Holgura" para adicionar valor a un capítulo</span>
                    )}
                  </div>

                  <div className="data-table-wrapper" style={{ marginBottom: 16, overflowX: 'auto' }}>
                    <table className="data-table" style={{ minWidth: 750 }}>
                      <thead>
                        <tr>
                          <th>Capítulo</th>
                          <th>Descripción</th>
                          <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Unidad</th>
                          <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>V. Unitario</th>
                          <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Cantidad</th>
                          <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Valor base</th>
                          <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Holgura</th>
                          <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Total c/holgura</th>
                          {['ACTIVO', 'EN_EJECUCIÓN'].includes(ctDetalle?.estado || '') && puedeGestionar && (
                            <th style={{ width: 90, whiteSpace: 'nowrap' }}></th>
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
                            <td style={{
                              textAlign: 'right',
                              color: det.holgura_cantidad > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)',
                              fontWeight: det.holgura_cantidad > 0 ? 600 : 400
                            }}>
                              {det.holgura_cantidad > 0
                                ? `+${det.holgura_cantidad.toLocaleString('es-CO')} ${det.unidad}`
                                : '—'
                              }
                              {det.holgura > 0 && (
                                <span style={{ display: 'block', fontSize: 10, fontWeight: 400 }}>
                                  {fmtCOP(det.holgura)}
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                              {fmtCOP(det.valor_con_holgura)}
                            </td>
                            {['ACTIVO', 'EN_EJECUCIÓN'].includes(ctDetalle.estado) && puedeGestionar && (
                              <td>
                                <button className="btn btn-ghost btn-sm"
                                  style={{ color: 'var(--color-warning)', fontSize: 11, whiteSpace: 'nowrap' }}
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
                          {['ACTIVO', 'EN_EJECUCIÓN'].includes(ctDetalle.estado) && puedeGestionar && <td />}
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
                {puedeGestionar && ctDetalle &&
                  !['LIQUIDADO', 'ANULADO'].includes(ctDetalle.estado) && (
                    <button type="button" className="btn btn-ghost btn-sm"
                      onClick={() => abrirEditar(ctDetalle)}>
                      <Pencil size={13} /> Editar
                    </button>
                  )}
              </div>
              <button className="btn btn-secondary" onClick={() => setShowDetalle(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal edición CT ───────────────────────────────── */}
      {showEditar && ctDetalle && (
        <div className="modal-overlay"
          onClick={e => e.target === e.currentTarget && setShowEditar(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">
                Editar contrato — {ctDetalle.ct_id}
                <span className={`badge ${BADGE_ESTADO[ctDetalle.estado]}`}
                  style={{ marginLeft: 8, fontSize: 11 }}>
                  {ctDetalle.estado}
                </span>
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowEditar(false)}
                style={{ padding: '0 6px' }} aria-label="Cerrar"><X size={16} /></button>
            </div>

            <div className="modal-body">
              {errorEd && (
                <div className="alert alert-error">
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{errorEd}</span>
                </div>
              )}

              {ctDetalle.estado === 'BORRADOR' && (
                <>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label required" htmlFor="ed-objeto">Objeto del contrato</label>
                    <textarea id="ed-objeto" className="form-textarea"
                      value={formEditar.objeto_contrato}
                      onChange={e => setFormEditar((s: any) => ({ ...s, objeto_contrato: e.target.value }))}
                      rows={3} placeholder="Descripción del trabajo a realizar" />
                  </div>

                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label">Tipo de contrato</label>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {TIPOS_CONTRATO.map(t => (
                        <label key={t.valor} style={{
                          flex: 1, minWidth: 140, cursor: 'pointer',
                          border: `2px solid ${formEditar.tipo_contrato === t.valor ? 'var(--color-primary)' : 'var(--color-border)'}`,
                          borderRadius: 'var(--radius-md)', padding: '8px 12px',
                          background: formEditar.tipo_contrato === t.valor ? 'var(--color-primary-light)' : 'white',
                        }}>
                          <input type="radio" style={{ display: 'none' }}
                            aria-label={t.label}
                            checked={formEditar.tipo_contrato === t.valor}
                            onChange={() => setFormEditar((s: any) => ({ ...s, tipo_contrato: t.valor }))} />
                          <div style={{
                            fontWeight: 600, fontSize: 12,
                            color: formEditar.tipo_contrato === t.valor ? 'var(--color-primary)' : 'var(--color-text-primary)'
                          }}>
                            {t.label}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="form-grid-2" style={{ marginBottom: 16 }}>
                    <div className="form-group">
                      <label className="form-label">Forma de pago</label>
                      <select className="form-select"
                        value={formEditar.forma_pago}
                        onChange={e => setFormEditar((s: any) => ({ ...s, forma_pago: e.target.value }))}
                        aria-label="Forma de pago">
                        <option value="">Sin especificar</option>
                        {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">% Anticipo</label>
                      <NumericInput value={formEditar.pct_anticipo}
                        onChange={val => setFormEditar((s: any) => ({ ...s, pct_anticipo: val }))}
                        suffix="%" decimals={1} />
                    </div>
                  </div>

                  <div className="form-grid-2" style={{ marginBottom: 16 }}>
                    <div className="form-group">
                      <label className="form-label" htmlFor="ed-fecha-ini">Fecha inicio</label>
                      <input id="ed-fecha-ini" type="date" className="form-input"
                        value={formEditar.fecha_inicio}
                        onChange={e => setFormEditar((s: any) => ({ ...s, fecha_inicio: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="ed-fecha-fin">Fecha fin</label>
                      <input id="ed-fecha-fin" type="date" className="form-input"
                        value={formEditar.fecha_fin}
                        min={formEditar.fecha_inicio || undefined}
                        onChange={e => setFormEditar((s: any) => ({ ...s, fecha_fin: e.target.value }))} />
                    </div>
                  </div>
                </>
              )}

              {['ACTIVO', 'EN_EJECUCIÓN', 'SUSPENDIDO'].includes(ctDetalle.estado) && (
                <div className="alert alert-info" style={{ marginBottom: 16 }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>
                    El contrato está <strong>{ctDetalle.estado}</strong> — solo puedes
                    editar las notas. Para agregar cantidades usa el botón{' '}
                    <strong>+ Holgura</strong> en cada ítem.
                  </span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Notas</label>
                <textarea className="form-textarea"
                  value={formEditar.notas}
                  onChange={e => setFormEditar((s: any) => ({ ...s, notas: e.target.value }))}
                  rows={3} placeholder="Observaciones del contrato" />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowEditar(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={guardarEdicion}
                disabled={guardandoEd}>
                {guardandoEd
                  ? <><Loader2 size={14} className="spinner" /> Guardando...</>
                  : 'Guardar cambios'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal holgura ──────────────────────────────────── */}
      {showHolgura && holguraDet && (
        <div className="modal-overlay"
          onClick={e => e.target === e.currentTarget && setShowHolgura(false)}>
          <div className="modal" style={{ width: 480 }}>
            <div className="modal-header">
              <span className="modal-title">
                Adicionar holgura — {holguraDet.nombre_capitulo}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowHolgura(false)}
                style={{ padding: '0 6px' }} aria-label="Cerrar"><X size={16} /></button>
            </div>

            <div className="modal-body">
              <div className="system-values-box" style={{ marginBottom: 16 }}>
                <p className="system-values-box__title">Ítem contratado</p>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Actividad</label>
                    <input className="form-input" value={holguraDet.descripcion} disabled />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unidad</label>
                    <input className="form-input" value={holguraDet.unidad} disabled />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cantidad contratada</label>
                    <input className="form-input font-mono"
                      value={holguraDet.cantidad.toLocaleString('es-CO')} disabled />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Valor unitario</label>
                    <input className="form-input font-mono"
                      value={fmtCOP(holguraDet.valor_unidad)} disabled />
                  </div>
                </div>

                {holguraDet.holgura_cantidad > 0 && (
                  <div style={{
                    marginTop: 10, padding: '8px 12px', fontSize: 12,
                    background: 'var(--color-warning-bg)', borderRadius: 'var(--radius-md)'
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-warning)' }}>
                      Holgura acumulada:
                    </span>{' '}
                    {holguraDet.holgura_cantidad.toLocaleString('es-CO')} {holguraDet.unidad}
                    {' '}({fmtCOP(holguraDet.holgura)})
                  </div>
                )}
              </div>

              <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>
                  Las cantidades adicionales se suman al comprometido del capítulo
                  y al valor total del contrato.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label required">
                  Cantidad adicional ({holguraDet.unidad})
                </label>
                <NumericInput
                  value={cantHolgura}
                  onChange={setCantHolgura}
                  decimals={2}
                />

                {cantHolgura > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 13, padding: '8px 12px',
                      background: 'var(--color-bg)', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)'
                    }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>
                        Valor adicional:
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                        {cantHolgura.toLocaleString('es-CO')} {holguraDet.unidad} × {fmtCOP(holguraDet.valor_unidad)}
                        {' '}= <strong>{fmtCOP(cantHolgura * holguraDet.valor_unidad)}</strong>
                      </span>
                    </div>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 13, padding: '8px 12px', marginTop: 6,
                      background: 'var(--color-primary-light)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-primary)',
                    }}>
                      <span style={{ fontWeight: 600 }}>Nuevo total del ítem:</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                        {(holguraDet.cantidad + (holguraDet.holgura_cantidad || 0) + cantHolgura).toLocaleString('es-CO')} {holguraDet.unidad}
                        {' '}→ {fmtCOP(holguraDet.valor_total + holguraDet.holgura + (cantHolgura * holguraDet.valor_unidad))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowHolgura(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={guardarHolgura}
                disabled={cargandoHol || cantHolgura <= 0}>
                {cargandoHol
                  ? <><Loader2 size={14} className="spinner" /> Guardando...</>
                  : 'Confirmar holgura'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}