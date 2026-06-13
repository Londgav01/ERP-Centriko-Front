import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { Plus, Pencil, Users, Search } from 'lucide-react'
import {
  PageHeader, FilterBar, SelectFiltro, DataTable, FormModal, RowActions, EstadoBadge,
} from '../../components/ui'
import type { Columna } from '../../components/ui'
import { useFormModal } from '../../hooks/useFormModal'
import { useDebounce } from '../../hooks/useDebounce'
import type { Contratista } from '../../types'

/** Formulario vacío para crear/editar un contratista. */
const EMPTY_FORM = {
  nombre: '', nit: '', especialidad: '', contacto: '',
  telefono: '', email: '', ciudad: '', activo: true,
}

/**
 * Valida el NIT en cliente.
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
 * Página maestra de Contratistas: carga inicial completa, búsqueda con
 * debounce, filtros por especialidad y estado, y formulario en modal.
 *
 * Nota: esta página NO pagina (muestra toda la lista), igual que la
 * versión original — DataTable se usa con `items` en vez de `pag`.
 */
export default function ContratistasPage() {
  const [contratistas,       setContratistas]       = useState<Contratista[]>([])
  const [busqueda,           setBusqueda]           = useState('')
  const [filtroEspecialidad, setFiltroEspecialidad] = useState('')
  const [filtroActivo,       setFiltroActivo]       = useState('')
  const [buscando,           setBuscando]           = useState(false)
  const [hasBuscado,         setHasBuscado]         = useState(true)
  const [nitError,           setNitError]           = useState('')
  const [especialidadesOpts, setEspecialidadesOpts] = useState<string[]>([])

  const fm = useFormModal(EMPTY_FORM)

  /** Carga el catálogo de especialidades (categorías tipo CONTRATISTA). */
  useEffect(() => {
    api.get('/api/categorias?tipo=CONTRATISTA&activo=1')
      .then(res => {
        setEspecialidadesOpts(res.data.data.map((c: { nombre: string }) => c.nombre))
      })
      .catch(() => setEspecialidadesOpts([]))
  }, [])

  /**
   * Busca contratistas. Los filtros llegan como PARÁMETROS directos
   * (patrón cargarLista del proyecto).
   *
   * @param q - Texto de búsqueda
   * @param especialidad - Especialidad seleccionada
   * @param activo - '' | '1' | '0'
   */
  const buscar = async (q: string, especialidad: string, activo: string) => {
    setBuscando(true); setHasBuscado(true)
    try {
      const params = new URLSearchParams()
      if (q)             params.append('q', q)
      if (especialidad)  params.append('especialidad', especialidad)
      if (activo !== '') params.append('activo', activo)
      const res = await api.get(`/api/contratistas?${params}`)
      setContratistas(res.data.data)
    } finally { setBuscando(false) }
  }

  /** Carga inicial: todos los contratistas sin filtros. */
  const cargarTodos = async () => {
    setBuscando(true)
    try {
      const res = await api.get('/api/contratistas')
      setContratistas(res.data.data)
    } finally { setBuscando(false) }
  }

  useEffect(() => { cargarTodos() }, [])

  /** Debounce de 350 ms; solo busca con campo vacío o ≥3 caracteres. */
  const buscarDebounced = useDebounce((q: string) => {
    if (q === '' || q.length >= 3) buscar(q, filtroEspecialidad, filtroActivo)
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

  /** Abre el modal en modo edición con los datos del contratista. */
  const abrirEditar = (ct: Contratista) => {
    setNitError('')
    fm.abrirEditar(ct.contratista_id, {
      nombre: ct.nombre, nit: ct.nit,
      especialidad: ct.especialidad || '',
      contacto: ct.contacto || '', telefono: ct.telefono || '',
      email: ct.email || '', ciudad: ct.ciudad || '',
      activo: ct.activo === 1,
    })
  }

  /** Crea o actualiza el contratista y rebusca con los filtros vigentes. */
  const guardar = async (ev: FormEvent) => {
    ev.preventDefault()
    const nitErr = validarNitCliente(fm.form.nit)
    if (nitErr) { setNitError(nitErr); return }

    const ok = await fm.guardar(
      async () => {
        if (fm.editId) await api.put(`/api/contratistas/${fm.editId}`, fm.form)
        else           await api.post('/api/contratistas', fm.form)
      },
      { exito: fm.editId ? 'Contratista actualizado correctamente' : 'Contratista creado correctamente' }
    )
    if (ok) buscar(busqueda, filtroEspecialidad, filtroActivo)
  }

  /** Columnas de la tabla (mismo orden y clases que la versión anterior). */
  const columnas: Columna<Contratista>[] = [
    { header: 'ID', className: 'td-id', render: ct => ct.contratista_id },
    { header: 'Razón social', className: 'td-bold', render: ct => ct.nombre },
    { header: 'NIT', render: ct => <span className="font-mono">{ct.nit}</span> },
    {
      header: 'Especialidad',
      render: ct => ct.especialidad
        ? <EstadoBadge estado={ct.especialidad} tipo="especialidad" />
        : <span className="td-muted">—</span>,
    },
    { header: 'Contacto', className: 'td-secondary', render: ct => ct.contacto || '—' },
    { header: 'Teléfono', className: 'td-secondary', render: ct => ct.telefono || '—' },
    { header: 'Ciudad', className: 'td-secondary', render: ct => ct.ciudad || '—' },
    {
      header: 'Estado',
      render: ct => (
        <span className={`badge ${ct.activo ? 'badge-success' : 'badge-danger'}`}>
          {ct.activo ? 'ACTIVO' : 'INACTIVO'}
        </span>
      ),
    },
    {
      header: 'Acciones',
      render: ct => (
        <RowActions acciones={[
          { label: 'Editar', icon: <Pencil size={13} />, onClick: () => abrirEditar(ct) },
        ]} />
      ),
    },
  ]

  return (
    <MainLayout>
      <PageHeader
        title="Contratistas"
        subtitle="Terceros para contratos de obra"
        actions={
          <button className="btn btn-primary" onClick={abrirNuevo}>
            <Plus size={15} /> Nuevo contratista
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
            aria-label="Buscar contratistas"
          />
        </div>

        <SelectFiltro
          className="form-select--w200"
          value={filtroEspecialidad}
          onChange={v => { setFiltroEspecialidad(v); buscar(busqueda, v, filtroActivo) }}
          placeholder="Todas las especialidades"
          options={especialidadesOpts.map(e => ({ value: e, label: e }))}
          ariaLabel="Filtrar por especialidad"
        />

        <SelectFiltro
          className="form-select--w150"
          value={filtroActivo}
          onChange={v => { setFiltroActivo(v); buscar(busqueda, filtroEspecialidad, v) }}
          placeholder="Todos"
          options={[
            { value: '1', label: 'Activos' },
            { value: '0', label: 'Inactivos' },
          ]}
          ariaLabel="Filtrar por estado"
        />
      </FilterBar>

      {/* Tabla (sin paginación, como la versión original) */}
      <DataTable
        columns={columnas}
        items={contratistas}
        rowKey={ct => ct.contratista_id}
        cargando={buscando}
        cargandoTexto="Buscando contratistas..."
        cargandoSize={18}
        emptyIcon={Users}
        emptyText={!hasBuscado
          ? 'Escribe al menos 3 caracteres o aplica un filtro para ver contratistas'
          : 'No se encontraron contratistas con ese criterio'}
      />

      {/* Modal crear/editar */}
      <FormModal
        open={fm.show}
        title={fm.editId ? `Editar — ${fm.editId}` : 'Nuevo contratista'}
        onClose={fm.cerrar}
        onSubmit={guardar}
        className="modal-lg"
        error={fm.error}
        cargando={fm.cargando}
        submitLabel={fm.editId ? 'Guardar cambios' : 'Crear contratista'}
        disabledSubmit={!!nitError}
      >
        {/* Razón social + NIT */}
        <div className="form-grid-2 form-section-gap">
          <div className="form-group">
            <label className="form-label required" htmlFor="cont-nombre">Razón social</label>
            <input
              id="cont-nombre"
              className="form-input"
              value={fm.form.nombre}
              onChange={e => fm.set('nombre', e.target.value)}
              required placeholder="Nombre o razón social"
            />
          </div>
          <div className="form-group">
            <label className="form-label required" htmlFor="cont-nit">NIT / Cédula</label>
            <input
              id="cont-nit"
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

        {/* Especialidad + Ciudad */}
        <div className="form-grid-2 form-section-gap">
          <div className="form-group">
            <label className="form-label" htmlFor="cont-esp">Especialidad</label>
            <select
              id="cont-esp"
              className="form-select"
              value={fm.form.especialidad}
              onChange={e => fm.set('especialidad', e.target.value)}
              aria-label="Especialidad del contratista"
            >
              <option value="">Sin especialidad</option>
              {especialidadesOpts.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cont-ciudad">Ciudad</label>
            <input
              id="cont-ciudad"
              className="form-input"
              value={fm.form.ciudad}
              onChange={e => fm.set('ciudad', e.target.value)}
              placeholder="Ej: Bogotá"
            />
          </div>
        </div>

        {/* Contacto + Teléfono + Email */}
        <div className="form-grid-3 form-section-gap">
          <div className="form-group">
            <label className="form-label" htmlFor="cont-contacto">Persona de contacto</label>
            <input
              id="cont-contacto"
              className="form-input"
              value={fm.form.contacto}
              onChange={e => fm.set('contacto', e.target.value)}
              placeholder="Nombre del contacto"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cont-tel">Teléfono</label>
            <input
              id="cont-tel"
              className="form-input"
              value={fm.form.telefono}
              onChange={e => fm.set('telefono', e.target.value)}
              placeholder="Ej: 3001234567"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cont-email">Email</label>
            <input
              id="cont-email"
              type="email"
              className="form-input"
              value={fm.form.email}
              onChange={e => fm.set('email', e.target.value)}
              placeholder="correo@contratista.com"
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
              aria-label={fm.form.activo ? 'Desactivar contratista' : 'Activar contratista'}
            />
            <span className="toggle-label">
              {fm.form.activo
                ? 'Contratista activo — disponible en contratos'
                : 'Contratista inactivo — no aparece en contratos'}
            </span>
          </div>
        </div>
      </FormModal>
    </MainLayout>
  )
}
