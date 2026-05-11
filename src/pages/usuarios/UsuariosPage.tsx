import { useEffect, useState } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { Plus, Pencil, Users, Loader2, AlertCircle, X, Eye, EyeOff } from 'lucide-react'

const ROLES = [
  { valor: 'ADMIN',         label: 'Administrador',        badge: 'badge-danger' },
  { valor: 'COORDINADOR',   label: 'Coordinador',          badge: 'badge-info' },
  { valor: 'ING_RESIDENTE', label: 'Ingeniero Residente',  badge: 'badge-info' },
  { valor: 'ENC_COMPRAS',   label: 'Encargado de Compras', badge: 'badge-neutral' },
  { valor: 'ALMACENISTA',   label: 'Almacenista',          badge: 'badge-neutral' },
  { valor: 'CONSULTA',      label: 'Consulta',             badge: 'badge-neutral' },
]

interface Proyecto { proyecto_id: string; nombre: string }
interface Usuario {
  usuario_id: string; nombre: string; email: string
  rol: string; proyecto_id: string; nombre_proyecto: string
  activo: number; created_at: string
}

const EMPTY = {
  nombre: '', email: '', rol: 'COORDINADOR',
  proyecto_id: '', password: '', activo: true
}

function validarPassword(pwd: string): string {
  if (!pwd) return ''
  if (pwd.length < 8) return 'Mínimo 8 caracteres'
  return ''
}

export default function UsuariosPage() {
  const { toast }   = useToast()
  const { usuario: yo } = useAuth()

  const [usuarios,   setUsuarios]   = useState<Usuario[]>([])
  const [proyectos,  setProyectos]  = useState<Proyecto[]>([])
  const [cargandoPagina, setCargandoPagina] = useState(true)

  const [form,       setForm]       = useState(EMPTY)
  const [editId,     setEditId]     = useState<string | null>(null)
  const [showForm,   setShowForm]   = useState(false)
  const [showPass,   setShowPass]   = useState(false)
  const [error,      setError]      = useState('')
  const [passError,  setPassError]  = useState('')
  const [cargando,   setCargando]   = useState(false)

  const cargar = async () => {
    try {
      const [rU, rP] = await Promise.all([
        api.get('/api/usuarios'),
        api.get('/api/proyectos'),
      ])
      setUsuarios(rU.data.data)
      setProyectos(rP.data.data)
    } finally { setCargandoPagina(false) }
  }

  useEffect(() => { cargar() }, [])

  const set = (key: string, value: any) => setForm(s => ({ ...s, [key]: value }))

  const handlePassword = (val: string) => {
    set('password', val)
    setPassError(validarPassword(val))
  }

  const abrirNuevo = () => {
    setForm(EMPTY); setEditId(null)
    setError(''); setPassError(''); setShowPass(false); setShowForm(true)
  }

  const abrirEditar = (u: Usuario) => {
    setForm({
      nombre: u.nombre, email: u.email, rol: u.rol,
      proyecto_id: u.proyecto_id || '', password: '', activo: u.activo === 1
    })
    setEditId(u.usuario_id)
    setError(''); setPassError(''); setShowPass(false); setShowForm(true)
  }

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault()

    // En creación la contraseña es obligatoria
    if (!editId && !form.password)
      return setError('La contraseña es obligatoria al crear un usuario')

    if (passError) return

    setCargando(true); setError('')
    try {
      const payload: any = { ...form }
      if (editId && !form.password) delete payload.password

      if (editId) {
        await api.put(`/api/usuarios/${editId}`, payload)
        toast.success('Usuario actualizado correctamente')
      } else {
        await api.post('/api/usuarios', payload)
        toast.success('Usuario creado correctamente')
      }
      setShowForm(false)
      cargar()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al guardar'
      setError(msg); toast.error(msg)
    } finally { setCargando(false) }
  }

  const rolInfo = (rol: string) => ROLES.find(r => r.valor === rol)

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Usuarios</h1>
          <p className="page-subtitle">
            {usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''} registrado{usuarios.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={abrirNuevo}>
          <Plus size={15} /> Nuevo usuario
        </button>
      </div>

      {/* Tabla */}
      {cargandoPagina ? (
        <div className="page-loading">
          <Loader2 size={20} className="spinner" />
          <span>Cargando usuarios...</span>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Proyecto asignado</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 ? (
                <tr><td colSpan={7}>
                  <div className="search-empty-state">
                    <Users size={32} style={{ color: 'var(--color-text-muted)' }} />
                    <span>No hay usuarios registrados</span>
                  </div>
                </td></tr>
              ) : usuarios.map(u => (
                <tr key={u.usuario_id}>
                  <td className="td-id">{u.usuario_id}</td>
                  <td className="td-bold">
                    {u.nombre}
                    {u.usuario_id === yo?.id && (
                      <span className="badge badge-info" style={{ marginLeft: 6 }}>Tú</span>
                    )}
                  </td>
                  <td className="td-secondary">{u.email}</td>
                  <td>
                    <span className={`badge ${rolInfo(u.rol)?.badge || 'badge-neutral'}`}>
                      {rolInfo(u.rol)?.label || u.rol}
                    </span>
                  </td>
                  <td className="td-secondary">
                    {u.nombre_proyecto
                      ? <><span className="font-mono">{u.proyecto_id}</span> — {u.nombre_proyecto}</>
                      : <span className="td-muted">Sin asignar</span>
                    }
                  </td>
                  <td>
                    <span className={`badge ${u.activo ? 'badge-success' : 'badge-danger'}`}>
                      {u.activo ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(u)}>
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
                {editId ? `Editar — ${editId}` : 'Nuevo usuario'}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}
                style={{ padding: '0 6px' }} aria-label="Cerrar">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={guardar}>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-error">
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Nombre + Email */}
                <div className="form-grid-2" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="usr-nombre">Nombre completo</label>
                    <input
                      id="usr-nombre"
                      className="form-input"
                      value={form.nombre}
                      onChange={e => set('nombre', e.target.value)}
                      required placeholder="Nombre y apellido"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="usr-email">Email corporativo</label>
                    <input
                      id="usr-email"
                      type="email"
                      className="form-input"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      required placeholder="usuario@empresa.com"
                      disabled={!!editId}
                    />
                    {editId && <span className="form-hint">El email no se puede cambiar</span>}
                  </div>
                </div>

                {/* Rol + Proyecto */}
                <div className="form-grid-2" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="usr-rol">Rol en el sistema</label>
                    <select
                      id="usr-rol"
                      className="form-select"
                      value={form.rol}
                      onChange={e => set('rol', e.target.value)}
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
                      value={form.proyecto_id}
                      onChange={e => set('proyecto_id', e.target.value)}
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
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label" htmlFor="usr-pass"
                    className={`form-label ${!editId ? 'required' : ''}`}>
                    {editId ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="usr-pass"
                      type={showPass ? 'text' : 'password'}
                      className={`form-input ${passError ? 'error' : ''}`}
                      style={{ paddingRight: 40 }}
                      value={form.password}
                      onChange={e => handlePassword(e.target.value)}
                      required={!editId}
                      placeholder={editId ? 'Dejar vacío para mantener la actual' : 'Mínimo 8 caracteres'}
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
                      className={`toggle ${form.activo ? 'on' : 'off'}`}
                      onClick={() => set('activo', !form.activo)}
                      aria-label={form.activo ? 'Desactivar usuario' : 'Activar usuario'}
                      disabled={editId === yo?.id}
                    />
                    <span className="toggle-label">
                      {editId === yo?.id
                        ? 'No puedes desactivar tu propio usuario'
                        : form.activo
                          ? 'Usuario activo — puede iniciar sesión'
                          : 'Usuario inactivo — no puede iniciar sesión'
                      }
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary"
                  disabled={cargando || !!passError}>
                  {cargando
                    ? <><Loader2 size={14} className="spinner" /> Guardando...</>
                    : editId ? 'Guardar cambios' : 'Crear usuario'
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