import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { Plus, Pencil, Trash2, Settings } from 'lucide-react'
import {
  PageHeader, FilterBar, DataTable, FormModal, ConfirmModal, RowActions, LoadingState,
} from '../../components/ui'
import type { Columna } from '../../components/ui'
import { usePagination } from '../../hooks/usePagination'
import { useFormModal } from '../../hooks/useFormModal'
import { TIPOS_CATEGORIA } from '../../lib/constantes'
import { getApiError } from '../../utils/errores'
import type { Categoria } from '../../types'

/** Tipo de categoría (coincide con los valores de la BD). */
type Tipo = Categoria['tipo']

/** Formulario vacío para crear/editar una categoría. */
const EMPTY_FORM = { nombre: '', tipo: 'MATERIAL' as Tipo, descripcion: '' }

/**
 * Página de administración de Categorías (solo ADMIN): KPIs clicables por
 * tipo, filtro en memoria, tabla paginada, formulario en modal y
 * confirmación de borrado con ConfirmModal.
 */
export default function CategoriasPage() {
  const { toast } = useToast()

  const [categorias,  setCategorias]  = useState<Categoria[]>([])
  const [filtroTipo,  setFiltroTipo]  = useState<string>('')
  const [cargandoPag, setCargandoPag] = useState(true)

  const fm = useFormModal(EMPTY_FORM)

  /** Categoría pendiente de confirmación de borrado (null = modal cerrado). */
  const [catAEliminar, setCatAEliminar] = useState<Categoria | null>(null)
  const [eliminando,   setEliminando]   = useState(false)

  /** Filtro por tipo en memoria sobre la lista ya cargada. */
  const filtradas = filtroTipo
    ? categorias.filter(c => c.tipo === filtroTipo)
    : categorias

  const pag = usePagination(filtradas)

  /** Carga todas las categorías. */
  const cargar = async () => {
    try {
      const res = await api.get('/api/categorias')
      setCategorias(res.data.data)
    } finally { setCargandoPag(false) }
  }

  useEffect(() => { cargar() }, [])

  /** Abre el modal en modo creación con el formulario limpio. */
  const abrirNuevo = () => fm.abrirNuevo()

  /** Abre el modal en modo edición (el tipo no se puede cambiar). */
  const abrirEditar = (cat: Categoria) => {
    fm.abrirEditar(String(cat.id), {
      nombre: cat.nombre, tipo: cat.tipo, descripcion: cat.descripcion || '',
    })
  }

  /** Crea o actualiza la categoría y recarga la lista. */
  const guardar = async (ev: FormEvent) => {
    ev.preventDefault()
    const ok = await fm.guardar(
      async () => {
        if (fm.editId) await api.put(`/api/categorias/${fm.editId}`, { ...fm.form, activo: true })
        else           await api.post('/api/categorias', fm.form)
      },
      { exito: fm.editId ? 'Categoría actualizada' : 'Categoría creada' }
    )
    if (ok) { cargar(); pag.reset() }
  }

  /** Elimina la categoría confirmada en el ConfirmModal. */
  const eliminar = async () => {
    if (!catAEliminar) return
    setEliminando(true)
    try {
      await api.delete(`/api/categorias/${catAEliminar.id}`)
      toast.success('Categoría eliminada')
      cargar(); pag.reset()
    } catch (err) {
      toast.error(getApiError(err, 'Error al eliminar'))
    } finally {
      setEliminando(false)
      setCatAEliminar(null)
    }
  }

  /** Busca la etiqueta y color de badge de un tipo de categoría. */
  const tipoInfo = (tipo: Tipo) => TIPOS_CATEGORIA.find(t => t.valor === tipo)

  /** Columnas de la tabla (mismo orden y clases que la versión anterior). */
  const columnas: Columna<Categoria>[] = [
    { header: 'Nombre', className: 'td-bold', render: cat => cat.nombre },
    {
      header: 'Tipo',
      render: cat => (
        <span className={`badge ${tipoInfo(cat.tipo)?.color || 'badge-neutral'}`}>
          {tipoInfo(cat.tipo)?.label}
        </span>
      ),
    },
    { header: 'Descripción', className: 'td-secondary', render: cat => cat.descripcion || '—' },
    {
      header: 'Estado',
      render: cat => (
        <span className={`badge ${cat.activo ? 'badge-success' : 'badge-danger'}`}>
          {cat.activo ? 'ACTIVA' : 'INACTIVA'}
        </span>
      ),
    },
    {
      header: 'Acciones',
      render: cat => (
        <RowActions acciones={[
          { label: 'Editar', icon: <Pencil size={13} />, onClick: () => abrirEditar(cat) },
          { label: '', icon: <Trash2 size={13} />, claseBase: 'btn btn-danger btn-sm', onClick: () => setCatAEliminar(cat) },
        ]} />
      ),
    },
  ]

  return (
    <MainLayout>
      <PageHeader
        title="Gestión de Categorías"
        subtitle="Solo ADMIN — categorías para materiales, proveedores y contratistas"
        actions={
          <button className="btn btn-primary" onClick={abrirNuevo}>
            <Plus size={15} /> Nueva categoría
          </button>
        }
      />

      {/* Resumen por tipo */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        {TIPOS_CATEGORIA.map(t => {
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
      <FilterBar>
        <select className="form-select" value={filtroTipo}
          onChange={e => { setFiltroTipo(e.target.value); pag.reset() }}
          aria-label="Filtrar por tipo" style={{ width: 200 }}>
          <option value="">Todos los tipos</option>
          {TIPOS_CATEGORIA.map(t => <option key={t.valor} value={t.valor}>{t.label}</option>)}
        </select>
        <span className="td-muted" style={{ alignSelf: 'center', fontSize: 12 }}>
          {filtradas.length} categoría{filtradas.length !== 1 ? 's' : ''}
        </span>
      </FilterBar>

      {/* Tabla (loading fuera del wrapper, como la versión original) */}
      {cargandoPag ? (
        <LoadingState texto="Cargando categorías..." />
      ) : (
        <DataTable
          columns={columnas}
          pag={pag}
          rowKey={cat => cat.id}
          emptyIcon={Settings}
          emptyText="No hay categorías registradas"
          emptyEnFila
        />
      )}

      {/* Modal crear/editar */}
      <FormModal
        open={fm.show}
        title={fm.editId ? 'Editar categoría' : 'Nueva categoría'}
        onClose={fm.cerrar}
        onSubmit={guardar}
        error={fm.error}
        cargando={fm.cargando}
        submitLabel={fm.editId ? 'Guardar cambios' : 'Crear categoría'}
      >
        <div className="form-grid-2 form-section-gap">
          <div className="form-group">
            <label className="form-label required" htmlFor="cat-nombre">Nombre</label>
            <input id="cat-nombre" className="form-input"
              value={fm.form.nombre}
              onChange={e => fm.set('nombre', e.target.value.toUpperCase())}
              required placeholder="Ej: CONCRETO" />
            <span className="form-hint">Se guardará en mayúsculas</span>
          </div>
          <div className="form-group">
            <label className="form-label required" htmlFor="cat-tipo">Tipo</label>
            <select id="cat-tipo" className="form-select"
              value={fm.form.tipo}
              onChange={e => fm.set('tipo', e.target.value as Tipo)}
              disabled={!!fm.editId}
              aria-label="Tipo de categoría">
              {TIPOS_CATEGORIA.map(t => (
                <option key={t.valor} value={t.valor}>{t.label}</option>
              ))}
            </select>
            {fm.editId && <span className="form-hint">El tipo no se puede cambiar</span>}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="cat-desc">Descripción</label>
          <textarea id="cat-desc" className="form-textarea"
            value={fm.form.descripcion}
            onChange={e => fm.set('descripcion', e.target.value)}
            rows={2} placeholder="Descripción opcional de la categoría" />
        </div>
      </FormModal>

      {/* Confirmación de borrado */}
      <ConfirmModal
        open={!!catAEliminar}
        titulo="Eliminar categoría"
        mensaje={<>¿Eliminar <strong>"{catAEliminar?.nombre}"</strong>?</>}
        confirmLabel="Eliminar"
        peligro
        cargando={eliminando}
        onConfirm={eliminar}
        onCancel={() => setCatAEliminar(null)}
      />
    </MainLayout>
  )
}
