import { useEffect, useState } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { Plus, Pencil, FileText, Loader2, AlertCircle, X } from 'lucide-react'
import './CapitulosPage.css'

interface Proyecto    { proyecto_id: string; nombre: string; presupuesto_total: number }
interface Edificacion { edificio_id: string; nombre: string; proyecto_id: string }
interface Capitulo {
  capitulo_id: string; edificio_id: string; proyecto_id: string
  nombre_edificio: string; nombre_proyecto: string
  codigo: string; nombre_capitulo: string
  valor_presupuestado: number; valor_comprometido: number
  valor_ejecutado: number; avance_fisico_pct: number
  desviacion_pct: number; estado: string; notas: string
}

const EMPTY = {
  proyecto_id: '', edificio_id: '', codigo: '',
  nombre_capitulo: '', valor_presupuestado: 0,
  estado: 'PENDIENTE', notas: ''
}

const fmtCOP = (v: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(v || 0)

const fmtMiles = (v: number) => new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 0
}).format(v || 0)

const fmtPct = (v: number) => `${(v || 0).toFixed(1)}%`

const BADGE: Record<string, string> = {
  PENDIENTE:      'badge-neutral',
  'EN_EJECUCIÓN': 'badge-info',
  TERMINADO:      'badge-success',
  SUSPENDIDO:     'badge-warning',
}

export default function CapitulosPage() {
  const { toast } = useToast()

  const [capitulos,     setCapitulos]     = useState<Capitulo[]>([])
  const [proyectos,     setProyectos]     = useState<Proyecto[]>([])
  const [edificaciones, setEdificaciones] = useState<Edificacion[]>([])
  const [edifFiltradas, setEdifFiltradas] = useState<Edificacion[]>([])
  const [edifModal,     setEdifModal]     = useState<Edificacion[]>([])

  const [filtroProyecto, setFiltroProyecto] = useState('')
  const [filtroEdificio, setFiltroEdificio] = useState('')

  const [form,    setForm]    = useState(EMPTY)
  const [valorPresupuestadoView, setValorPresupuestadoView] = useState('')
  const [editId,  setEditId]  = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error,   setError]   = useState('')
  const [cargando,      setCargando]      = useState(false)
  const [cargandoPagina, setCargandoPagina] = useState(true)
  const [disponible,    setDisponible]    = useState<number | null>(null)

  // ── Carga inicial ──────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get('/api/proyectos'),
      api.get('/api/edificaciones'),
      api.get('/api/capitulos'),
    ]).then(([rP, rE, rC]) => {
      setProyectos(rP.data.data)
      setEdificaciones(rE.data.data)
      setCapitulos(rC.data.data)
    }).finally(() => setCargandoPagina(false))
  }, [])

  // ── Helpers ────────────────────────────────────────────────
  const cargarCapitulos = async (proyId = '', edifId = '') => {
    const params = new URLSearchParams()
    if (proyId) params.append('proyecto_id', proyId)
    if (edifId) params.append('edificio_id', edifId)
    const res = await api.get(`/api/capitulos?${params}`)
    setCapitulos(res.data.data)
  }

  const calcularDisponible = async (proyId: string, capIdExcluir = '') => {
    if (!proyId) { setDisponible(null); return }
    const [rP, rC] = await Promise.all([
      api.get(`/api/proyectos/${proyId}`),
      api.get(`/api/capitulos?proyecto_id=${proyId}`),
    ])
    const presupuesto = rP.data.data.presupuesto_total
    const totalCaps   = rC.data.data
      .filter((c: any) => c.capitulo_id !== capIdExcluir)
      .reduce((sum: number, c: any) => sum + c.valor_presupuestado, 0)
    setDisponible(presupuesto - totalCaps)
  }

  const set = (key: string, value: any) => setForm(s => ({ ...s, [key]: value }))

  // ── Filtros tabla ──────────────────────────────────────────
  const handleFiltroProyecto = (proyId: string) => {
    setFiltroProyecto(proyId)
    setFiltroEdificio('')
    setEdifFiltradas(proyId ? edificaciones.filter(e => e.proyecto_id === proyId) : [])
    cargarCapitulos(proyId, '')
  }

  const handleFiltroEdificio = (edifId: string) => {
    setFiltroEdificio(edifId)
    cargarCapitulos(filtroProyecto, edifId)
  }

  // ── Cascada modal ──────────────────────────────────────────
  const handleModalProyecto = (proyId: string) => {
    setForm(s => ({ ...s, proyecto_id: proyId, edificio_id: '' }))
    setEdifModal(proyId ? edificaciones.filter(e => e.proyecto_id === proyId) : [])
    calcularDisponible(proyId)
  }

  // ── Abrir modal ────────────────────────────────────────────
  const abrirNuevo = () => {
    setForm(EMPTY)
    setValorPresupuestadoView('')
    setEditId(null)
    setError('')
    setDisponible(null)
    setEdifModal([])
    setShowForm(true)
  }

  const abrirEditar = (cap: Capitulo) => {
    setForm({
      proyecto_id:        cap.proyecto_id,
      edificio_id:        cap.edificio_id,
      codigo:             cap.codigo,
      nombre_capitulo:    cap.nombre_capitulo,
      valor_presupuestado: cap.valor_presupuestado,
      estado:             cap.estado,
      notas:              cap.notas || '',
    })
    setValorPresupuestadoView(cap.valor_presupuestado ? fmtMiles(cap.valor_presupuestado) : '')
    setEdifModal(edificaciones.filter(e => e.proyecto_id === cap.proyecto_id))
    setEditId(cap.capitulo_id)
    setError('')
    calcularDisponible(cap.proyecto_id, cap.capitulo_id)
    setShowForm(true)
  }

  const onValorPresupuestadoChange = (value: string) => {
    const soloDigitos = value.replace(/\D/g, '')

    if (!soloDigitos) {
      setValorPresupuestadoView('')
      set('valor_presupuestado', 0)
      return
    }

    const numero = Number(soloDigitos)
    set('valor_presupuestado', numero)
    setValorPresupuestadoView(fmtMiles(numero))
  }

  // ── Guardar ────────────────────────────────────────────────
  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault()

    // Validación cliente antes de llamar al backend
    if (disponible !== null && form.valor_presupuestado > disponible) {
      setError(`El valor supera el presupuesto disponible del proyecto (${fmtCOP(disponible)})`)
      return
    }

    setCargando(true)
    setError('')
    try {
      if (editId) {
        await api.put(`/api/capitulos/${editId}`, form)
        toast.success('Capítulo actualizado correctamente')
      } else {
        await api.post('/api/capitulos', form)
        toast.success('Capítulo creado correctamente')
      }
      setShowForm(false)
      cargarCapitulos(filtroProyecto, filtroEdificio)
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al guardar'
      setError(msg)
      toast.error(msg)
    } finally {
      setCargando(false)
    }
  }

  // ── Cálculos derivados ─────────────────────────────────────
  const capActual = editId ? capitulos.find(c => c.capitulo_id === editId) : null
  const valorExcedido = disponible !== null && form.valor_presupuestado > disponible

  // ── Render ─────────────────────────────────────────────────
  return (
    <MainLayout>

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Capítulos</h1>
          <p className="page-subtitle">
            {capitulos.length} capítulo{capitulos.length !== 1 ? 's' : ''} registrado{capitulos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>
          <Plus size={15} /> Nuevo capítulo
        </button>
      </div>

      {/* Filtros */}
      <div className="capitulos-filter-row">
        <select className="form-select capitulos-filter-select" id="capitulo-filtro-proyecto"
          title="Filtrar por proyecto" aria-label="Filtrar por proyecto"
          value={filtroProyecto} onChange={e => handleFiltroProyecto(e.target.value)}>
          <option value="">Todos los proyectos</option>
          {proyectos.map(p => (
            <option key={p.proyecto_id} value={p.proyecto_id}>{p.proyecto_id} — {p.nombre}</option>
          ))}
        </select>

        <select className="form-select capitulos-filter-select-secondary" id="capitulo-filtro-edificio"
          title="Filtrar por edificación" aria-label="Filtrar por edificación"
          value={filtroEdificio} onChange={e => handleFiltroEdificio(e.target.value)}
          disabled={!filtroProyecto}>
          <option value="">Todas las edificaciones</option>
          {edifFiltradas.map(e => (
            <option key={e.edificio_id} value={e.edificio_id}>{e.edificio_id} — {e.nombre}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      {cargandoPagina ? (
        <div className="page-loading">
          <Loader2 size={20} className="spinner" />
          <span>Cargando capítulos...</span>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Código</th>
                <th>Nombre capítulo</th>
                <th>Edificación</th>
                <th>Presupuestado</th>
                <th>Comprometido</th>
                <th>Ejecutado</th>
                <th>Avance</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {capitulos.length === 0 ? (
                <tr><td colSpan={10}>
                  <div className="table-empty">
                    <FileText size={32} className="table-empty-icon" />
                    No hay capítulos registrados
                  </div>
                </td></tr>
              ) : capitulos.map(cap => {
                const pctGasto  = cap.valor_presupuestado > 0
                  ? (cap.valor_ejecutado / cap.valor_presupuestado) * 100 : 0
                const enRiesgo  = pctGasto > cap.avance_fisico_pct && cap.avance_fisico_pct > 0
                return (
                  <tr key={cap.capitulo_id}>
                    <td><span className="font-mono capitulos-table-id">{cap.capitulo_id}</span></td>
                    <td><span className="font-mono capitulos-table-code">{cap.codigo}</span></td>
                    <td className="capitulos-table-name">{cap.nombre_capitulo}</td>
                    <td className="capitulos-table-building">{cap.nombre_edificio}</td>
                    <td className="capitulos-table-budget">{fmtCOP(cap.valor_presupuestado)}</td>
                    <td className="capitulos-table-committed">{fmtCOP(cap.valor_comprometido)}</td>
                    <td className={enRiesgo ? 'capitulos-table-executed danger' : 'capitulos-table-executed'}>
                      {fmtCOP(cap.valor_ejecutado)}
                    </td>
                    <td>
                      <div className="capitulos-progress-row">
                        <progress
                          className={enRiesgo ? 'capitulos-progress-native danger' : 'capitulos-progress-native success'}
                          value={Math.min(cap.avance_fisico_pct, 100)}
                          max={100}
                        />
                        <span className={enRiesgo ? 'capitulos-progress-text danger' : 'capitulos-progress-text'}>
                          {fmtPct(cap.avance_fisico_pct)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${BADGE[cap.estado] || 'badge-neutral'}`}>{cap.estado}</span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(cap)}>
                          <Pencil size={13} /> Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">
                {editId ? `Editar — ${editId}` : 'Nuevo capítulo'}
              </span>
              <button className="btn btn-ghost btn-sm capitulos-modal-close" type="button"
                onClick={() => setShowForm(false)} aria-label="Cerrar formulario de capítulo"
                title="Cerrar formulario de capítulo">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={guardar}>
              <div className="modal-body">

                {/* Error */}
                {error && (
                  <div className="alert alert-error">
                    <AlertCircle size={15} className="alert-icon" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Cascada Proyecto → Edificación */}
                <div className="form-grid-2 form-section-gap">
                  <div className="form-group">
                    <label className="form-label required" htmlFor="capitulo-proyecto">Proyecto</label>
                    <select className="form-select" id="capitulo-proyecto" value={form.proyecto_id}
                      onChange={e => handleModalProyecto(e.target.value)}
                      required disabled={!!editId} title="Selecciona el proyecto" aria-label="Proyecto">
                      <option value="">Selecciona un proyecto...</option>
                      {proyectos.map(p => (
                        <option key={p.proyecto_id} value={p.proyecto_id}>
                          {p.proyecto_id} — {p.nombre}
                        </option>
                      ))}
                    </select>
                    {editId && (
                      <span className="form-hint">El proyecto no se puede cambiar</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label required" htmlFor="capitulo-edificio">Edificación</label>
                    <select className="form-select" id="capitulo-edificio" value={form.edificio_id}
                      onChange={e => set('edificio_id', e.target.value)}
                      required disabled={!!editId || !form.proyecto_id} title="Selecciona la edificación" aria-label="Edificación">
                      <option value="">
                        {!form.proyecto_id ? 'Primero selecciona un proyecto' : 'Selecciona una edificación...'}
                      </option>
                      {edifModal.map(e => (
                        <option key={e.edificio_id} value={e.edificio_id}>
                          {e.edificio_id} — {e.nombre}
                        </option>
                      ))}
                    </select>
                    {editId && (
                      <span className="form-hint">La edificación no se puede cambiar</span>
                    )}
                  </div>
                </div>

                {/* Código + Nombre */}
                <div className="form-grid-3 form-section-gap">
                  <div className="form-group">
                    <label className="form-label required" htmlFor="capitulo-codigo">Código</label>
                    <input className="form-input font-mono" id="capitulo-codigo" value={form.codigo}
                      onChange={e => set('codigo', e.target.value.toUpperCase())}
                      required placeholder="Ej: 01, 02-A" />
                    <span className="form-hint">Único por edificación</span>
                  </div>
                  <div className="form-group col-span-2">
                    <label className="form-label required" htmlFor="capitulo-nombre">Nombre del capítulo</label>
                    <input className="form-input" id="capitulo-nombre" value={form.nombre_capitulo}
                      onChange={e => set('nombre_capitulo', e.target.value)}
                      required placeholder="Ej: Estructura, Mampostería, Acabados" />
                  </div>
                </div>

                {/* Presupuesto + Estado */}
                <div className="form-grid-2 form-section-gap">
                  <div className="form-group">
                    <label className="form-label required" htmlFor="capitulo-valor-presupuestado">Valor presupuestado (COP)</label>
                    <input
                      type="text"
                      className={`form-input ${valorExcedido ? 'error' : ''}`}
                      id="capitulo-valor-presupuestado"
                      value={valorPresupuestadoView}
                      onChange={e => onValorPresupuestadoChange(e.target.value)}
                      inputMode="numeric"
                      required
                      placeholder="0"
                    />
                    {disponible !== null && (
                      <span className={valorExcedido ? 'form-hint form-hint-danger' : 'form-hint form-hint-success'}>
                        {valorExcedido
                          ? `Excede el disponible en ${fmtCOP(form.valor_presupuestado - disponible)}`
                          : `Disponible en el proyecto: ${fmtCOP(disponible)}`
                        }
                      </span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="capitulo-estado">Estado</label>
                    <select className="form-select" id="capitulo-estado" value={form.estado}
                      onChange={e => set('estado', e.target.value)} title="Estado del capítulo" aria-label="Estado">
                      <option value="PENDIENTE">PENDIENTE</option>
                      <option value="EN_EJECUCIÓN">EN EJECUCIÓN</option>
                      <option value="SUSPENDIDO">SUSPENDIDO</option>
                      <option value="TERMINADO">TERMINADO</option>
                    </select>
                  </div>
                </div>

                {/* Valores del sistema — solo lectura en edición */}
                {capActual && (
                  <div className="capitulos-system-box">
                    <p className="capitulos-system-title">
                      Valores actualizados automáticamente por el sistema
                    </p>
                    <div className="form-grid-3">
                      {[
                        { label: 'Comprometido',  value: fmtCOP(capActual.valor_comprometido) },
                        { label: 'Ejecutado',     value: fmtCOP(capActual.valor_ejecutado) },
                        { label: 'Avance físico', value: fmtPct(capActual.avance_fisico_pct) },
                      ].map(f => (
                        <div className="form-group" key={f.label}>
                          <label className="form-label" htmlFor={`capitulo-sistema-${f.label.toLowerCase().replace(/[^a-záéíóúñ0-9]+/gi, '-')}`}>{f.label}</label>
                          <input
                            className="form-input font-mono"
                            id={`capitulo-sistema-${f.label.toLowerCase().replace(/[^a-záéíóúñ0-9]+/gi, '-')}`}
                            value={f.value}
                            disabled
                            title={f.label}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notas */}
                <div className="form-group">
                  <label className="form-label" htmlFor="capitulo-notas">Notas</label>
                  <textarea className="form-textarea" id="capitulo-notas" value={form.notas}
                    onChange={e => set('notas', e.target.value)}
                    placeholder="Observaciones del capítulo" rows={2} />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary"
                  disabled={cargando || valorExcedido}>
                  {cargando
                    ? <><Loader2 size={14} className="spinner" /> Guardando...</>
                    : editId ? 'Guardar cambios' : 'Crear capítulo'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  )
}