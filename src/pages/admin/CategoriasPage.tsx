import { useEffect, useState } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { usePagination } from '../../hooks/usePagination'
import Pagination from '../../components/ui/Pagination'
import { Plus, Pencil, Trash2, Loader2, AlertCircle, X, Settings } from 'lucide-react'

type Tipo = 'MATERIAL' | 'PROVEEDOR' | 'CONTRATISTA'

interface Categoria {
  id: number; nombre: string; tipo: Tipo
  descripcion: string; activo: number
}

const TIPOS: { valor: Tipo; label: string; color: string }[] = [
  { valor: 'MATERIAL',    label: 'Materiales',    color: 'badge-info' },
  { valor: 'PROVEEDOR',   label: 'Proveedores',   color: 'badge-success' },
  { valor: 'CONTRATISTA', label: 'Contratistas',  color: 'badge-warning' },
]

const EMPTY = { nombre: '', tipo: 'MATERIAL' as Tipo, descripcion: '' }

export default function CategoriasPage() {
  const { toast } = useToast()

  const [categorias,  setCategorias]  = useState<Categoria[]>([])
  const [filtroTipo,  setFiltroTipo]  = useState<string>('')
  const [form,        setForm]        = useState(EMPTY)
  const [editId,      setEditId]      = useState<number | null>(null)
  const [showForm,    setShowForm]    = useState(false)
  const [error,       setError]       = useState('')
  const [cargando,    setCargando]    = useState(false)
  const [cargandoPag, setCargandoPag] = useState(true)

  const filtradas = filtroTipo
    ? categorias.filter(c => c.tipo === filtroTipo)
    : categorias

  const pag = usePagination(filtradas)

  const cargar = async () => {
    try {
      const res = await api.get('/api/categorias')
      setCategorias(res.data.data)
    } finally { setCargandoPag(false) }
  }

  useEffect(() => { cargar() }, [])

  const set = (key: string, val: any) => setForm(s => ({ ...s, [key]: val }))

  const abrirNuevo = () => {
    setForm(EMPTY); setEditId(null); setError(''); setShowForm(true)
  }

  const abrirEditar = (cat: Categoria) => {
    setForm({ nombre: cat.nombre, tipo: cat.tipo, descripcion: cat.descripcion || '' })
    setEditId(cat.id); setError(''); setShowForm(true)
  }

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault(); setCargando(true); setError('')
    try {
      if (editId) {
        await api.put(`/api/categorias/${editId}`, { ...form, activo: true })
        toast.success('Categoría actualizada')
      } else {
        await api.post('/api/categorias', form)
        toast.success('Categoría creada')
      }
      setShowForm(false); cargar(); pag.reset()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al guardar'
      setError(msg); toast.error(msg)
    } finally { setCargando(false) }
  }

  const eliminar = async (cat: Categoria) => {
    if (!confirm(`¿Eliminar "${cat.nombre}"?`)) return
    try {
      await api.delete(`/api/categorias/${cat.id}`)
      toast.success('Categoría eliminada')
      cargar(); pag.reset()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al eliminar')
    }
  }

  const tipoInfo = (tipo: Tipo) => TIPOS.find(t => t.valor === tipo)

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gestión de Categorías</h1>
          <p className="page-subtitle">
            Solo ADMIN — categorías para materiales, proveedores y contratistas
          </p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>
          <Plus size={15} /> Nueva categoría
        </button>
      </div>

      {/* Resumen por tipo */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        {TIPOS.map(t => {
          const count = categorias.filter(c => c.tipo === t.valor).length
          return (
            <div key={t.valor} className="kpi-card" style={{ cursor: 'pointer' }}
              onClick={() => { setFiltroTipo(filtroTipo === t.valor ? '' : t.valor); pag.reset() }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className="kpi-label">{t.label}</span>
                <Settings size={14} style={{ color: 'var(--color-text-muted)' }} />
              </div>
              <div className="kpi-value">{count}</div>
              <div style={{ marginTop: 6 }}>
                <span className={`badge ${t.color}`} style={{ fontSize: 10 }}>
                  {filtroTipo === t.valor ? 'Filtro activo' : 'Clic para filtrar'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filtro */}
      <div className="page-filters">
        <select className="form-select" value={filtroTipo}
          onChange={e => { setFiltroTipo(e.target.value); pag.reset() }}
          aria-label="Filtrar por tipo" style={{ width: 200 }}>
          <option value="">Todos los tipos</option>
          {TIPOS.map(t => <option key={t.valor} value={t.valor}>{t.label}</option>)}
        </select>
        <span className="td-muted" style={{ alignSelf: 'center', fontSize: 12 }}>
          {filtradas.length} categoría{filtradas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabla */}
      {cargandoPag ? (
        <div className="page-loading">
          <Loader2 size={20} className="spinner" /><span>Cargando categorías...</span>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pag.itemsPagina.length === 0 ? (
                <tr><td colSpan={5}>
                  <div className="search-empty-state">
                    <Settings size={32} style={{ color: 'var(--color-text-muted)' }} />
                    <span>No hay categorías registradas</span>
                  </div>
                </td></tr>
              ) : pag.itemsPagina.map(cat => (
                <tr key={cat.id}>
                  <td className="td-bold">{cat.nombre}</td>
                  <td>
                    <span className={`badge ${tipoInfo(cat.tipo)?.color || 'badge-neutral'}`}>
                      {tipoInfo(cat.tipo)?.label}
                    </span>
                  </td>
                  <td className="td-secondary">{cat.descripcion || '—'}</td>
                  <td>
                    <span className={`badge ${cat.activo ? 'badge-success' : 'badge-danger'}`}>
                      {cat.activo ? 'ACTIVA' : 'INACTIVA'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(cat)}>
                        <Pencil size={13} /> Editar
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => eliminar(cat)}>
                        <Trash2 size={13} />
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
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">
                {editId ? 'Editar categoría' : 'Nueva categoría'}
              </span>
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

                <div className="form-grid-2" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="cat-nombre">Nombre</label>
                    <input id="cat-nombre" className="form-input"
                      value={form.nombre}
                      onChange={e => set('nombre', e.target.value.toUpperCase())}
                      required placeholder="Ej: CONCRETO" />
                    <span className="form-hint">Se guardará en mayúsculas</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="cat-tipo">Tipo</label>
                    <select id="cat-tipo" className="form-select"
                      value={form.tipo}
                      onChange={e => set('tipo', e.target.value)}
                      disabled={!!editId}
                      aria-label="Tipo de categoría">
                      {TIPOS.map(t => (
                        <option key={t.valor} value={t.valor}>{t.label}</option>
                      ))}
                    </select>
                    {editId && <span className="form-hint">El tipo no se puede cambiar</span>}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="cat-desc">Descripción</label>
                  <textarea id="cat-desc" className="form-textarea"
                    value={form.descripcion}
                    onChange={e => set('descripcion', e.target.value)}
                    rows={2} placeholder="Descripción opcional de la categoría" />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary"
                  onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={cargando}>
                  {cargando
                    ? <><Loader2 size={14} className="spinner" /> Guardando...</>
                    : editId ? 'Guardar cambios' : 'Crear categoría'
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