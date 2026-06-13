// Documentos del ciclo de materiales (RS → CZ → OC → EA → Stock → SA),
// contratos (CT → AN → AV → Factura) y presupuesto jerárquico.
// Superset de los campos que devuelve la API por documento.

// ── Requisición de materiales (RS) ──────────────────────────────
export interface RS {
  rs_id: string
  estado: string
  prioridad: string
  nombre_proyecto: string
  nombre_edificio: string
  nombre_capitulo: string
  solicitante: string
  fecha_solicitud: string
  descripcion: string
  proyecto_id: string
}

export interface RSDetalle {
  det_id: string
  material_id: string
  nombre_material: string
  unidad: string
  cantidad_solicitada: number
  cantidad_aprobada: number
  notas: string
}

// ── Cotización (CZ) ─────────────────────────────────────────────
export interface CZ {
  cz_id: string
  rs_id: string
  nombre_proveedor: string
  nombre_proyecto: string
  nombre_capitulo: string
  condiciones_pago: string
  dias_entrega: number
  vigencia_dias: number
  valor_total: number
  estado: string
  es_ganadora: number
  timestamp: string
}

export interface ItemCZ {
  material_id: string
  nombre_material: string
  unidad: string
  cantidad: number
  precio_unitario: number
  descuento_pct: number
  precio_neto: number
  valor_total: number
  notas: string
}

// ── Orden de compra (OC) ────────────────────────────────────────
export interface OC {
  oc_id: string
  rs_id: string
  cz_id: string
  nombre_proveedor: string
  subtotal: number
  nombre_proyecto?: string
  nombre_edificio?: string
  nombre_capitulo?: string
  codigo_capitulo?: string
  iva_pct: number
  valor_iva: number
  valor_total: number
  estado: string
  fecha_entrega_esperada: string
  forma_pago: string
  aprobado_por: string
}

// ── Entrada de almacén (EA) ─────────────────────────────────────
export interface EA {
  ea_id: string
  oc_id: string
  nombre_proveedor: string
  nombre_edificio: string
  nombre_proyecto: string
  nro_remision: string
  nro_factura: string
  almacenista: string
  estado: string
  timestamp: string
}

export interface ItemEA {
  det_id: string
  material_id: string
  nombre_material: string
  unidad: string
  pendiente: number
  precio_unitario: number
  cantidad_recibida: number
  incluir: boolean
}

// ── Inventario (Stock) ──────────────────────────────────────────
export interface StockItem {
  stock_id: string
  edificio_id: string
  nombre_edificio: string
  material_id: string
  nombre_material: string
  unidad: string
  stock_actual: number
  stock_minimo: number
  alerta: number
  ubicacion: string
  costo_promedio: number
  ultima_entrada: string
  ultima_salida: string
}

// ── Salida de almacén (SA) ──────────────────────────────────────
export interface SA {
  sa_id: string
  proyecto_id: string
  nombre_proyecto: string
  nombre_edificio: string
  nombre_capitulo: string
  solicitante: string
  destino_zona: string
  estado: string
  timestamp: string
}

export interface ItemSA {
  material_id: string
  nombre_material: string
  unidad: string
  stock_disponible: number
  costo_promedio: number
  cantidad_solicitada: number
  cantidad_despachada: number
}

// ── Contrato (CT) ───────────────────────────────────────────────
export interface CT {
  ct_id: string
  proyecto_id: string
  nombre_proyecto: string
  edificio_id: string
  nombre_edificio: string
  capitulo_id: string
  nombre_capitulo: string
  contratista_id: string
  nombre_contratista: string
  objeto_contrato: string
  valor_contrato: number
  forma_pago: string
  pct_anticipo: number
  fecha_inicio: string
  fecha_fin: string
  estado: string
  aprobado_por: string
  notas: string
  tipo_contrato: string
  valor_ejecutado_ct: number
  valor_por_ejecutar: number
  rete_garantia_valor: number
  rete_garantia_pct: number
  anticipo_por_amortizar: number
  valor_facturado: number
}

// Línea (ítem) del detalle de un contrato
export interface CTItemDetalle {
  det_id: string
  capitulo_id?: string
  nombre_capitulo: string
  descripcion: string
  unidad: string
  valor_unidad: number
  cantidad: number
  valor_total: number
  holgura: number
  holgura_cantidad: number
  valor_con_holgura: number
}

// ── Anticipo (AN) ───────────────────────────────────────────────
export interface AN {
  an_id: string
  ct_id: string
  nombre_contratista: string
  nombre_proyecto: string
  nombre_capitulo: string
  monto_anticipo: number
  pct_anticipo: number
  amortizado: number
  saldo_amortizar: number
  estado: string
  timestamp: string
  notas: string
}

// ── Acta de avance (AV) ─────────────────────────────────────────
export interface AV {
  av_id: string
  ct_id: string
  nombre_capitulo: string
  nombre_contratista: string
  valor_contrato: number
  pct_avance_acumulado: number
  pct_avance_este_acta: number
  valor_acta: number
  vr_amortiz_anticipo: number
  retencion_pct: number
  vr_retencion: number
  valor_neto_pagar: number
  estado: string
  timestamp: string
  periodo_desde?: string
  periodo_hasta?: string
  aprobado_por?: string
}

// ── Factura ─────────────────────────────────────────────────────
export interface Factura {
  factura_id: string
  numero_factura: string
  fecha_factura: string
  fecha_pago: string
  oc_id: string
  ea_id: string
  nombre_proveedor: string
  nombre_proyecto: string
  nombre_edificio: string
  clasificacion: string
  valor_factura: number
  valor_pagado: number
  estado: string
  notas: string
  registrado_por: string
  timestamp: string
}

// ── Presupuesto jerárquico ──────────────────────────────────────
export interface CapituloPresupuesto {
  capitulo_id: string
  codigo: string
  nombre_capitulo: string
  valor_presupuestado: number
  valor_comprometido: number
  valor_ejecutado: number
  avance_fisico_pct: number
  total_sub_capitulos: number
  total_actividades: number
  nombre_edificio: string
  nombre_proyecto: string
  avance_economico_pct: number
  avance_fisico_calc: number
  valor_presupuestado_calc: number
}

export interface SubCapitulo {
  sub_capitulo_id: string
  capitulo_id: string
  codigo: string
  nombre_sub_capitulo: string
  valor_presupuestado: number
  valor_comprometido: number
  valor_ejecutado: number
  total_actividades: number
  estado: string
}

export interface Actividad {
  actividad_id: string
  sub_capitulo_id: string
  capitulo_id: string
  codigo: string
  nombre_actividad: string
  tipo: 'DETALLADA' | 'GLOBAL'
  unidad: string
  cantidad: number
  vr_unitario: number
  vr_total: number
  valor_comprometido: number
  valor_ejecutado: number
  avance_fisico_pct: number
  estado: string
}
