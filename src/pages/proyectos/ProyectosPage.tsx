import { useEffect, useState } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { Plus, Pencil, Building2, Loader2, AlertCircle, X } from 'lucide-react'
import './ProyectosPage.css'
import { usePagination } from '../../hooks/usePagination'
import Pagination from '../../components/ui/Pagination'

interface Proyecto {
  proyecto_id: string
  nombre: string
  ciudad: string
  direccion: string
  presupuesto_total: number
  fecha_inicio: string
  fecha_fin_esperada: string
  estado: string
  responsable: string
  notas: string
}

const EMPTY = {
  nombre: '', ciudad: '', direccion: '',
  presupuesto_total: 0, fecha_inicio: '', fecha_fin_esperada: '',
  estado: 'ACTIVO', responsable: '', notas: ''
}

const fmtCOP = (v: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(v)

const fmtMiles = (v: number) => new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 0
}).format(v)

const BADGE: Record<string, string> = {
  ACTIVO: 'badge-success', TERMINADO: 'badge-neutral', SUSPENDIDO: 'badge-warning'
}

export default function ProyectosPage() {
  const { toast } = useToast()
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const pag = usePagination(proyectos)
  const [form, setForm] = useState(EMPTY)
  const [presupuestoView, setPresupuestoView] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [cargandoPagina, setCargandoPagina] = useState(true)

  const cargar = async () => {
    try {
      const res = await api.get('/api/proyectos')
      setProyectos(res.data.data)
      pag.reset()
    } finally { setCargandoPagina(false) }
  }

  useEffect(() => { cargar() }, [])

  const abrirNuevo = () => {
    setForm(EMPTY); setPresupuestoView(''); setEditId(null); setError(''); setShowForm(true)
  }

  const abrirEditar = (p: Proyecto) => {
    setForm({
      nombre: p.nombre, ciudad: p.ciudad || '', direccion: p.direccion || '',
      presupuesto_total: p.presupuesto_total, fecha_inicio: p.fecha_inicio || '',
      fecha_fin_esperada: p.fecha_fin_esperada || '', estado: p.estado,
      responsable: p.responsable || '', notas: p.notas || ''
    })
    setPresupuestoView(p.presupuesto_total ? fmtMiles(p.presupuesto_total) : '')
    setEditId(p.proyecto_id); setError(''); setShowForm(true)
  }

  const set = (key: string, value: any) => setForm(s => ({ ...s, [key]: value }))

  const onPresupuestoChange = (value: string) => {
    const soloDigitos = value.replace(/\D/g, '')
    if (!soloDigitos) {
      setPresupuestoView('')
      set('presupuesto_total', 0)
      return
    }

    const numero = Number(soloDigitos)
    set('presupuesto_total', numero)
    setPresupuestoView(fmtMiles(numero))
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault(); setCargando(true); setError('')
    try {
      if (editId) {
        await api.put(`/api/proyectos/${editId}`, form)
        toast.success('Proyecto actualizado correctamente')
      } else {
        await api.post('/api/proyectos', form)
        toast.success('Proyecto creado correctamente')
      }
      setShowForm(false); cargar()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al guardar'
      setError(msg); toast.error(msg)
    } finally { setCargando(false) }
  }

  return (
    <MainLayout>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Proyectos</h1>
          <p className="page-subtitle">
            {proyectos.length} proyecto{proyectos.length !== 1 ? 's' : ''} registrado{proyectos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>
          <Plus size={15} /> Nuevo proyecto
        </button>
      </div>

      {/* Tabla */}
      {cargandoPagina ? (
        <div className="page-loading">
          <Loader2 size={20} className="spinner" />
          <span>Cargando proyectos...</span>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Ciudad</th>
                <th>Responsable</th>
                <th>Presupuesto</th>
                <th>Fecha inicio</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {proyectos.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="table-empty">
                    <Building2 size={32} className="table-empty-icon" />
                    No hay proyectos registrados. Crea el primero.
                  </div>
                </td></tr>
              ) : pag.itemsPagina.map(p => (
                <tr key={p.proyecto_id}>
                  <td><span className="font-mono projects-table-id">{p.proyecto_id}</span></td>
                  <td className="projects-table-name">{p.nombre}</td>
                  <td className="projects-table-muted">{p.ciudad || '—'}</td>
                  <td className="projects-table-muted">{p.responsable || '—'}</td>
                  <td className="projects-table-budget">{fmtCOP(p.presupuesto_total)}</td>
                  <td className="projects-table-muted">
                    {p.fecha_inicio ? new Date(p.fecha_inicio + 'T00:00:00').toLocaleDateString('es-CO') : '—'}
                  </td>
                  <td><span className={`badge ${BADGE[p.estado] || 'badge-neutral'}`}>{p.estado}</span></td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(p)}>
                        <Pencil size={13} /> Editar
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

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">
                {editId ? `Editar — ${editId}` : 'Nuevo proyecto'}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm modal-close-button"
                onClick={() => setShowForm(false)}
                aria-label="Cerrar formulario de proyecto"
                title="Cerrar formulario de proyecto"
              >
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

                {/* Fila 1: Nombre (full) */}
                <div className="form-section-gap">
                  <div className="form-group">
                    <label className="form-label required" htmlFor="proyecto-nombre">Nombre del proyecto</label>
                    <input className="form-input" value={form.nombre}
                      id="proyecto-nombre"
                      onChange={e => set('nombre', e.target.value)}
                      required placeholder="Ej: Torre Residencial El Parque" />
                  </div>
                </div>

                {/* Fila 2: Ciudad + Responsable */}
                <div className="form-grid-2 form-section-gap">
                  <div className="form-group">
                    <label className="form-label" htmlFor="proyecto-ciudad">Ciudad</label>
                    <input className="form-input" value={form.ciudad}
                      id="proyecto-ciudad"
                      onChange={e => set('ciudad', e.target.value)}
                      placeholder="Ej: Medellín" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="proyecto-responsable">Responsable</label>
                    <input className="form-input" value={form.responsable}
                      id="proyecto-responsable"
                      onChange={e => set('responsable', e.target.value)}
                      placeholder="Nombre del director de obra" />
                  </div>
                </div>

                {/* Fila 3: Dirección (full) */}
                <div className="form-section-gap">
                  <div className="form-group">
                    <label className="form-label" htmlFor="proyecto-direccion">Dirección</label>
                    <input className="form-input" value={form.direccion}
                      id="proyecto-direccion"
                      onChange={e => set('direccion', e.target.value)}
                      placeholder="Ej: Cra 45 #80-23" />
                  </div>
                </div>

                {/* Fila 4: Presupuesto + Fechas */}
                <div className="form-grid-3 form-section-gap">
                  <div className="form-group">
                    <label className="form-label required" htmlFor="proyecto-presupuesto">Presupuesto total (COP)</label>
                    <input type="text" className="form-input" value={presupuestoView}
                      id="proyecto-presupuesto"
                      inputMode="numeric"
                      onChange={e => onPresupuestoChange(e.target.value)}
                      required min={0} placeholder="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="proyecto-fecha-inicio">Fecha inicio</label>
                    <input type="date" className="form-input" value={form.fecha_inicio}
                      id="proyecto-fecha-inicio"
                      onChange={e => set('fecha_inicio', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="proyecto-fecha-fin">Fecha fin esperada</label>
                    <input type="date" className="form-input" value={form.fecha_fin_esperada}
                      id="proyecto-fecha-fin"
                      onChange={e => set('fecha_fin_esperada', e.target.value)} />
                  </div>
                </div>

                {/* Fila 5: Estado (solo edición) + Notas */}
                {/* Fila 5: Estado + Notas */}
                <div className="form-grid-2 form-section-no-gap">
                  <div className="form-group">
                    <label className="form-label" htmlFor="proyecto-estado">Estado</label>
                    <select className="form-select" value={form.estado}
                      id="proyecto-estado"
                      title="Estado del proyecto"
                      onChange={e => set('estado', e.target.value)}>
                      <option value="ACTIVO">ACTIVO</option>
                      <option value="SUSPENDIDO">SUSPENDIDO</option>
                      <option value="TERMINADO">TERMINADO</option>
                    </select>
                  </div>
                  <div className={`form-group ${editId ? '' : ''}`}>
                    <label className="form-label" htmlFor="proyecto-notas">Notas</label>
                    <textarea className="form-textarea" value={form.notas}
                      id="proyecto-notas"
                      onChange={e => set('notas', e.target.value)}
                      placeholder="Observaciones generales del proyecto" rows={2} />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={cargando}>
                  {cargando
                    ? <><Loader2 size={14} className="spinner" /> Guardando...</>
                    : editId ? 'Guardar cambios' : 'Crear proyecto'
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