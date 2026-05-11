import { useEffect, useState } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { Plus, Pencil, Building2, Loader2, AlertCircle, X } from 'lucide-react'
import './EdificacionesPage.css'

interface Proyecto { proyecto_id: string; nombre: string }
interface Edificacion {
  edificio_id: string; proyecto_id: string; nombre_proyecto: string
  nombre: string; descripcion: string; area_m2: number
  pisos: number; estado: string; notas: string
}

const EMPTY = {
  proyecto_id: '', nombre: '', descripcion: '',
  area_m2: '', pisos: '', estado: 'ACTIVO', notas: ''
}

const BADGE: Record<string, string> = {
  ACTIVO: 'badge-success', TERMINADO: 'badge-neutral', SUSPENDIDO: 'badge-warning'
}

export default function EdificacionesPage() {
  const { toast } = useToast()
  const [edificaciones, setEdificaciones] = useState<Edificacion[]>([])
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [filtroProyecto, setFiltroProyecto] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [cargandoPagina, setCargandoPagina] = useState(true)

  const cargarProyectos = async () => {
    const res = await api.get('/api/proyectos')
    setProyectos(res.data.data)
  }

  const cargarEdificaciones = async (proyectoId = '') => {
    const params = proyectoId ? `?proyecto_id=${proyectoId}` : ''
    const res = await api.get(`/api/edificaciones${params}`)
    setEdificaciones(res.data.data)
    setCargandoPagina(false)
  }

  useEffect(() => {
    cargarProyectos()
    cargarEdificaciones()
  }, [])

  const handleFiltro = (proyectoId: string) => {
    setFiltroProyecto(proyectoId)
    cargarEdificaciones(proyectoId)
  }

  const set = (key: string, value: any) => setForm(s => ({ ...s, [key]: value }))

  const abrirNuevo = () => {
    setForm(EMPTY); setEditId(null); setError(''); setShowForm(true)
  }

  const abrirEditar = (e: Edificacion) => {
    setForm({
      proyecto_id: e.proyecto_id, nombre: e.nombre,
      descripcion: e.descripcion || '', area_m2: e.area_m2 ? String(e.area_m2) : '',
      pisos: e.pisos ? String(e.pisos) : '', estado: e.estado, notas: e.notas || ''
    })
    setEditId(e.edificio_id); setError(''); setShowForm(true)
  }

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault(); setCargando(true); setError('')
    try {
      const payload = {
        ...form,
        area_m2: form.area_m2 ? Number(form.area_m2) : null,
        pisos: form.pisos ? Number(form.pisos) : null
      }
      if (editId) {
        await api.put(`/api/edificaciones/${editId}`, payload)
        toast.success('Edificación actualizada correctamente')
      } else {
        await api.post('/api/edificaciones', payload)
        toast.success('Edificación creada correctamente')
      }
      setShowForm(false)
      cargarEdificaciones(filtroProyecto)
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al guardar'
      setError(msg); toast.error(msg)
    } finally { setCargando(false) }
  }

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Edificaciones</h1>
          <p className="page-subtitle">
            {edificaciones.length} edificación{edificaciones.length !== 1 ? 'es' : ''} registrada{edificaciones.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>
          <Plus size={15} /> Nueva edificación
        </button>
      </div>

      {/* Filtro por proyecto */}
      <div className="filter-row">
        <select className="form-select filter-select" title="Filtrar por proyecto" aria-label="Filtrar por proyecto"
          value={filtroProyecto} onChange={e => handleFiltro(e.target.value)}>
          <option value="">Todos los proyectos</option>
          {proyectos.map(p => (
            <option key={p.proyecto_id} value={p.proyecto_id}>{p.proyecto_id} — {p.nombre}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      {cargandoPagina ? (
        <div className="page-loading">
          <Loader2 size={20} className="spinner" />
          <span>Cargando edificaciones...</span>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Proyecto</th>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Área m²</th>
                <th>Pisos</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
                {edificaciones.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="table-empty">
                    <Building2 size={32} className="table-empty-icon" />
                    No hay edificaciones registradas
                  </div>
                </td></tr>
              ) : edificaciones.map(e => (
                <tr key={e.edificio_id}>
                  <td><span className="font-mono td-id">{e.edificio_id}</span></td>
                  <td className="td-project">
                    <span className="font-mono">{e.proyecto_id}</span>
                    <span className="td-project-name">{e.nombre_proyecto}</span>
                  </td>
                  <td className="td-name">{e.nombre}</td>
                  <td className="td-desc">{e.descripcion || '—'}</td>
                  <td className="td-muted">{e.area_m2 ? `${e.area_m2} m²` : '—'}</td>
                  <td className="td-muted">{e.pisos || '—'}</td>
                  <td><span className={`badge ${BADGE[e.estado] || 'badge-neutral'}`}>{e.estado}</span></td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(e)}>
                        <Pencil size={13} /> Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
                {editId ? `Editar — ${editId}` : 'Nueva edificación'}
              </span>
              <button type="button" className="btn btn-ghost btn-sm modal-close-button" onClick={() => setShowForm(false)}
                aria-label="Cerrar formulario de edificación" title="Cerrar formulario de edificación">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={guardar}>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-error">
                    <AlertCircle size={15} className="alert-icon" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Proyecto */}
                <div className="form-group form-section-gap">
                  <label className="form-label required" htmlFor="edificacion-proyecto">Proyecto</label>
                  <select id="edificacion-proyecto" className="form-select" value={form.proyecto_id}
                    onChange={e => set('proyecto_id', e.target.value)}
                    required disabled={!!editId} title="Selecciona el proyecto" aria-label="Proyecto">
                    <option value="">Selecciona un proyecto...</option>
                    {proyectos.map(p => (
                      <option key={p.proyecto_id} value={p.proyecto_id}>
                        {p.proyecto_id} — {p.nombre}
                      </option>
                    ))}
                  </select>
                  {editId && <span className="form-hint">El proyecto no se puede cambiar después de creada</span>}
                </div>

                {/* Nombre */}
                <div className="form-group form-section-gap">
                  <label className="form-label required" htmlFor="edificacion-nombre">Nombre de la edificación</label>
                  <input id="edificacion-nombre" className="form-input" value={form.nombre}
                    onChange={e => set('nombre', e.target.value)}
                    required placeholder="Ej: Torre A, Bloque 1, Casa Modelo" />
                </div>

                {/* Descripción */}
                <div className="form-group form-section-gap">
                  <label className="form-label" htmlFor="edificacion-descripcion">Descripción</label>
                  <textarea id="edificacion-descripcion" className="form-textarea" value={form.descripcion}
                    onChange={e => set('descripcion', e.target.value)}
                    placeholder="Descripción general de la edificación" rows={2} />
                </div>

                {/* Área + Pisos + Estado */}
                <div className="form-grid-3 form-section-gap">
                  <div className="form-group">
                    <label className="form-label">Área construida (m²)</label>
                    <input type="number" className="form-input" value={form.area_m2}
                      onChange={e => set('area_m2', e.target.value)}
                      min={0} step="0.01" placeholder="0.00" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Número de pisos</label>
                    <input type="number" className="form-input" value={form.pisos}
                      onChange={e => set('pisos', e.target.value)}
                      min={1} placeholder="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="edificacion-estado">Estado</label>
                    <select id="edificacion-estado" title="Estado de la edificación" className="form-select" value={form.estado}
                      onChange={e => set('estado', e.target.value)}>
                      <option value="ACTIVO">ACTIVO</option>
                      <option value="SUSPENDIDO">SUSPENDIDO</option>
                      <option value="TERMINADO">TERMINADO</option>
                    </select>
                  </div>
                </div>

                {/* Notas */}
                <div className="form-group form-section-top-gap">
                  <label className="form-label" htmlFor="edificacion-notas">Notas</label>
                  <textarea id="edificacion-notas" className="form-textarea" value={form.notas}
                    onChange={e => set('notas', e.target.value)}
                    placeholder="Observaciones adicionales" rows={2} />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={cargando}>
                  {cargando
                    ? <><Loader2 size={14} className="spinner" /> Guardando...</>
                    : editId ? 'Guardar cambios' : 'Crear edificación'
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