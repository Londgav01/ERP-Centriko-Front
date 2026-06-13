// Entidades maestras — superset de los campos que devuelve la API.
// Los campos que no aparecen en todos los endpoints van como opcionales;
// cada página usa los que su endpoint garantiza.

export interface Proyecto {
  proyecto_id: string
  nombre: string
  ciudad?: string
  direccion?: string
  presupuesto_total?: number
  fecha_inicio?: string
  fecha_fin_esperada?: string
  estado?: string
  responsable?: string
  notas?: string
}

export interface Edificacion {
  edificio_id: string
  nombre: string
  proyecto_id: string
  nombre_proyecto?: string
  descripcion?: string
  area_m2?: number
  pisos?: number
  estado?: string
  notas?: string
}

export interface Capitulo {
  capitulo_id: string
  codigo: string
  nombre_capitulo: string
  edificio_id?: string
  proyecto_id?: string
  nombre_edificio?: string
  nombre_proyecto?: string
  valor_presupuestado?: number
  valor_comprometido?: number
  valor_ejecutado?: number
  avance_fisico_pct?: number
  desviacion_pct?: number
  estado?: string
  notas?: string
}

export interface Material {
  material_id: string
  codigo: string
  nombre: string
  unidad: string
  descripcion?: string
  categoria?: string
  precio_ref?: number
  activo?: number
}

export interface Proveedor {
  proveedor_id: string
  nombre: string
  nit: string
  contacto?: string
  telefono?: string
  email?: string
  ciudad?: string
  categoria?: string
  activo?: number
}

export interface Contratista {
  contratista_id: string
  nombre: string
  nit: string
  especialidad?: string
  contacto?: string
  telefono?: string
  email?: string
  ciudad?: string
  activo?: number
}

// Usuario del módulo de administración (distinto del Usuario de sesión
// que vive en types/index.ts con debe_cambiar_password).
export interface UsuarioAdmin {
  usuario_id: string
  nombre: string
  email: string
  rol: string
  proyecto_id: string
  nombre_proyecto: string
  activo: number
  created_at: string
}

export interface Categoria {
  id: number
  nombre: string
  tipo: 'MATERIAL' | 'PROVEEDOR' | 'CONTRATISTA'
  descripcion: string
  activo: number
}
