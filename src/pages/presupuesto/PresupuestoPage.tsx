import { useEffect, useState } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import {
  ChevronRight, ChevronDown, Plus, Pencil,
  Trash2, Loader2, AlertCircle, X, Layers,
  FolderOpen, Folder, Activity, RefreshCw
} from 'lucide-react'
import NumericInput from '../../components/ui/NumericInput'
import './PresupuestoPage.css'

// ── Tipos ────────────────────────────────────────────────
interface Proyecto    { proyecto_id: string; nombre: string }
interface Edificacion { edificio_id: string; nombre: string; proyecto_id: string }

interface Capitulo {
  capitulo_id: string; codigo: string; nombre_capitulo: string
  valor_presupuestado: number; valor_comprometido: number
  valor_ejecutado: number; avance_fisico_pct: number
  total_sub_capitulos: number; total_actividades: number
  nombre_edificio: string; nombre_proyecto: string
}

interface SubCapitulo {
  sub_capitulo_id: string; capitulo_id: string; codigo: string
  nombre_sub_capitulo: string; valor_presupuestado: number
  valor_comprometido: number; valor_ejecutado: number
  total_actividades: number; estado: string
}

interface Actividad {
  actividad_id: string; sub_capitulo_id: string; capitulo_id: string
  codigo: string; nombre_actividad: string; tipo: 'DETALLADA' | 'GLOBAL'
  unidad: string; cantidad: number; vr_unitario: number; vr_total: number
  valor_comprometido: number; valor_ejecutado: number; avance_fisico_pct: number
  estado: string
}

// ── Formateo ─────────────────────────────────────────────
const fmtCOP = (v: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(v || 0)

const fmtCOPCorto = (v: number) => {
  if (!v) return '$ 0'
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000)     return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)         return `$${(v / 1_000).toFixed(0)}K`
  return fmtCOP(v)
}

// ── Forms vacíos ─────────────────────────────────────────
const EMPTY_CAP  = { codigo: '', nombre_capitulo: '', notas: '' }
const EMPTY_SUB  = { codigo: '', nombre_sub_capitulo: '', notas: '' }
const EMPTY_ACT  = {
  codigo: '', nombre_actividad: '',
  tipo: 'DETALLADA' as 'DETALLADA' | 'GLOBAL',
  unidad: '', cantidad: 0, vr_unitario: 0, vr_total: 0, notas: ''
}

const UNIDADES_CONSTRUCCION = [
  'm²', 'm³', 'ml', 'm',
  'und', 'glb', 'lte',
  'kg', 'ton', 'lb',
  'lt', 'gal',
  'hr', 'día', 'mes', 'jor',
  'vje', 'vta',
  'bl', 'rll', 'plg', 'jgo', 'par',
]

export default function PresupuestoPage() {
  const { toast }   = useToast()
  const { usuario } = useAuth()

  // ── Datos maestros ──────────────────────────────────────
  const [proyectos,     setProyectos]     = useState<Proyecto[]>([])
  const [edificaciones, setEdificaciones] = useState<Edificacion[]>([])
  const [edifFilt,      setEdifFilt]      = useState<Edificacion[]>([])
  const [filtProy,      setFiltProy]      = useState('')
  const [filtEdif,      setFiltEdif]      = useState('')

  // ── Datos del árbol ─────────────────────────────────────
  const [capitulos,  setCapitulos]  = useState<Capitulo[]>([])
  const [subCaps,    setSubCaps]    = useState<Record<string, SubCapitulo[]>>({})
  const [acts,       setActs]       = useState<Record<string, Actividad[]>>({})
  const [expanded,   setExpanded]   = useState<Record<string, boolean>>({})
  const [cargando,   setCargando]   = useState(false)

  // ── Modales ─────────────────────────────────────────────
  const [modalCap,   setModalCap]   = useState<{modo: 'crear' | 'editar'; data?: Capitulo} | null>(null)
  const [modalSub,   setModalSub]   = useState<{modo: 'crear' | 'editar'; capituloId?: string; data?: SubCapitulo} | null>(null)
  const [modalAct,   setModalAct]   = useState<{modo: 'crear' | 'editar'; subCapId?: string; data?: Actividad} | null>(null)

  const [formCap,    setFormCap]    = useState(EMPTY_CAP)
  const [formSub,    setFormSub]    = useState(EMPTY_SUB)
  const [formAct,    setFormAct]    = useState(EMPTY_ACT)
  const [error,      setError]      = useState('')
  const [guardando,  setGuardando]  = useState(false)
  const [unidadPersonalizada, setUnidadPersonalizada] = useState(false)

  const puedeEditar = ['ADMIN','COORDINADOR'].includes(usuario?.rol || '')

  // ── Carga inicial ───────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get('/api/proyectos'),
      api.get('/api/edificaciones'),
    ]).then(([rP, rE]) => {
      setProyectos(rP.data.data)
      setEdificaciones(rE.data.data)
    })
  }, [])

  // ── Cargar capítulos ────────────────────────────────────
  const cargarCapitulos = async (proy = filtProy, edif = filtEdif) => {
    if (!proy) { setCapitulos([]); return }
    setCargando(true)
    try {
      const params = new URLSearchParams()
      params.append('proyecto_id', proy)
      if (edif) params.append('edificio_id', edif)
      const res = await api.get(`/api/capitulos?${params}`)
      setCapitulos(res.data.data)
      setSubCaps({}); setActs({})
    } finally { setCargando(false) }
  }

  const handleProy = (proyId: string) => {
    setFiltProy(proyId); setFiltEdif('')
    setEdifFilt(edificaciones.filter(e => e.proyecto_id === proyId))
    cargarCapitulos(proyId, '')
    setExpanded({})
  }

  const handleEdif = (edifId: string) => {
    setFiltEdif(edifId)
    cargarCapitulos(filtProy, edifId)
    setExpanded({})
  }

  // ── Expandir capítulo → cargar sub-caps ─────────────────
  const toggleCapitulo = async (cap: Capitulo) => {
    const abierto = expanded[cap.capitulo_id]
    setExpanded(s => ({ ...s, [cap.capitulo_id]: !abierto }))

    if (!abierto && !subCaps[cap.capitulo_id]) {
      const res = await api.get(`/api/sub-capitulos?capitulo_id=${cap.capitulo_id}`)
      setSubCaps(s => ({ ...s, [cap.capitulo_id]: res.data.data }))
    }
  }

  // ── Expandir sub-cap → cargar actividades ───────────────
  const toggleSubCap = async (sub: SubCapitulo) => {
    const key    = `sub_${sub.sub_capitulo_id}`
    const abierto = expanded[key]
    setExpanded(s => ({ ...s, [key]: !abierto }))

    if (!abierto && !acts[sub.sub_capitulo_id]) {
      const res = await api.get(`/api/actividades?sub_capitulo_id=${sub.sub_capitulo_id}`)
      setActs(s => ({ ...s, [sub.sub_capitulo_id]: res.data.data }))
    }
  }

  // ── Totales globales ────────────────────────────────────
  const totalPres  = capitulos.reduce((s, c) => s + c.valor_presupuestado, 0)
  const totalComp  = capitulos.reduce((s, c) => s + c.valor_comprometido, 0)
  const totalEjec  = capitulos.reduce((s, c) => s + c.valor_ejecutado, 0)
  const avanceProm = capitulos.length > 0
    ? capitulos.reduce((s, c) => s + c.avance_fisico_pct, 0) / capitulos.length : 0

  // ── Helpers modales ─────────────────────────────────────
  const setCap  = (k: string, v: any) => setFormCap(s => ({ ...s, [k]: v }))
  const setSub  = (k: string, v: any) => setFormSub(s => ({ ...s, [k]: v }))
  const setAct  = (k: string, v: any) => {
    setFormAct(s => {
      const nuevo = { ...s, [k]: v }
      if (k === 'cantidad' || k === 'vr_unitario') {
        nuevo.vr_total = nuevo.cantidad * nuevo.vr_unitario
      }
      return nuevo
    })
  }

  // ── CRUD Capítulo ───────────────────────────────────────
  const guardarCapitulo = async () => {
  if (!formCap.codigo || !formCap.nombre_capitulo)
    { setError('Código y nombre son requeridos'); return }
  if (!filtEdif)
    { setError('Selecciona una edificación primero'); return }

  setGuardando(true); setError('')
  try {
    if (modalCap?.modo === 'crear') {
      await api.post('/api/capitulos', {
        codigo:          formCap.codigo,
        nombre_capitulo: formCap.nombre_capitulo,
        notas:           formCap.notas,
        edificio_id:     filtEdif,   // ← viene del filtro
        proyecto_id:     filtProy,   // ← viene del filtro
      })
      toast.success('Capítulo creado')
    } else {
      await api.put(`/api/capitulos/${modalCap?.data?.capitulo_id}`, {
        codigo:          formCap.codigo,
        nombre_capitulo: formCap.nombre_capitulo,
        notas:           formCap.notas,
      })
      toast.success('Capítulo actualizado')
    }
    setModalCap(null); cargarCapitulos()
  } catch (err: any) {
    setError(err.response?.data?.error || 'Error al guardar')
  } finally { setGuardando(false) }
}

  // ── CRUD Sub-capítulo ───────────────────────────────────
  const guardarSubCap = async () => {
    if (!formSub.codigo || !formSub.nombre_sub_capitulo)
      { setError('Código y nombre son requeridos'); return }

    setGuardando(true); setError('')
    try {
      if (modalSub?.modo === 'crear') {
        await api.post('/api/sub-capitulos', {
          ...formSub, capitulo_id: modalSub.capituloId
        })
        toast.success('Sub-capítulo creado')
        // Recargar sub-caps del capítulo
        const res = await api.get(`/api/sub-capitulos?capitulo_id=${modalSub.capituloId}`)
        setSubCaps(s => ({ ...s, [modalSub.capituloId!]: res.data.data }))
      } else {
        await api.put(`/api/sub-capitulos/${modalSub?.data?.sub_capitulo_id}`, formSub)
        toast.success('Sub-capítulo actualizado')
        const cap = modalSub?.data?.capitulo_id!
        const res = await api.get(`/api/sub-capitulos?capitulo_id=${cap}`)
        setSubCaps(s => ({ ...s, [cap]: res.data.data }))
      }
      setModalSub(null); cargarCapitulos()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar')
    } finally { setGuardando(false) }
  }

  // ── CRUD Actividad ──────────────────────────────────────
  const guardarActividad = async () => {
    if (!formAct.codigo || !formAct.nombre_actividad)
      { setError('Código y nombre son requeridos'); return }
    if (formAct.tipo === 'DETALLADA' && !formAct.unidad)
      { setError('La actividad detallada requiere unidad'); return }

    setGuardando(true); setError('')
    try {
      if (modalAct?.modo === 'crear') {
        await api.post('/api/actividades', {
          ...formAct, sub_capitulo_id: modalAct.subCapId
        })
        toast.success('Actividad creada')
        const res = await api.get(`/api/actividades?sub_capitulo_id=${modalAct.subCapId}`)
        setActs(s => ({ ...s, [modalAct.subCapId!]: res.data.data }))
      } else {
        await api.put(`/api/actividades/${modalAct?.data?.actividad_id}`, formAct)
        toast.success('Actividad actualizada')
        const sub = modalAct?.data?.sub_capitulo_id!
        const res = await api.get(`/api/actividades?sub_capitulo_id=${sub}`)
        setActs(s => ({ ...s, [sub]: res.data.data }))
      }
      setModalAct(null); cargarCapitulos()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar')
    } finally { setGuardando(false) }
  }

  // ── Eliminar ────────────────────────────────────────────
  const eliminarCapitulo = async (cap: Capitulo) => {
    if (!confirm(`¿Eliminar capítulo "${cap.nombre_capitulo}"?`)) return
    try {
      await api.delete(`/api/capitulos/${cap.capitulo_id}`)
      toast.success('Capítulo eliminado'); cargarCapitulos()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  const eliminarSubCap = async (sub: SubCapitulo) => {
    if (!confirm(`¿Eliminar sub-capítulo "${sub.nombre_sub_capitulo}"?`)) return
    try {
      await api.delete(`/api/sub-capitulos/${sub.sub_capitulo_id}`)
      toast.success('Sub-capítulo eliminado')
      const res = await api.get(`/api/sub-capitulos?capitulo_id=${sub.capitulo_id}`)
      setSubCaps(s => ({ ...s, [sub.capitulo_id]: res.data.data }))
      cargarCapitulos()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  const eliminarActividad = async (act: Actividad) => {
    if (!confirm(`¿Eliminar actividad "${act.nombre_actividad}"?`)) return
    try {
      await api.delete(`/api/actividades/${act.actividad_id}`)
      toast.success('Actividad eliminada')
      const res = await api.get(`/api/actividades?sub_capitulo_id=${act.sub_capitulo_id}`)
      setActs(s => ({ ...s, [act.sub_capitulo_id]: res.data.data }))
      cargarCapitulos()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  // ── Barra de progreso inline ─────────────────────────────
  const BarraProgreso = ({ pct, variant }: { pct: number; variant: 'light' | 'primary' }) => (
    <div className="presupuesto-progress-row">
      <progress
        className={`presupuesto-progress presupuesto-progress--${variant}`}
        value={Math.min(pct, 100)}
        max={100}
        aria-label={`Avance ${pct.toFixed(1)}%`}
      />
      <span className="presupuesto-progress-text">{pct.toFixed(1)}%</span>
    </div>
  )

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Presupuesto de Obra</h1>
          <p className="page-subtitle">Capítulos → Sub-capítulos → Actividades</p>
        </div>
        <div className="presupuesto-header-actions">
          {puedeEditar && filtEdif && (
            <button type="button" className="btn btn-primary" onClick={() => {
              setFormCap(EMPTY_CAP); setError(''); setModalCap({ modo: 'crear' })
            }}>
              <Plus size={15} /> Nuevo capítulo
            </button>
          )}
          <button type="button" className="btn btn-secondary presupuesto-icon-button" aria-label="Actualizar presupuesto" onClick={() => cargarCapitulos()}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="page-filters presupuesto-page-filters">
        <label className="sr-only" htmlFor="presupuesto-proyecto">Proyecto</label>
        <select id="presupuesto-proyecto" className="form-select presupuesto-filter-proyecto" value={filtProy}
          onChange={e => handleProy(e.target.value)}
          aria-label="Proyecto">
          <option value="">Selecciona un proyecto...</option>
          {proyectos.map(p => (
            <option key={p.proyecto_id} value={p.proyecto_id}>
              {p.proyecto_id} — {p.nombre}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="presupuesto-edificacion">Edificación</label>
        <select id="presupuesto-edificacion" className="form-select presupuesto-filter-edificacion" value={filtEdif}
          onChange={e => handleEdif(e.target.value)}
          disabled={!filtProy}
          aria-label="Edificación">
          <option value="">Todas las edificaciones</option>
          {edifFilt.map(e => (
            <option key={e.edificio_id} value={e.edificio_id}>{e.nombre}</option>
          ))}
        </select>
      </div>

      {/* KPIs resumen */}
      {capitulos.length > 0 && (
        <div className="kpi-grid presupuesto-kpi-grid">
          {[
            { label: 'Presupuestado', value: fmtCOP(totalPres), colorClass: 'presupuesto-kpi-value--primary' },
            { label: 'Comprometido',  value: fmtCOP(totalComp), colorClass: 'presupuesto-kpi-value--info' },
            { label: 'Ejecutado',     value: fmtCOP(totalEjec), colorClass: 'presupuesto-kpi-value--success' },
            { label: 'Avance físico', value: `${avanceProm.toFixed(1)}%`, colorClass: 'presupuesto-kpi-value--primary' },
          ].map(k => (
            <div key={k.label} className="kpi-card">
              <span className="kpi-label">{k.label}</span>
              <div className={`kpi-value presupuesto-kpi-value ${k.colorClass}`}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Estado vacío */}
      {!filtProy && (
        <div className="presupuesto-empty-state">
          <Layers size={40} className="presupuesto-empty-icon" />
          <p className="presupuesto-empty-text">Selecciona un proyecto para ver el presupuesto</p>
        </div>
      )}

      {filtProy && cargando && (
        <div className="page-loading"><Loader2 size={20} className="spinner" /><span>Cargando...</span></div>
      )}

      {/* ── Árbol de presupuesto ──────────────────────────── */}
      {!cargando && capitulos.length > 0 && (
        <div className="presupuesto-tree-card">
          {/* Encabezado de tabla */}
          <div className="presupuesto-table-header">
            <span>Ítem</span>
            <span className="presupuesto-cell-center">Unidad</span>
            <span className="presupuesto-cell-right">Cant.</span>
            <span className="presupuesto-cell-right">V. Unitario</span>
            <span className="presupuesto-cell-right">V. Total</span>
            <span className="presupuesto-cell-right">Comprometido</span>
            <span className="presupuesto-cell-center">Av. Físico</span>
            <span className="presupuesto-cell-center">Acciones</span>
          </div>

          {/* Filas del árbol */}
          {capitulos.map(cap => (
            <div key={cap.capitulo_id}>
              {/* ── Fila Capítulo ── */}
              <div className="presupuesto-row presupuesto-row--capitulo"
                onClick={() => toggleCapitulo(cap)}
              >
                <div className="presupuesto-item presupuesto-item--capitulo">
                  {expanded[cap.capitulo_id]
                    ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <FolderOpen size={15} className="presupuesto-icon-faded" />
                  <span>{cap.codigo}</span>
                  <span>{cap.nombre_capitulo}</span>
                  {cap.total_actividades > 0 && (
                    <span className="presupuesto-item-muted-small">
                      ({cap.total_actividades} actividades)
                    </span>
                  )}
                </div>
                <span className="presupuesto-cell-spacer" />
                <span className="presupuesto-cell-spacer" />
                <span className="presupuesto-cell-spacer" />
                <span className="presupuesto-cell-right presupuesto-capitulo-value">
                  {fmtCOPCorto(cap.valor_presupuestado)}
                </span>
                <span className="presupuesto-cell-right presupuesto-capitulo-value presupuesto-capitulo-value--normal">
                  {fmtCOPCorto(cap.valor_comprometido)}
                </span>
                <div className="presupuesto-cell-center">
                  <BarraProgreso pct={cap.avance_fisico_pct} variant="light" />
                </div>
                {puedeEditar && (
                  <div className="presupuesto-action-group presupuesto-action-group--light"
                    onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      title="Agregar sub-capítulo"
                      aria-label={`Agregar sub-capítulo a ${cap.nombre_capitulo}`}
                      onClick={() => {
                        setFormSub(EMPTY_SUB); setError('')
                        setExpanded(s => ({ ...s, [cap.capitulo_id]: true }))
                        setModalSub({ modo: 'crear', capituloId: cap.capitulo_id })
                      }}
                      className="presupuesto-action-btn presupuesto-action-btn--light presupuesto-action-btn--with-text">
                      <Plus size={11} /> Sub
                    </button>
                    <button type="button" title="Editar"
                      aria-label={`Editar capítulo ${cap.nombre_capitulo}`}
                      onClick={() => {
                        setFormCap({ codigo: cap.codigo, nombre_capitulo: cap.nombre_capitulo, notas: '' })
                        setError(''); setModalCap({ modo: 'editar', data: cap })
                      }}
                      className="presupuesto-action-btn presupuesto-action-btn--light presupuesto-action-btn--icon-only">
                      <Pencil size={11} />
                    </button>
                    <button type="button" title="Eliminar"
                      aria-label={`Eliminar capítulo ${cap.nombre_capitulo}`}
                      onClick={() => eliminarCapitulo(cap)}
                      className="presupuesto-action-btn presupuesto-action-btn--danger-light presupuesto-action-btn--icon-only">
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>

              {/* ── Sub-capítulos ── */}
              {expanded[cap.capitulo_id] && (subCaps[cap.capitulo_id] || []).map(sub => (
                <div key={sub.sub_capitulo_id}>
                  <div className="presupuesto-row presupuesto-row--sub"
                    onClick={() => toggleSubCap(sub)}
                  >
                    <div className="presupuesto-item presupuesto-item--sub">
                      {expanded[`sub_${sub.sub_capitulo_id}`]
                        ? <ChevronDown size={14} className="presupuesto-icon-primary" />
                        : <ChevronRight size={14} className="presupuesto-icon-muted" />}
                      <Folder size={13} className="presupuesto-icon-primary presupuesto-icon-faded" />
                      <span className="presupuesto-sub-code">{sub.codigo}</span>
                      <span>{sub.nombre_sub_capitulo}</span>
                      {sub.total_actividades > 0 && (
                        <span className="presupuesto-item-muted-small presupuesto-item-muted-small--sub">
                          ({sub.total_actividades} actvs.)
                        </span>
                      )}
                    </div>
                    <span className="presupuesto-cell-spacer" />
                    <span className="presupuesto-cell-spacer" />
                    <span className="presupuesto-cell-spacer" />
                    <span className="presupuesto-cell-right presupuesto-sub-value">
                      {fmtCOPCorto(sub.valor_presupuestado)}
                    </span>
                    <span className="presupuesto-cell-right presupuesto-sub-value presupuesto-sub-value--info">
                      {fmtCOPCorto(sub.valor_comprometido)}
                    </span>
                    <span className="presupuesto-cell-spacer" />
                    {puedeEditar && (
                      <div className="presupuesto-action-group"
                        onClick={e => e.stopPropagation()}>
                        <button type="button" title="Agregar actividad"
                          aria-label={`Agregar actividad a ${sub.nombre_sub_capitulo}`}
                          onClick={() => {
                            setFormAct(EMPTY_ACT); setError('')
                            setUnidadPersonalizada(false)
                            setExpanded(s => ({ ...s, [`sub_${sub.sub_capitulo_id}`]: true }))
                            setModalAct({ modo: 'crear', subCapId: sub.sub_capitulo_id })
                          }}
                          className="presupuesto-action-btn presupuesto-action-btn--primary presupuesto-action-btn--with-text">
                          <Plus size={11} /> Act
                        </button>
                        <button type="button" title="Editar"
                          aria-label={`Editar sub-capítulo ${sub.nombre_sub_capitulo}`}
                          onClick={() => {
                            setFormSub({ codigo: sub.codigo, nombre_sub_capitulo: sub.nombre_sub_capitulo, notas: '' })
                            setError(''); setModalSub({ modo: 'editar', data: sub })
                          }}
                          className="btn btn-ghost btn-sm presupuesto-row-icon-button">
                          <Pencil size={11} />
                        </button>
                        <button type="button" title="Eliminar"
                          aria-label={`Eliminar sub-capítulo ${sub.nombre_sub_capitulo}`}
                          onClick={() => eliminarSubCap(sub)}
                          className="btn btn-danger btn-sm presupuesto-row-icon-button">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── Actividades ── */}
                  {expanded[`sub_${sub.sub_capitulo_id}`] && (acts[sub.sub_capitulo_id] || []).map(act => (
                    <div key={act.actividad_id} className="presupuesto-row presupuesto-row--actividad">
                      <div className="presupuesto-item presupuesto-item--actividad">
                        <Activity size={12} className={act.tipo === 'GLOBAL' ? 'presupuesto-icon-warning' : 'presupuesto-icon-success'} />
                        <span className="presupuesto-activity-code">
                          {act.codigo}
                        </span>
                        <span>{act.nombre_actividad}</span>
                        <span className={`badge ${act.tipo === 'GLOBAL' ? 'badge-warning' : 'badge-success'} presupuesto-activity-badge`}>
                          {act.tipo}
                        </span>
                      </div>
                      <span className="presupuesto-cell-center presupuesto-activity-muted">
                        {act.unidad || '—'}
                      </span>
                      <span className="presupuesto-cell-right">
                        {act.tipo === 'DETALLADA' ? act.cantidad.toLocaleString('es-CO') : '—'}
                      </span>
                      <span className="presupuesto-cell-right">
                        {act.tipo === 'DETALLADA' ? fmtCOPCorto(act.vr_unitario) : '—'}
                      </span>
                      <span className="presupuesto-cell-right presupuesto-activity-total">
                        {fmtCOPCorto(act.vr_total)}
                      </span>
                      <span className="presupuesto-cell-right presupuesto-activity-committed">
                        {act.valor_comprometido > 0 ? fmtCOPCorto(act.valor_comprometido) : '—'}
                      </span>
                      <div className="presupuesto-cell-center">
                        {act.tipo === 'DETALLADA'
                          ? <BarraProgreso pct={act.avance_fisico_pct} variant="primary" />
                          : <span className="presupuesto-economic-only">Solo econ.</span>
                        }
                      </div>
                      {puedeEditar && (
                        <div className="presupuesto-action-group">
                          <button type="button" title="Editar"
                            aria-label={`Editar actividad ${act.nombre_actividad}`}
                            onClick={() => {
                              setFormAct({
                                codigo: act.codigo, nombre_actividad: act.nombre_actividad,
                                tipo: act.tipo, unidad: act.unidad || '',
                                cantidad: act.cantidad, vr_unitario: act.vr_unitario,
                                vr_total: act.vr_total, notas: '',
                              })
                              setUnidadPersonalizada(!UNIDADES_CONSTRUCCION.includes(act.unidad))
                              setError(''); setModalAct({ modo: 'editar', data: act })
                            }}
                            className="btn btn-ghost btn-sm presupuesto-row-icon-button">
                            <Pencil size={11} />
                          </button>
                          <button type="button" title="Eliminar"
                            aria-label={`Eliminar actividad ${act.nombre_actividad}`}
                            onClick={() => eliminarActividad(act)}
                            className="btn btn-danger btn-sm presupuesto-row-icon-button">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Sin actividades */}
                  {expanded[`sub_${sub.sub_capitulo_id}`] && (acts[sub.sub_capitulo_id] || []).length === 0 && (
                    <div className="presupuesto-empty-activities">
                      Sin actividades — clic en "+ Act" para agregar
                    </div>
                  )}
                </div>
              ))}

              {/* Sub-caps cargando */}
              {expanded[cap.capitulo_id] && !subCaps[cap.capitulo_id] && (
                <div className="presupuesto-loading-row">
                  <Loader2 size={13} className="spinner" /> Cargando...
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sin capítulos */}
      {!cargando && filtProy && capitulos.length === 0 && (
        <div className="presupuesto-empty-state presupuesto-empty-state--compact">
          <Layers size={36} className="presupuesto-empty-icon" />
          <p className="presupuesto-empty-text">No hay capítulos — selecciona una edificación y crea el primero</p>
        </div>
      )}

      {/* ══ Modal Capítulo ════════════════════════════════ */}
      {modalCap && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalCap(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">
                {modalCap.modo === 'crear' ? 'Nuevo capítulo' : 'Editar capítulo'}
              </span>
              <button type="button" className="btn btn-ghost btn-sm presupuesto-modal-close" aria-label="Cerrar modal de capítulo" onClick={() => setModalCap(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error"><AlertCircle size={15} /><span>{error}</span></div>}
              <div className="form-grid-2 presupuesto-section-gap">
                <div className="form-group">
                  <label className="form-label required" htmlFor="presupuesto-cap-codigo">Código</label>
                  <input id="presupuesto-cap-codigo" className="form-input" value={formCap.codigo}
                    onChange={e => setCap('codigo', e.target.value)}
                    placeholder="Ej: 1, 2, 3..." />
                </div>
                <div className="form-group">
                  <label className="form-label required" htmlFor="presupuesto-cap-nombre">Nombre</label>
                  <input id="presupuesto-cap-nombre" className="form-input" value={formCap.nombre_capitulo}
                    onChange={e => setCap('nombre_capitulo', e.target.value)}
                    placeholder="Ej: PRELIMINARES" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="presupuesto-cap-notas">Notas</label>
                <textarea id="presupuesto-cap-notas" className="form-textarea" value={formCap.notas}
                  onChange={e => setCap('notas', e.target.value)} rows={2} placeholder="Observaciones opcionales" />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setModalCap(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={guardarCapitulo} disabled={guardando}>
                {guardando ? <><Loader2 size={14} className="spinner" /> Guardando...</> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Sub-capítulo ════════════════════════════ */}
      {modalSub && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalSub(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">
                {modalSub.modo === 'crear' ? 'Nuevo sub-capítulo' : 'Editar sub-capítulo'}
              </span>
              <button type="button" className="btn btn-ghost btn-sm presupuesto-modal-close" aria-label="Cerrar modal de sub-capítulo" onClick={() => setModalSub(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error"><AlertCircle size={15} /><span>{error}</span></div>}
              <div className="form-grid-2 presupuesto-section-gap">
                <div className="form-group">
                  <label className="form-label required" htmlFor="presupuesto-sub-codigo">Código</label>
                  <input id="presupuesto-sub-codigo" className="form-input" value={formSub.codigo}
                    onChange={e => setSub('codigo', e.target.value)}
                    placeholder="Ej: 1.1, 1.2..." />
                </div>
                <div className="form-group">
                  <label className="form-label required" htmlFor="presupuesto-sub-nombre">Nombre</label>
                  <input id="presupuesto-sub-nombre" className="form-input" value={formSub.nombre_sub_capitulo}
                    onChange={e => setSub('nombre_sub_capitulo', e.target.value)}
                    placeholder="Ej: Actividades preliminares" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="presupuesto-sub-notas">Notas</label>
                <textarea id="presupuesto-sub-notas" className="form-textarea" value={formSub.notas}
                  onChange={e => setSub('notas', e.target.value)} rows={2} placeholder="Observaciones opcionales" />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setModalSub(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={guardarSubCap} disabled={guardando}>
                {guardando ? <><Loader2 size={14} className="spinner" /> Guardando...</> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Actividad ═══════════════════════════════ */}
      {modalAct && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalAct(null)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">
                {modalAct.modo === 'crear' ? 'Nueva actividad' : 'Editar actividad'}
              </span>
              <button type="button" className="btn btn-ghost btn-sm presupuesto-modal-close" aria-label="Cerrar modal de actividad" onClick={() => setModalAct(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error"><AlertCircle size={15} /><span>{error}</span></div>}

              {/* Tipo */}
              <div className="form-grid-2 presupuesto-section-gap">
                <div className="form-group">
                  <label className="form-label required" htmlFor="presupuesto-act-codigo">Código</label>
                  <input id="presupuesto-act-codigo" className="form-input" value={formAct.codigo}
                    onChange={e => setAct('codigo', e.target.value)}
                    placeholder="Ej: 1.1.2, 1.1.3..." />
                </div>
                <div className="form-group">
                  <label className="form-label required" htmlFor="presupuesto-act-tipo">Tipo</label>
                  <select id="presupuesto-act-tipo" className="form-select" value={formAct.tipo}
                    onChange={e => setAct('tipo', e.target.value)}
                    aria-label="Tipo de actividad">
                    <option value="DETALLADA">DETALLADA (cant. × v.unit.)</option>
                    <option value="GLOBAL">GLOBAL (bolsa de dinero)</option>
                  </select>
                </div>
              </div>

              <div className="form-group presupuesto-section-gap">
                <label className="form-label required" htmlFor="presupuesto-act-nombre">Nombre de la actividad</label>
                <input id="presupuesto-act-nombre" className="form-input" value={formAct.nombre_actividad}
                  onChange={e => setAct('nombre_actividad', e.target.value)}
                  placeholder="Ej: Descapote y limpieza" />
              </div>

              {/* DETALLADA */}
              {formAct.tipo === 'DETALLADA' && (
                <>
                  <div className="form-grid-3 presupuesto-section-gap">
                    <div className="form-group">
                      <label className="form-label required" htmlFor="presupuesto-act-unidad">Unidad</label>
                      <select
                        id="presupuesto-act-unidad"
                        className="form-select"
                        value={unidadPersonalizada ? '__otra__' : (formAct.unidad || '')}
                        onChange={e => {
                          if (e.target.value === '__otra__') {
                            setUnidadPersonalizada(true)
                            setAct('unidad', '')
                          } else {
                            setUnidadPersonalizada(false)
                            setAct('unidad', e.target.value)
                          }
                        }}
                        aria-label="Unidad de medida">
                        <option value="">Selecciona...</option>
                        {UNIDADES_CONSTRUCCION.map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                        <option value="__otra__">Otra (personalizada)</option>
                      </select>

                      {unidadPersonalizada && (
                        <input
                          className="form-input presupuesto-custom-unit-input"
                          value={formAct.unidad}
                          onChange={e => setAct('unidad', e.target.value.toUpperCase())}
                          placeholder="Ej: VIAJE, PUNTO, JORNADA..."
                          autoFocus
                        />
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label required" htmlFor="presupuesto-act-cantidad">Cantidad</label>
                      <NumericInput value={formAct.cantidad}
                        onChange={val => setAct('cantidad', val)} decimals={2} id="presupuesto-act-cantidad" />
                    </div>
                    <div className="form-group">
                      <label className="form-label required" htmlFor="presupuesto-act-vr-unitario">Valor unitario</label>
                      <NumericInput value={formAct.vr_unitario}
                        onChange={val => setAct('vr_unitario', val)} prefix="$" id="presupuesto-act-vr-unitario" />
                    </div>
                  </div>
                  {formAct.vr_total > 0 && (
                    <div className="system-values-box presupuesto-system-box">
                      <div className="presupuesto-system-box-row">
                        <span className="form-label">Valor total calculado</span>
                        <span className="presupuesto-system-value">
                          {fmtCOP(formAct.vr_total)}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* GLOBAL */}
              {formAct.tipo === 'GLOBAL' && (
                <>
                  <div className="alert alert-info presupuesto-section-gap">
                    <Activity size={14} className="presupuesto-alert-icon" />
                    <span>Actividad global: solo avance económico. No tiene avance físico por cantidades.</span>
                  </div>
                  <div className="form-group presupuesto-section-gap">
                    <label className="form-label required" htmlFor="presupuesto-act-vr-total">Valor total (presupuesto)</label>
                    <NumericInput value={formAct.vr_total}
                      onChange={val => setAct('vr_total', val)} prefix="$" id="presupuesto-act-vr-total" />
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="presupuesto-act-notas">Notas</label>
                <textarea id="presupuesto-act-notas" className="form-textarea" value={formAct.notas}
                  onChange={e => setAct('notas', e.target.value)} rows={2} placeholder="Observaciones opcionales" />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setModalAct(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={guardarActividad} disabled={guardando}>
                {guardando ? <><Loader2 size={14} className="spinner" /> Guardando...</> : 'Guardar actividad'}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}