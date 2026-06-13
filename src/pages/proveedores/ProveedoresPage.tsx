import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { Plus, Pencil, Users, Search } from 'lucide-react'
import {
  PageHeader, FilterBar, SelectFiltro, DataTable, FormModal, RowActions,
} from '../../components/ui'
import type { Columna } from '../../components/ui'
import { useListado } from '../../hooks/useListado'
import { useFormModal } from '../../hooks/useFormModal'
import { useDebounce } from '../../hooks/useDebounce'
import type { Proveedor } from '../../types'

/** Formulario vacío para crear/editar un proveedor. */
const EMPTY_FORM = {
  nombre: '', nit: '', contacto: '', telefono: '',
  email: '', ciudad: '', categoria: '', activo: true,
}

/**
 * Valida el NIT en cliente (fix C-02).
 *
 * @param nit - NIT tal como lo escribió el usuario (puede traer puntos/guiones/espacios)
 * @returns Mensaje de error, o cadena vacía si es válido
 */
function validarNitCliente(nit: string): string {
  const limpio = nit.replace(/[.\-\s]/g, '')
  if (!limpio) return ''
  if (!/^\d+$/.test(limpio)) return 'Solo se permiten números'
  if (limpio.length < 5)     return 'Mínimo 5 dígitos'
  return ''
}

/**
 * Página maestra de Proveedores: búsqueda con debounce, filtros por
 * categoría y estado, tabla paginada y formulario en modal.
 *
 * La lista solo se carga cuando hay un criterio (≥3 caracteres de búsqueda,
 * categoría, o filtro de estado) para no traer todos los proveedores de entrada.
 */
export default function ProveedoresPage() {
  const { setLista, cargando: buscando, pag, cargar } =
    useListado<Proveedor>('/api/proveedores')

  const [busqueda,        setBusqueda]        = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroActivo,    setFiltroActivo]    = useState('')
  const [hasBuscado,      setHasBuscado]      = useState(false)
  const [categoriasOpts,  setCategoriasOpts]  = useState<string[]>([])
  const [nitError,        setNitError]        = useState('')

  const fm = useFormModal(EMPTY_FORM)

  /** Carga el catálogo de categorías activas de tipo PROVEEDOR (una vez). */
  useEffect(() => {
    api.get('/api/categorias?tipo=PROVEEDOR&activo=1')
      .then(res => {
        setCategoriasOpts(res.data.data.map((c: { nombre: string }) => c.nombre))
      })
      .catch(() => setCategoriasOpts([]))
  }, [])

  /**
   * Carga la lista de proveedores. Los filtros llegan como PARÁMETROS
   * directos (patrón cargarLista del proyecto) para no depender del
   * estado asíncrono de React.
   *
   * @param activo - '' | '1' | '0'
   * @param q - Texto de búsqueda (activa la carga con ≥3 caracteres)
   * @param cat - Categoría seleccionada
   * @param forzar - Fuerza la carga aunque no haya criterio (filtro de estado)
   */
  const cargarLista = async (activo = filtroActivo, q = busqueda, cat = filtroCategoria, forzar = false) => {
    const activar = forzar || q.length >= 3 || !!cat || activo !== ''
    if (!activar) { setLista([]); setHasBuscado(false); return }

    setHasBuscado(true)
    await cargar({ activo, q, categoria: cat })
  }

  /** Búsqueda con debounce de 350 ms; pasa el texto nuevo como parámetro. */
  const buscarDebounced = useDebounce((q: string) => {
    cargarLista(filtroActivo, q, filtroCategoria)
  }, 350)

  const handleBusqueda = (q: string) => {
    setBusqueda(q)
    buscarDebounced(q)
  }

  /** Actualiza el NIT en el form y su validación en vivo. */
  const handleNit = (val: string) => {
    fm.set('nit', val)
    setNitError(validarNitCliente(val))
  }

  /** Abre el modal en modo creación con el formulario limpio. */
  const abrirNuevo = () => {
    setNitError('')
    fm.abrirNuevo()
  }

  /** Abre el modal en modo edición con los datos del proveedor. */
  const abrirEditar = (p: Proveedor) => {
    setNitError('')
    fm.abrirEditar(p.proveedor_id, {
      nombre: p.nombre, nit: p.nit, contacto: p.contacto || '',
      telefono: p.telefono || '', email: p.email || '',
      ciudad: p.ciudad || '', categoria: p.categoria || '',
      activo: p.activo === 1,
    })
  }

  /**
   * Crea o actualiza el proveedor según editId. El hook maneja toast,
   * mensaje de error de la API y cierre del modal; al guardar se recarga
   * la lista con los filtros vigentes.
   */
  const guardar = async (ev: FormEvent) => {
    ev.preventDefault()
    const nitErr = validarNitCliente(fm.form.nit)
    if (nitErr) { setNitError(nitErr); return }

    const ok = await fm.guardar(
      async () => {
        if (fm.editId) await api.put(`/api/proveedores/${fm.editId}`, fm.form)
        else           await api.post('/api/proveedores', fm.form)
      },
      { exito: fm.editId ? 'Proveedor actualizado correctamente' : 'Proveedor creado correctamente' }
    )
    if (ok) cargarLista()
  }

  /** Columnas de la tabla (mismo orden y clases que la versión anterior). */
  const columnas: Columna<Proveedor>[] = [
    { header: 'ID', className: 'td-id', render: p => p.proveedor_id },
    { header: 'Razón social', className: 'td-bold', render: p => p.nombre },
    { header: 'NIT', render: p => <span className="font-mono">{p.nit}</span> },
    {
      header: 'Categoría',
      render: p => p.categoria
        ? <span className="badge badge-info">{p.categoria}</span>
        : <span className="td-muted">—</span>,
    },
    { header: 'Contacto', className: 'td-secondary', render: p => p.contacto || '—' },
    { header: 'Teléfono', className: 'td-secondary', render: p => p.telefono || '—' },
    { header: 'Ciudad', className: 'td-secondary', render: p => p.ciudad || '—' },
    {
      header: 'Estado',
      render: p => (
        <span className={`badge ${p.activo ? 'badge-success' : 'badge-danger'}`}>
          {p.activo ? 'ACTIVO' : 'INACTIVO'}
        </span>
      ),
    },
    {
      header: 'Acciones',
      render: p => (
        <RowActions acciones={[
          { label: 'Editar', icon: <Pencil size={13} />, onClick: () => abrirEditar(p) },
        ]} />
      ),
    },
  ]

  return (
    <MainLayout>
      <PageHeader
        title="Proveedores"
        subtitle="Terceros para compras de materiales y servicios"
        actions={
          <button className="btn btn-primary" onClick={abrirNuevo}>
            <Plus size={15} /> Nuevo proveedor
          </button>
        }
      />

      {/* Filtros */}
      <FilterBar>
        <div className="search-bar">
          <Search size={14} />
          <input
            className="form-input"
            placeholder="Buscar por nombre, NIT, ciudad..."
            value={busqueda}
            onChange={e => handleBusqueda(e.target.value)}
            aria-label="Buscar proveedores"
          />
        </div>

        <SelectFiltro
          className="form-select--w160"
          value={filtroCategoria}
          onChange={v => { setFiltroCategoria(v); cargarLista(filtroActivo, busqueda, v) }}
          placeholder="Todas las categorías"
          options={categoriasOpts.map(c => ({ value: c, label: c }))}
          ariaLabel="Filtrar por categoría"
        />

        <SelectFiltro
          className="form-select--w150"
          value={filtroActivo}
          onChange={v => { setFiltroActivo(v); cargarLista(v, busqueda, filtroCategoria, true) }}
          placeholder="Todos"
          options={[
            { value: '1', label: 'Activos' },
            { value: '0', label: 'Inactivos' },
          ]}
          ariaLabel="Filtrar por estado"
        />
      </FilterBar>

      {/* Tabla */}
      <DataTable
        columns={columnas}
        pag={pag}
        rowKey={p => p.proveedor_id}
        cargando={buscando}
        cargandoTexto="Buscando proveedores..."
        cargandoSize={18}
        emptyIcon={Users}
        emptyText={!hasBuscado
          ? 'Escribe al menos 3 caracteres o aplica un filtro para ver proveedores'
          : 'No se encontraron proveedores con ese criterio'}
      />

      {/* Modal crear/editar */}
      <FormModal
        open={fm.show}
        title={fm.editId ? `Editar — ${fm.editId}` : 'Nuevo proveedor'}
        onClose={fm.cerrar}
        onSubmit={guardar}
        className="modal-lg"
        error={fm.error}
        cargando={fm.cargando}
        submitLabel={fm.editId ? 'Guardar cambios' : 'Crear proveedor'}
        disabledSubmit={!!nitError}
      >
        {/* Razón social + NIT */}
        <div className="form-grid-2 form-section-gap">
          <div className="form-group">
            <label className="form-label required" htmlFor="prov-nombre">Razón social</label>
            <input
              id="prov-nombre"
              className="form-input"
              value={fm.form.nombre}
              onChange={e => fm.set('nombre', e.target.value)}
              required placeholder="Nombre o razón social"
            />
          </div>
          <div className="form-group">
            <label className="form-label required" htmlFor="prov-nit">NIT / Cédula</label>
            <input
              id="prov-nit"
              className={`form-input font-mono ${nitError ? 'error' : ''}`}
              value={fm.form.nit}
              onChange={e => handleNit(e.target.value)}
              required placeholder="Ej: 9001234567"
            />
            {nitError
              ? <span className="hint-error">{nitError}</span>
              : <span className="form-hint">Sin puntos ni guiones — solo números</span>
            }
          </div>
        </div>

        {/* Categoría + Ciudad */}
        <div className="form-grid-2 form-section-gap">
          <div className="form-group">
            <label className="form-label" htmlFor="prov-cat">Categoría</label>
            <select
              id="prov-cat"
              className="form-select"
              value={fm.form.categoria}
              onChange={e => fm.set('categoria', e.target.value)}
              aria-label="Categoría del proveedor"
            >
              <option value="">Sin categoría</option>
              {categoriasOpts.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="prov-ciudad">Ciudad</label>
            <input
              id="prov-ciudad"
              className="form-input"
              value={fm.form.ciudad}
              onChange={e => fm.set('ciudad', e.target.value)}
              placeholder="Ej: Medellín"
            />
          </div>
        </div>

        {/* Contacto + Teléfono + Email */}
        <div className="form-grid-3 form-section-gap">
          <div className="form-group">
            <label className="form-label" htmlFor="prov-contacto">Persona de contacto</label>
            <input
              id="prov-contacto"
              className="form-input"
              value={fm.form.contacto}
              onChange={e => fm.set('contacto', e.target.value)}
              placeholder="Nombre del contacto"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="prov-tel">Teléfono</label>
            <input
              id="prov-tel"
              className="form-input"
              value={fm.form.telefono}
              onChange={e => fm.set('telefono', e.target.value)}
              placeholder="Ej: 3001234567"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="prov-email">Email</label>
            <input
              id="prov-email"
              type="email"
              className="form-input"
              value={fm.form.email}
              onChange={e => fm.set('email', e.target.value)}
              placeholder="correo@proveedor.com"
            />
          </div>
        </div>

        {/* Activo */}
        <div className="form-group">
          <label className="form-label">Estado</label>
          <div className="toggle-wrap">
            <button
              type="button"
              className={`toggle ${fm.form.activo ? 'on' : 'off'}`}
              onClick={() => fm.set('activo', !fm.form.activo)}
              aria-label={fm.form.activo ? 'Desactivar proveedor' : 'Activar proveedor'}
            />
            <span className="toggle-label">
              {fm.form.activo ? 'Proveedor activo — aparece en cotizaciones' : 'Proveedor inactivo — no aparece en cotizaciones'}
            </span>
          </div>
        </div>
      </FormModal>
    </MainLayout>
  )
}
