import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { AuthState, Usuario } from '../types'

interface AuthContextType extends AuthState {
  login:  (email: string, password: string) => Promise<Usuario>  // ← cambia void por Usuario
  logout: () => Promise<void>
  refrescarUsuario: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    usuario: null,
    token: null,
    cargando: true,
  })

  // Verifica sesión activa al cargar
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setState(s => ({ ...s, cargando: false }))
      return
    }
    api.get('/api/auth/me')
      .then(res => setState({ usuario: res.data.usuario, token, cargando: false }))
      .catch(() => {
        localStorage.removeItem('token')
        setState({ usuario: null, token: null, cargando: false })
      })
  }, [])

  // Cambia el tipo de retorno de Promise<void> a Promise<Usuario>
  const login = async (email: string, password: string): Promise<Usuario> => {
    const res = await api.post('/api/auth/login', { email, password })
    const { token, usuario } = res.data
    localStorage.setItem('token', token)
    setState({ usuario, token, cargando: false })
    return usuario  // ← agrega esto
  }

  const logout = async () => {
    await api.post('/api/auth/logout').catch(() => {})
    localStorage.removeItem('token')
    setState({ usuario: null, token: null, cargando: false })
  }

  // En AuthContext — agrega esta función
  const refrescarUsuario = async () => {
    const res = await api.get('/api/auth/me')
    setState(s => ({ ...s, usuario: res.data.usuario }))
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refrescarUsuario }}>
      {children}
    </AuthContext.Provider>
  )
}



export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

