import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { Lock, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'

export default function CambiarPasswordPage() {
  const navigate    = useNavigate()
  const { toast }   = useToast()
  const { usuario, refrescarUsuario } = useAuth()

  const [passwordNuevo,   setPasswordNuevo]   = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [verNuevo,        setVerNuevo]        = useState(false)
  const [verConfirm,      setVerConfirm]      = useState(false)
  const [cargando,        setCargando]        = useState(false)
  const [error,           setError]           = useState('')

  const requisitos = [
    { label: 'Mínimo 8 caracteres',    ok: passwordNuevo.length >= 8 },
    { label: 'Al menos una mayúscula', ok: /[A-Z]/.test(passwordNuevo) },
    { label: 'Al menos un número',     ok: /[0-9]/.test(passwordNuevo) },
  ]
  const fuerte   = requisitos.every(r => r.ok)
  const coincide = passwordNuevo === passwordConfirm && passwordConfirm.length > 0

    const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!fuerte)   { setError('La contraseña no cumple los requisitos'); return }
    if (!coincide) { setError('Las contraseñas no coinciden'); return }

    setCargando(true); setError('')
    try {
        await api.put('/api/auth/cambiar-password', { password_nuevo: passwordNuevo })

        await refrescarUsuario()  // ← actualiza el contexto

        toast.success('Contraseña actualizada — bienvenido al sistema')
        navigate('/')
    } catch (err: any) {
        setError(err.response?.data?.error || 'Error al cambiar la contraseña')
    } finally { setCargando(false) }
    }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--color-bg)', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: 'white',
        borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'var(--color-primary)', padding: '28px 32px', textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
          }}>
            <ShieldCheck size={28} color="white" />
          </div>
          <h1 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: 0 }}>
            Cambio de contraseña
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 6, margin: '6px 0 0' }}>
            Hola {usuario?.nombre} — crea tu contraseña personal antes de continuar
          </p>
        </div>

        {/* Form */}
        <form onSubmit={guardar} style={{ padding: '28px 32px' }}>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              <span>{error}</span>
            </div>
          )}

          {/* Nueva contraseña */}
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label required">Nueva contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                type={verNuevo ? 'text' : 'password'}
                className="form-input"
                value={passwordNuevo}
                onChange={e => setPasswordNuevo(e.target.value)}
                placeholder="Crea tu contraseña"
                required
                style={{ paddingRight: 40 }}
              />
              <button type="button" onClick={() => setVerNuevo(v => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 0,
                }}>
                {verNuevo ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Requisitos */}
            {passwordNuevo.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {requisitos.map(r => (
                  <div key={r.label} style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                    color: r.ok ? 'var(--color-success)' : 'var(--color-text-muted)',
                  }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                      background: r.ok ? 'var(--color-success)' : '#e2e8f0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {r.ok && <span style={{ color: 'white', fontSize: 9, fontWeight: 700 }}>✓</span>}
                    </div>
                    {r.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Confirmar */}
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label required">Confirmar contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                type={verConfirm ? 'text' : 'password'}
                className="form-input"
                value={passwordConfirm}
                onChange={e => setPasswordConfirm(e.target.value)}
                placeholder="Repite tu contraseña"
                required
                style={{
                  paddingRight: 40,
                  borderColor: passwordConfirm.length > 0
                    ? coincide ? 'var(--color-success)' : 'var(--color-danger)'
                    : undefined
                }}
              />
              <button type="button" onClick={() => setVerConfirm(v => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 0,
                }}>
                {verConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {passwordConfirm.length > 0 && (
              <span style={{
                fontSize: 12, marginTop: 4, display: 'block',
                color: coincide ? 'var(--color-success)' : 'var(--color-danger)'
              }}>
                {coincide ? '✓ Las contraseñas coinciden' : '✗ Las contraseñas no coinciden'}
              </span>
            )}
          </div>

          <button type="submit" className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={cargando || !fuerte || !coincide}>
            {cargando
              ? <><Loader2 size={15} className="spinner" /> Guardando...</>
              : <><Lock size={15} /> Establecer contraseña</>
            }
          </button>
        </form>
      </div>
    </div>
  )
}