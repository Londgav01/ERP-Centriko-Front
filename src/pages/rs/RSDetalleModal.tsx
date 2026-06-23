import { Loader2, Check, XCircle } from 'lucide-react'
import { FormModal, NumericInput, LoadingState } from '../../components/ui'
import type { RS, RSDetalle } from '../../types'

interface RSDetalleModalProps {
  open: boolean
  onClose: () => void
  /** Carga del detalle de la requisición. */
  cargando: boolean
  /** Requisición consultada (null mientras carga). */
  rs: RS | null
  /** Ítems del detalle. */
  items: RSDetalle[]
  /** true → modo aprobación (cantidades editables + notas); false → solo lectura. */
  modoAprobar: boolean
  /** Cantidades aprobadas por det_id (editables en modo aprobación). */
  cantAprobadas: Record<string, number>
  /** Actualiza la cantidad aprobada de un ítem. */
  setCantAprobada: (detId: string, val: number) => void
  notasAprobar: string
  setNotasAprobar: (v: string) => void
  /** Procesa la aprobación. */
  onAprobar: () => void
  /** Rechaza la requisición (solo en modo aprobación, estado BORRADOR). */
  onRechazar: () => void
  /** Anula la requisición (modo lectura, estados activos). */
  onAnular: () => void
  /** true mientras se procesa aprobar/rechazar/anular. */
  procesando: boolean
  /** Permiso de aprobación/anulación del usuario actual. */
  puedeAprobar: boolean
}

/**
 * Modal de detalle de una requisición. En modo lectura muestra los datos y
 * cantidades aprobadas; en modo aprobación permite ajustar cantidades,
 * agregar notas y aprobar/rechazar. También permite anular según permisos.
 */
export default function RSDetalleModal({
  open, onClose, cargando, rs, items, modoAprobar,
  cantAprobadas, setCantAprobada, notasAprobar, setNotasAprobar,
  onAprobar, onRechazar, onAnular, procesando, puedeAprobar,
}: RSDetalleModalProps) {
  /** Pie del modal: depende del modo (aprobación) y del estado de la RS. */
  const footer = modoAprobar && rs?.estado === 'BORRADOR' ? (
    <>
      <button className="btn btn-danger btn-sm" onClick={onRechazar}>
        <XCircle size={14} /> Rechazar
      </button>
      <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" onClick={onAprobar} disabled={procesando}>
        {procesando ? <><Loader2 size={14} className="spinner" /> Aprobando...</> : <><Check size={14} /> Aprobar RS</>}
      </button>
    </>
  ) : (
    <>
      {puedeAprobar && rs && ['BORRADOR', 'APROBADA', 'EN_PROCESO'].includes(rs.estado) && (
        <button className="btn btn-danger btn-sm" onClick={onAnular}>
          <XCircle size={14} /> Anular
        </button>
      )}
      <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
    </>
  )

  return (
    <FormModal
      open={open}
      title={modoAprobar ? `Aprobar — ${rs?.rs_id}` : `Detalle — ${rs?.rs_id}`}
      onClose={onClose}
      className="rs-modal-wide"
      footer={footer}
    >
      {cargando ? (
        <LoadingState texto="Cargando..." size={18} />
      ) : rs && (
        <>
          <div className="system-values-box rs-system-box-gap">
            <div className="form-grid-3">
              {[
                { id: 'rs-dp', label: 'Proyecto',    value: rs.nombre_proyecto },
                { id: 'rs-de', label: 'Edificación', value: rs.nombre_edificio },
                { id: 'rs-dc', label: 'Capítulo',    value: rs.nombre_capitulo },
                { id: 'rs-ds', label: 'Solicitante', value: rs.solicitante },
                { id: 'rs-dpr', label: 'Prioridad',  value: rs.prioridad },
                { id: 'rs-dst', label: 'Estado',     value: rs.estado },
              ].map(f => (
                <div className="form-group" key={f.id}>
                  <label className="form-label" htmlFor={f.id}>{f.label}</label>
                  <input id={f.id} className="form-input" value={f.value} disabled />
                </div>
              ))}
            </div>
          </div>

          <div className="data-table-wrapper rs-table-gap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material</th><th>Unidad</th>
                  <th>Cant. solicitada</th><th>Cant. aprobada</th><th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {items.map(d => (
                  <tr key={d.det_id}>
                    <td className="td-bold">{d.nombre_material}</td>
                    <td className="rs-td-unidad">
                      <span className="badge badge-neutral">{d.unidad}</span>
                    </td>
                    <td className="rs-det-cantidad-right">
                      {d.cantidad_solicitada.toLocaleString('es-CO')}
                    </td>
                    <td>
                      {modoAprobar ? (
                        <NumericInput
                          value={cantAprobadas[d.det_id] ?? d.cantidad_solicitada}
                          onChange={val => setCantAprobada(d.det_id, val)}
                          decimals={2} max={d.cantidad_solicitada}
                        />
                      ) : (
                        <span className={d.cantidad_aprobada != null ? 'rs-det-cantidad-aprobada' : 'rs-det-cantidad-pendiente'}>
                          {d.cantidad_aprobada != null ? d.cantidad_aprobada.toLocaleString('es-CO') : '—'}
                        </span>
                      )}
                    </td>
                    <td className="td-secondary">{d.notas || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {modoAprobar && (
            <div className="form-group">
              <label className="form-label" htmlFor="rs-notas-apr">Notas de aprobación</label>
              <textarea id="rs-notas-apr" className="form-textarea" value={notasAprobar}
                onChange={e => setNotasAprobar(e.target.value)} rows={2}
                placeholder="Observaciones al aprobar" />
            </div>
          )}
        </>
      )}
    </FormModal>
  )
}
