import { useEffect, useState } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { Plus, Pencil, Trash2, Building2, Loader2, AlertCircle, X } from 'lucide-react'

interface Proyecto {
  id: number; codigo: string; nombre: string; ubicacion: string
  presupuesto: number; fecha_inicio: string; fecha_fin: string; estado: string
}
const EMPTY = { codigo: '', nombre: '', ubicacion: '', presupuesto: 0, fecha_inicio: '', fecha_fin: '', estado: 'ACTIVO' }
const fmtCOP = (v: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)
const BADGE: Record<string, string> = { ACTIVO: 'badge-success', PAUSADO: 'badge-warning', TERMINADO: 'badge-neutral' }

export default function ProyectosPage() {
  const { toast } = useToast()
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [cargandoPagina, setCargandoPagina] = useState(true)

  const cargar = async () => {
    try {
      const res = await api.get('/api/proyectos')
      setProyectos(res.data.data)
    } finally { setCargandoPagina(false) }
  }

  useEffect(() => { cargar() }, [])

  const abrirNuevo = () => { setForm(EMPTY); setEditId(null); setError(''); setShowForm(true) }
  const abrirEditar = (p: Proyecto) => {
    setForm({ codigo: p.codigo, nombre: p.nombre, ubicacion: p.ubicacion || '',
      presupuesto: p.presupuesto, fecha_inicio: p.fecha_inicio || '', fecha_fin: p.fecha_fin || '', estado: p.estado })
    setEditId(p.id); setError(''); setShowForm(true)
  }

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault(); setCargando(true); setError('')
    try {
      if (editId) { await api.put(`/api/proyectos/${editId}`, form); toast.success('Proyecto actualizado') }
      else        { await api.post('/api/proyectos', form);          toast.success('Proyecto creado correctamente') }
      setShowForm(false); cargar()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al guardar'
      setError(msg); toast.error(msg)
    } finally { setCargando(false) }
  }

  const eliminar = async (id: number, nombre: string) => {
    if (!confirm(`¿Eliminar el proyecto "${nombre}"? Esta acción no se puede deshacer.`)) return
    try { await api.delete(`/api/proyectos/${id}`); toast.success('Proyecto eliminado'); cargar() }
    catch { toast.error('No se pudo eliminar el proyecto') }
  }

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Proyectos</h1>
          <p className="page-subtitle">{proyectos.length} proyecto{proyectos.length !== 1 ? 's' : ''} registrado{proyectos.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>
          <Plus size={15} /> Nuevo proyecto
        </button>
      </div>

      {cargandoPagina ? (
        <div className="page-loading"><Loader2 size={20} className="spinner" /><span>Cargando proyectos...</span></div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th><th>Nombre</th><th>Ubicación</th>
                <th>Presupuesto</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {proyectos.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="table-empty">
                    <Building2 size={32} style={{ margin: '0 auto 8px', color: 'var(--color-text-muted)', display: 'block' }} />
                    No hay proyectos registrados
                  </div>
                </td></tr>
              ) : proyectos.map(p => (
                <tr key={p.id}>
                  <td><span className="font-mono" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{p.codigo}</span></td>
                  <td style={{ fontWeight: 500 }}>{p.nombre}</td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>{p.ubicacion || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{fmtCOP(p.presupuesto)}</td>
                  <td><span className={`badge ${BADGE[p.estado] || 'badge-neutral'}`}>{p.estado}</span></td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(p)}>
                        <Pencil size={13} /> Editar
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => eliminar(p.id, p.nombre)} title="Eliminar proyecto">
                        <Trash2 size={13} />
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
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editId ? 'Editar proyecto' : 'Nuevo proyecto'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)} style={{ padding: '0 6px' }} title="Cerrar">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={guardar}>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-error">
                    <AlertCircle size={15} style={{ flexShrink: 0 }} /><span>{error}</span>
                  </div>
                )}
                <div className="form-grid-3" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="codigo">Código</label>
                    <input id="codigo" className="form-input font-mono" value={form.codigo}
                      onChange={e => setForm(s => ({ ...s, codigo: e.target.value.toUpperCase() }))} required placeholder="PRY-001" title="Código del proyecto" />
                  </div>
                  <div className="form-group col-span-2">
                    <label className="form-label required" htmlFor="nombre">Nombre del proyecto</label>
                    <input id="nombre" className="form-input" value={form.nombre}
                      onChange={e => setForm(s => ({ ...s, nombre: e.target.value }))} required placeholder="Ej: Torre Residencial El Parque" title="Nombre del proyecto" />
                  </div>
                </div>
                <div className="form-grid-3" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="presupuesto">Presupuesto (COP)</label>
                    <input id="presupuesto" type="number" className="form-input" value={form.presupuesto || ''}
                      onChange={e => setForm(s => ({ ...s, presupuesto: Number(e.target.value) }))} required min={0} placeholder="0" title="Presupuesto en pesos colombianos" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="fecha_inicio">Fecha inicio</label>
                    <input id="fecha_inicio" type="date" className="form-input" value={form.fecha_inicio}
                      onChange={e => setForm(s => ({ ...s, fecha_inicio: e.target.value }))} title="Fecha de inicio del proyecto" />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="fecha_fin">Fecha fin estimada</label>
                    <input id="fecha_fin" type="date" className="form-input" value={form.fecha_fin}
                      onChange={e => setForm(s => ({ ...s, fecha_fin: e.target.value }))} title="Fecha fin estimada del proyecto" />
                  </div>
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="ubicacion">Ubicación</label>
                    <input id="ubicacion" className="form-input" value={form.ubicacion}
                      onChange={e => setForm(s => ({ ...s, ubicacion: e.target.value }))} placeholder="Ciudad, Dirección" title="Ubicación del proyecto" />
                  </div>
                  {editId && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="estado">Estado</label>
                      <select id="estado" className="form-select" value={form.estado}
                        onChange={e => setForm(s => ({ ...s, estado: e.target.value }))} title="Estado actual del proyecto">
                        <option value="ACTIVO">ACTIVO</option>
                        <option value="PAUSADO">PAUSADO</option>
                        <option value="TERMINADO">TERMINADO</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={cargando}>
                  {cargando ? <><Loader2 size={14} className="spinner" /> Guardando...</> : editId ? 'Guardar cambios' : 'Crear proyecto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  )
}