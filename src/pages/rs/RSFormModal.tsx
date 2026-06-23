import type { FormEvent } from 'react'
import { Plus, AlertCircle, Trash2 } from 'lucide-react'
import { FormModal, MaterialAutocomplete, NumericInput } from '../../components/ui'
import { fmtCOP } from '../../utils/formato'
import { PRIORIDADES_RS } from '../../lib/constantes'
import type { Proyecto, Edificacion, Capitulo, Material } from '../../types'

/** Datos del encabezado de la requisición editados en el modal. */
export interface RSForm {
  proyecto_id: string
  edificio_id: string
  capitulo_id: string
  descripcion: string
  prioridad: string
  notas: string
}

/** Ítem (material solicitado) dentro del formulario de la requisición. */
export interface ItemRS {
  material_id: string
  nombre_material: string
  unidad: string
  cantidad_solicitada: number
  notas: string
}

/** Último precio registrado de un material (para mostrarlo como referencia). */
export interface UltimoPrecio {
  precio_unitario: number
  nombre_proveedor: string
}

/** Formulario vacío de una requisición nueva. */
export const EMPTY_RS_FORM: RSForm = {
  proyecto_id: '', edificio_id: '', capitulo_id: '',
  descripcion: '', prioridad: 'MEDIA', notas: '',
}

interface RSFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (ev: FormEvent) => void
  error: string
  cargando: boolean
  /** Encabezado de la requisición. */
  form: RSForm
  /** Actualiza un campo del encabezado. */
  set: <K extends keyof RSForm>(key: K, val: RSForm[K]) => void
  /** Catálogo de proyectos. */
  proyectos: Proyecto[]
  /** Edificaciones filtradas por el proyecto seleccionado (cascada). */
  edifFiltradas: Edificacion[]
  /** Capítulos filtrados por la edificación seleccionada (cascada). */
  capFiltrados: Capitulo[]
  /** Maneja el cambio de proyecto (limpia edificación y capítulo). */
  onProyecto: (proyId: string) => void
  /** Maneja el cambio de edificación (limpia capítulo). */
  onEdificio: (edifId: string) => void
  /** Ítems de materiales solicitados. */
  items: ItemRS[]
  /** Agrega una fila de ítem vacía. */
  agregarItem: () => void
  /** Elimina la fila de ítem indicada. */
  eliminarItem: (idx: number) => void
  /** Actualiza un campo de un ítem. */
  actualizarItem: (idx: number, key: keyof ItemRS, val: string | number) => void
  /** Selecciona el material de un ítem (dispara la carga de su último precio). */
  onSelectMaterial: (idx: number, mat: Material) => void
  /** Últimos precios por material_id. */
  ultimosPrecios: Record<string, UltimoPrecio>
}

/**
 * Modal para crear una requisición de materiales: cascada
 * Proyecto → Edificación → Capítulo, datos generales y tabla de ítems con
 * autocomplete de materiales y referencia de último precio.
 */
export default function RSFormModal({
  open, onClose, onSubmit, error, cargando,
  form, set, proyectos, edifFiltradas, capFiltrados, onProyecto, onEdificio,
  items, agregarItem, eliminarItem, actualizarItem, onSelectMaterial, ultimosPrecios,
}: RSFormModalProps) {
  return (
    <FormModal
      open={open}
      title="Nueva requisición de materiales"
      onClose={onClose}
      onSubmit={onSubmit}
      className="rs-modal-wide"
      error={error}
      cargando={cargando}
      submitLabel="Crear requisición"
    >
      <div className="form-grid-3 rs-grid-gap">
        <div className="form-group">
          <label className="form-label required" htmlFor="rs-proy">Proyecto</label>
          <select id="rs-proy" className="form-select" value={form.proyecto_id}
            onChange={e => onProyecto(e.target.value)} required aria-label="Proyecto">
            <option value="">Selecciona...</option>
            {proyectos.map(p => <option key={p.proyecto_id} value={p.proyecto_id}>{p.nombre}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label required" htmlFor="rs-edif">Edificación</label>
          <select id="rs-edif" className="form-select" value={form.edificio_id}
            onChange={e => onEdificio(e.target.value)}
            required disabled={!form.proyecto_id} aria-label="Edificación">
            <option value="">{!form.proyecto_id ? 'Primero elige proyecto' : 'Selecciona...'}</option>
            {edifFiltradas.map(e => <option key={e.edificio_id} value={e.edificio_id}>{e.nombre}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label required" htmlFor="rs-cap">Capítulo</label>
          <select id="rs-cap" className="form-select" value={form.capitulo_id}
            onChange={e => set('capitulo_id', e.target.value)}
            required disabled={!form.edificio_id} aria-label="Capítulo">
            <option value="">{!form.edificio_id ? 'Primero elige edificación' : 'Selecciona...'}</option>
            {capFiltrados.map(c => <option key={c.capitulo_id} value={c.capitulo_id}>{c.codigo} — {c.nombre_capitulo}</option>)}
          </select>
        </div>
      </div>

      <div className="form-grid-2 rs-grid-gap">
        <div className="form-group">
          <label className="form-label" htmlFor="rs-desc">Descripción general</label>
          <input id="rs-desc" className="form-input" value={form.descripcion}
            onChange={e => set('descripcion', e.target.value)}
            placeholder="Resumen de lo que se solicita" />
        </div>
        <div className="form-group">
          <label className="form-label required" htmlFor="rs-prior">Prioridad</label>
          <select id="rs-prior" className="form-select" value={form.prioridad}
            onChange={e => set('prioridad', e.target.value)} aria-label="Prioridad">
            {PRIORIDADES_RS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="rs-items-header">
        <label className="form-label rs-items-label">Materiales solicitados</label>
        <button type="button" className="btn btn-secondary btn-sm" onClick={agregarItem}>
          <Plus size={13} /> Agregar material
        </button>
      </div>

      {items.length === 0 ? (
        <div className="alert alert-info rs-grid-gap">
          <AlertCircle size={15} className="rs-no-shrink" />
          <span>Haz clic en "Agregar material" para comenzar</span>
        </div>
      ) : (
        <div className="rs-items-table-wrapper">
          <table className="rs-items-table">
            <thead>
              <tr>
                <th className="rs-th-material">Material</th>
                <th className="rs-th-unidad">Unidad</th>
                <th className="rs-th-cantidad">Cantidad</th>
                <th className="rs-th-notas">Notas</th>
                <th className="rs-th-precio">Último precio</th>
                <th className="rs-th-actions" aria-label="Acciones"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td className="rs-autocomplete-cell">
                    <MaterialAutocomplete
                      value={item.nombre_material}
                      onSelect={mat => onSelectMaterial(idx, mat)}
                      ariaLabel={`Material ${idx + 1}`}
                    />
                  </td>
                  <td className="rs-td-unidad">
                    <span className="badge badge-neutral">{item.unidad || '—'}</span>
                  </td>
                  <td>
                    <NumericInput
                      value={item.cantidad_solicitada}
                      onChange={val => actualizarItem(idx, 'cantidad_solicitada', val)}
                      decimals={2} required
                    />
                  </td>
                  <td>
                    <input className="form-input rs-notes-input"
                      value={item.notas} placeholder="Observación"
                      onChange={e => actualizarItem(idx, 'notas', e.target.value)}
                      aria-label={`Notas ítem ${idx + 1}`} />
                  </td>
                  <td className="rs-th-precio">
                    {ultimosPrecios[item.material_id] ? (
                      <div>
                        <span className="rs-precio-valor">
                          {fmtCOP(ultimosPrecios[item.material_id].precio_unitario)}
                        </span>
                        <span className="td-muted rs-precio-proveedor">
                          {ultimosPrecios[item.material_id].nombre_proveedor}
                        </span>
                      </div>
                    ) : (
                      <span className="td-muted">Sin historial</span>
                    )}
                  </td>
                  <td>
                    <button type="button" className="btn btn-danger btn-sm rs-trash-button"
                      onClick={() => eliminarItem(idx)} aria-label="Eliminar ítem">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="rs-notas">Notas adicionales</label>
        <textarea id="rs-notas" className="form-textarea" value={form.notas}
          onChange={e => set('notas', e.target.value)} rows={2}
          placeholder="Observaciones generales de la requisición" />
      </div>
    </FormModal>
  )
}
