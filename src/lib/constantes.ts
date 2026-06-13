import type { Rol } from '../types'

// ════════════════════════════════════════════════════════════════
// Constantes de negocio centralizadas.
// Los strings de estado deben coincidir EXACTO con la base de datos
// (tildes incluidas: 'EN_EJECUCIÓN', '15 DÍAS', 'MAMPOSTERÍA'...).
// Copiados literalmente de las páginas originales — no editar a mano.
// ════════════════════════════════════════════════════════════════

// ── Roles (RBAC) ────────────────────────────────────────────────
export const ROLES: Rol[] = ['ADMIN', 'COORDINADOR', 'ING_RESIDENTE', 'ENC_COMPRAS', 'ALMACENISTA', 'CONSULTA']

// ── Estados por documento ───────────────────────────────────────
export const ESTADOS_RS = ['BORRADOR','APROBADA','EN_PROCESO','COMPLETADA','RECHAZADA','ANULADA']
export const ESTADOS_OC = ['BORRADOR','APROBADA','ENVIADA_PROV','RECIBIDA_PARCIAL','RECIBIDA_TOTAL','ANULADA']
export const ESTADOS_CT = ['BORRADOR', 'ACTIVO', 'EN_EJECUCIÓN', 'SUSPENDIDO', 'LIQUIDADO', 'ANULADO']
export const ESTADOS_AN = ['PENDIENTE_PAGO','PAGADO','AMORTIZADO_PARCIAL','AMORTIZADO_TOTAL','ANULADO']

export const PRIORIDADES_RS = ['BAJA','MEDIA','ALTA','URGENTE']
export const CLASIFICACIONES_FACTURA = ['MATERIALES','SERVICIOS','EQUIPOS','MANO_DE_OBRA','OTROS']

// ── Formas de pago ──────────────────────────────────────────────
export const FORMAS_PAGO_COMPRAS = ['CONTADO','15 DÍAS','30 DÍAS','45 DÍAS','60 DÍAS','CRÉDITO','CONTRAENTREGA'] // CZ y OC
export const FORMAS_PAGO_CT = ['ACTA_AVANCE', 'MENSUAL', 'QUINCENAL', 'CONTRAENTREGA', 'PRECIO_GLOBAL']

// ── Tipos de contrato ───────────────────────────────────────────
export const TIPOS_CONTRATO: { valor: string; label: string; desc: string; color: string }[] = [
  {
    valor: 'TODO_COSTO',
    label: 'Todo costo',
    desc: 'Incluye materiales, mano de obra y equipos',
    color: 'badge-primary',
  },
  {
    valor: 'MANO_DE_OBRA',
    label: 'Mano de obra',
    desc: 'Solo mano de obra — materiales por separado',
    color: 'badge-info',
  },
  {
    valor: 'ALQUILER_EQUIPOS',
    label: 'Alquiler de equipos',
    desc: 'Alquiler de maquinaria o equipos especializados',
    color: 'badge-warning',
  },
]

export const LABEL_TIPO_CONTRATO: Record<string, string> = {
  TODO_COSTO:       'Todo costo',
  MANO_DE_OBRA:     'Mano de obra',
  ALQUILER_EQUIPOS: 'Alquiler de equipos',
}

// ── Tipos de categoría (admin) ──────────────────────────────────
export const TIPOS_CATEGORIA: { valor: 'MATERIAL' | 'PROVEEDOR' | 'CONTRATISTA'; label: string; color: string }[] = [
  { valor: 'MATERIAL',    label: 'Materiales',    color: 'badge-info' },
  { valor: 'PROVEEDOR',   label: 'Proveedores',   color: 'badge-success' },
  { valor: 'CONTRATISTA', label: 'Contratistas',  color: 'badge-warning' },
]

// ── Mapas de badge por tipo de documento ────────────────────────
// Clase CSS de .badge-* según el valor del estado. Fallback en
// <EstadoBadge>: 'badge-neutral' (igual que en las páginas).
export const BADGES = {
  rs: {
    BORRADOR:   'badge-neutral',  APROBADA:   'badge-success',
    EN_PROCESO: 'badge-info',     COMPLETADA: 'badge-success',
    RECHAZADA:  'badge-danger',   ANULADA:    'badge-danger',
  },
  prioridad: {
    BAJA: 'badge-neutral', MEDIA: 'badge-info',
    ALTA: 'badge-warning', URGENTE: 'badge-danger',
  },
  cz: {
    RECIBIDA:     'badge-neutral',
    SELECCIONADA: 'badge-success',
    DESCARTADA:   'badge-danger',
  },
  oc: {
    BORRADOR:         'badge-neutral',
    APROBADA:         'badge-success',
    ENVIADA_PROV:     'badge-info',
    RECIBIDA_PARCIAL: 'badge-warning',
    RECIBIDA_TOTAL:   'badge-success',
    ANULADA:          'badge-danger',
  },
  ea: {
    RECIBIDA_TOTAL: 'badge-success',
    CON_NOVEDAD:    'badge-warning',
  },
  novedad: {
    OK:       'badge-success',
    FALTANTE: 'badge-warning',
    SOBRANTE: 'badge-info',
    AVERIADO: 'badge-danger',
  },
  ct: {
    BORRADOR:       'badge-neutral',
    ACTIVO:         'badge-success',
    'EN_EJECUCIÓN': 'badge-info',
    SUSPENDIDO:     'badge-warning',
    LIQUIDADO:      'badge-neutral',
    ANULADO:        'badge-danger',
  },
  an: {
    PENDIENTE_PAGO:    'badge-neutral',
    PAGADO:            'badge-success',
    AMORTIZADO_PARCIAL:'badge-warning',
    AMORTIZADO_TOTAL:  'badge-neutral',
    ANULADO:           'badge-danger',
  },
  av: {
    BORRADOR:  'badge-neutral',
    APROBADA:  'badge-success',
    PAGADA:    'badge-success',
    RECHAZADA: 'badge-danger',
  },
  factura: {
    PENDIENTE: 'badge-warning',
    PAGADA:    'badge-success',
    ANULADA:   'badge-danger',
  },
  // Proyectos y Edificaciones comparten estados
  proyecto: {
    ACTIVO: 'badge-success', TERMINADO: 'badge-neutral', SUSPENDIDO: 'badge-warning',
  },
  capitulo: {
    PENDIENTE:      'badge-neutral',
    'EN_EJECUCIÓN': 'badge-info',
    TERMINADO:      'badge-success',
    SUSPENDIDO:     'badge-warning',
  },
  especialidad: {
    ESTRUCTURA:        'badge-info',
    MAMPOSTERÍA:       'badge-info',
    INSTALACIONES_HID: 'badge-info',
    INSTALACIONES_ELEC:'badge-info',
    ACABADOS:          'badge-neutral',
    CARPINTERÍA:       'badge-neutral',
    OBRA_GRUESA:       'badge-info',
    VARIOS:            'badge-neutral',
  },
} satisfies Record<string, Record<string, string>>

export type TipoBadge = keyof typeof BADGES
