import { useAuth } from '../context/AuthContext'
import type { Rol } from '../types'

// Encapsula el chequeo de rol repetido en las páginas:
//   ['ADMIN','COORDINADOR'].includes(usuario?.rol || '')
// pasa a ser:
//   const { esAlguno } = usePermisos()
//   const puedeAprobar = esAlguno('ADMIN', 'COORDINADOR')
//
// NO cambia ninguna regla RBAC: cada página sigue declarando sus roles.
export function usePermisos() {
  const { usuario } = useAuth()
  const rol = usuario?.rol

  const es = (r: Rol) => rol === r
  const esAlguno = (...roles: Rol[]) => (rol ? roles.includes(rol) : false)

  return { rol, es, esAlguno }
}
