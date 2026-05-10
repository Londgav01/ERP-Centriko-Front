export type Rol = 'ADMIN' | 'COORDINADOR' | 'ING_RESIDENTE' | 'ENC_COMPRAS' | 'ALMACENISTA' | 'CONSULTA'

export interface Usuario {
  id: number
  email: string
  nombre: string
  rol: Rol
}

export interface AuthState {
  usuario: Usuario | null
  token: string | null
  cargando: boolean
}

export interface ApiResponse<T = any> {
  ok: boolean
  data?: T
  error?: string
}