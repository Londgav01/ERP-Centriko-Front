import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const { login } = useAuth()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setCargando(true); setError('')
    try {
      const usuarioLogueado = await login(email, password)
      if (usuarioLogueado.debe_cambiar_password) {
        navigate('/cambiar-password')
      } else {
        navigate('/')
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Credenciales incorrectas')
    } finally { setCargando(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #0f172a 100%)',
    }}>
      <div style={{
        background: 'white', borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-modal)', width: 400, padding: '40px 36px',
        animation: 'slideUp 250ms ease',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, background: 'var(--color-primary)',
            borderRadius: 'var(--radius-lg)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>
            ERP Gestión de Obra
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            Ingresa con tu cuenta corporativa
          </p>
        </div>

        {/* Error alert */}
        {error && (
          <div className="alert alert-error">
            <AlertCircle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label required">Correo electrónico</label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type="email" className={`form-input ${error ? 'error' : ''}`}
                style={{ paddingLeft: 32 }}
                value={email} onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="usuario@empresa.com" required autoFocus
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label required">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type="password" className={`form-input ${error ? 'error' : ''}`}
                style={{ paddingLeft: 32 }}
                value={password} onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="••••••••" required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={cargando}
            style={{ width: '100%', justifyContent: 'center' }}>
            {cargando ? <><Loader2 size={15} className="spinner" /> Ingresando...</> : 'Ingresar al sistema'}
          </button>
        </form>
      </div>
    </div>
  )
}