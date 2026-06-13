import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { Plus, Pencil, Users, Eye, EyeOff } from 'lucide-react'
import {
  PageHeader, DataTable, FormModal, RowActions, LoadingState,
} from '../../components/ui'
import type { Columna } from '../../components/ui'
import { usePagination } from '../../hooks/usePagination'
import { useFormModal } from '../../hooks/useFormModal'
import type { Proyecto, UsuarioAdmin } from '../../types'

/** Roles del sistema con su etiqueta visible y color de badge. */
const ROLES = [
  { valor: 'ADMIN',         label: 'Administrador',        badge: 'badge-danger' },
  { valor: 'COORDINADOR',   label: 'Coordinador',          badge: 'badge-info' },
  { valor: 'ING_RESIDENTE', label: 'Ingeniero Residente',  badge: 'badge-info' },
  { valor: 'ENC_COMPRAS',   label: 'Encargado de Compras', badge: 'badge-neutral' },
  { valor: 'ALMACENISTA',   label: 'Almacenista',          badge: 'badge-neutral' },
  { valor: 'CONSULTA',      label: 'Consulta',             badge: 'badge-neutral' },
]

/** Formulario vacío para crear/editar un usuario. */
const EMPTY_FORM = {
  nombre: '', email: '', rol: 'COORDINADOR',
  proyecto_id: '', password: '', activo: true,
}

/**
 * Valida la contraseña en cliente.
 *
 * @param pwd - Contraseña escrita (vacía es válida: en edición significa "no cambiar")
 * @returns Mensaje de error, o cadena vacía si es válida
 */
function validarPassword(pwd: string): string {
  if (!pwd) return ''
  if (pwd.length < 8) return 'Mínimo 8 caracteres'
  return ''
}

/**
 * Página de administración de Usuarios (solo ADMIN): tabla paginada con
 * rol/proyecto asignado y formulario en modal con manejo de contraseña
 * (obligatoria al crear, opcional al editar).
 */
export default function UsuariosPage() {
  const { usuario: yo } = useAuth()

  const [usuarios,       setUsuarios]       = useState<UsuarioAdmin[]>([])
  const pag = usePagination(usuarios)
  const [proyectos,      setProyectos]      = useState<Proyecto[]>([])
  const [cargandoPagina, setCargandoPagina] = useState(true)

  const fm = useFormModal(EMPTY_FORM)
  const [showPass,  setShowPass]  = useState(false)
  const [passError, setPassError] = useState('')

  /** Carga usuarios y catálogo de proyectos en paralelo. */
  const cargar = async () => {
    try {
      const [rU, rP] = await Promise.all([
        api.get('/api/usuarios'),
        api.get('/api/proyectos'),
      ])
      setUsuarios(rU.data.data)
      setProyectos(rP.data.data)
      pag.reset()
    } finally { setCargandoPagina(false) }
  }

  useEffect(() => { cargar() }, [])

  /** Actualiza la contraseña en el form y su validación en vivo. */
  const handlePassword = (val: string) => {
    fm.set('password', val)
    setPassError(validarPassword(val))
  }

  /** Abre el modal en modo creación con el formulario limpio. */
  const abrirNuevo = () => {
    setPassError(''); setShowPass(false)
    fm.abrirNuevo()
  }

  /** Abre el modal en modo edición (contraseña vacía = mantener la actual). */
  const abrirEditar = (u: UsuarioAdmin) => {
    setPassError(''); setShowPass(false)
    fm.abrirEditar(u.usuario_id, {
      nombre: u.nombre, email: u.email, rol: u.rol,
      proyecto_id: u.proyecto_id || '', password: '', activo: u.activo === 1,
    })
  }

  /**
   * Crea o actualiza el usuario. En creación la contraseña es obligatoria;
   * en edición, si queda vacía se omite del payload para no cambiarla.
   */
  const guardar = async (ev: FormEvent) => {
    ev.preventDefault()

    // En creación la contraseña es obligatoria (solo mensaje en el modal, sin toast)
    if (!fm.editId && !fm.form.password)
      return fm.setError('La contraseña es obligatoria al crear un usuario')

    if (passError) return

    const ok = await fm.guardar(
      async () => {
        const payload: Record<string, unknown> = { ...fm.form }
        if (fm.editId && !fm.form.password) delete payload.password

        if (fm.editId) await api.put(`/api/usuarios/${fm.editId}`, payload)
        else           await api.post('/api/usuarios', payload)
      },
      { exito: fm.editId ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente' }
    )
    if (ok) cargar()
  }

  /** Busca la etiqueta y color de badge de un rol. */
  const rolInfo = (rol: string) => ROLES.find(r => r.valor === rol)

  /** Columnas de la tabla (mismo orden y clases que la versión anterior). */
  const columnas: Columna<UsuarioAdmin>[] = [
    { header: 'ID', className: 'td-id', render: u => u.usuario_id },
    {
      header: 'Nombre',
      className: 'td-bold',
      render: u => (
        <>
          {u.nombre}
          {String(u.usuario_id) === String(yo?.id) && (
            <span className="badge badge-info" style={{ marginLeft: 6 }}>Tú</span>
          )}
        </>
      ),
    },
    { header: 'Email', className: 'td-secondary', render: u => u.email },
    {
      header: 'Rol',
      render: u => (
        <span className={`badge ${rolInfo(u.rol)?.badge || 'badge-neutral'}`}>
          {rolInfo(u.rol)?.label || u.rol}
        </span>
      ),
    },
    {
      header: 'Proyecto asignado',
      className: 'td-secondary',
      render: u => u.nombre_proyecto
        ? <><span className="font-mono">{u.proyecto_id}</span> — {u.nombre_proyecto}</>
        : <span className="td-muted">Sin asignar</span>,
    },
    {
      header: 'Estado',
      render: u => (
        <span className={`badge ${u.activo ? 'badge-success' : 'badge-danger'}`}>
          {u.activo ? 'ACTIVO' : 'INACTIVO'}
        </span>
      ),
    },
    {
      header: 'Acciones',
      render: u => (
        <RowActions acciones={[
          { label: 'Editar', icon: <Pencil size={13} />, onClick: () => abrirEditar(u) },
        ]} />
      ),
    },
  ]

  return (
    <MainLayout>
      <PageHeader
        title="Usuarios"
        subtitle={`${usuarios.length} usuario${usuarios.length !== 1 ? 's' : ''} registrado${usuarios.length !== 1 ? 's' : ''}`}
        actions={
          <button className="btn btn-primary" onClick={abrirNuevo}>
            <Plus size={15} /> Nuevo usuario
          </button>
        }
      />

      {/* Tabla (loading fuera del wrapper, como la versión original) */}
      {cargandoPagina ? (
        <LoadingState texto="Cargando usuarios..." />
      ) : (
        <DataTable
          columns={columnas}
          pag={pag}
          rowKey={u => u.usuario_id}
          emptyIcon={Users}
          emptyText="No hay usuarios registrados"
          emptyEnFila
        />
      )}

      {/* Modal crear/editar */}
      <FormModal
        open={fm.show}
        title={fm.editId ? `Editar — ${fm.editId}` : 'Nuevo usuario'}
        onClose={fm.cerrar}
        onSubmit={guardar}
        className="modal-lg"
        error={fm.error}
        cargando={fm.cargando}
        submitLabel={fm.editId ? 'Guardar cambios' : 'Crear usuario'}
        disabledSubmit={!!passError}
      >
        {/* Nombre + Email */}
        <div className="form-grid-2 form-section-gap">
          <div className="form-group">
            <label className="form-label required" htmlFor="usr-nombre">Nombre completo</label>
            <input
              id="usr-nombre"
              className="form-input"
              value={fm.form.nombre}
              onChange={e => fm.set('nombre', e.target.value)}
              required placeholder="Nombre y apellido"
            />
          </div>
          <div className="form-group">
            <label className="form-label required" htmlFor="usr-email">Email corporativo</label>
            <input
              id="usr-email"
              type="email"
              className="form-input"
              value={fm.form.email}
              onChange={e => fm.set('email', e.target.value)}
              required placeholder="usuario@empresa.com"
              disabled={!!fm.editId}
            />
            {fm.editId && <span className="form-hint">El email no se puede cambiar</span>}
          </div>
        </div>

        {/* Rol + Proyecto */}
        <div className="form-grid-2 form-section-gap">
          <div className="form-group">
            <label className="form-label required" htmlFor="usr-rol">Rol en el sistema</label>
            <select
              id="usr-rol"
              className="form-select"
              value={fm.form.rol}
              onChange={e => fm.set('rol', e.target.value)}
              required
              aria-label="Rol del usuario"
            >
              {ROLES.map(r => (
                <option key={r.valor} value={r.valor}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="usr-proyecto">Proyecto asignado</label>
            <select
              id="usr-proyecto"
              className="form-select"
              value={fm.form.proyecto_id}
              onChange={e => fm.set('proyecto_id', e.target.value)}
              aria-label="Proyecto asignado al usuario"
            >
              <option value="">Sin proyecto asignado</option>
              {proyectos.map(p => (
                <option key={p.proyecto_id} value={p.proyecto_id}>
                  {p.proyecto_id} — {p.nombre}
                </option>
              ))}
            </select>
            <span className="form-hint">Opcional — restringe la vista del usuario</span>
          </div>
        </div>

        {/* Contraseña */}
        <div className="form-group form-section-gap">
          <label
            className={`form-label ${!fm.editId ? 'required' : ''}`}
            htmlFor="usr-pass"
          >
            {fm.editId ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="usr-pass"
              type={showPass ? 'text' : 'password'}
              className={`form-input ${passError ? 'error' : ''}`}
              style={{ paddingRight: 40 }}
              value={fm.form.password}
              onChange={e => handlePassword(e.target.value)}
              required={!fm.editId}
              placeholder={fm.editId ? 'Dejar vacío para mantener la actual' : 'Mínimo 8 caracteres'}
            />
            <button
              type="button"
              onClick={() => setShowPass(s => !s)}
              aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              style={{
                position: 'absolute', right: 8, top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-text-muted)', padding: 2,
              }}
            >
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {passError
            ? <span className="hint-error">{passError}</span>
            : <span className="form-hint">Mínimo 8 caracteres</span>
          }
        </div>

        {/* Activo */}
        <div className="form-group">
          <label className="form-label">Estado</label>
          <div className="toggle-wrap">
            <button
              type="button"
              className={`toggle ${fm.form.activo ? 'on' : 'off'}`}
              onClick={() => fm.set('activo', !fm.form.activo)}
              aria-label={fm.form.activo ? 'Desactivar usuario' : 'Activar usuario'}
              disabled={String(fm.editId) === String(yo?.id)}
            />
            <span className="toggle-label">
              {String(fm.editId) === String(yo?.id)
                ? 'No puedes desactivar tu propio usuario'
                : fm.form.activo
                  ? 'Usuario activo — puede iniciar sesión'
                  : 'Usuario inactivo — no puede iniciar sesión'
              }
            </span>
          </div>
        </div>
      </FormModal>
    </MainLayout>
  )
}
