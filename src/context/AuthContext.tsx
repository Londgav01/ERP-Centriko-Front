import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { AuthState } from '../types'

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
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

  const login = async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password })
    const { token, usuario } = res.data
    localStorage.setItem('token', token)
    setState({ usuario, token, cargando: false })
  }

  const logout = async () => {
    await api.post('/api/auth/logout').catch(() => {})
    localStorage.removeItem('token')
    setState({ usuario: null, token: null, cargando: false })
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}