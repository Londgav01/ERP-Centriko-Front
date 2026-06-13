
import { useEffect, useState } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { useProyecto } from '../../context/ProyectoContext'
import { usePagination } from '../../hooks/usePagination'
import Pagination from '../../components/ui/Pagination'
import {
  Plus, FileText, Loader2, AlertCircle,
  X, Eye, Check, XCircle, Printer
} from 'lucide-react'
import NumericInput from '../../components/ui/NumericInput'

interface OcDisponible {
  oc_id: string; nombre_proveedor: string; proveedor_id: string
  nombre_proyecto: string; nombre_edificio: string
  proyecto_id: string; edificio_id: string; valor_total: number
}

interface Factura {
  factura_id: string; numero_factura: string; fecha_factura: string
  fecha_pago: string; oc_id: string; ea_id: string
  nombre_proveedor: string; nombre_proyecto: string; nombre_edificio: string
  clasificacion: string; valor_factura: number; valor_pagado: number
  estado: string; notas: string; registrado_por: string; timestamp: string
}

const fmtCOP = (v: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(v || 0)

const CLASIFICACIONES = ['MATERIALES','SERVICIOS','EQUIPOS','MANO_DE_OBRA','OTROS']

const BADGE_ESTADO: Record<string, string> = {
  PENDIENTE: 'badge-warning',
  PAGADA:    'badge-success',
  ANULADA:   'badge-danger',
}

const EMPTY_FORM = {
  numero_factura: '', fecha_factura: '',
  oc_id: '', proveedor_id: '', nombre_proveedor: '',
  clasificacion: 'MATERIALES', valor_factura: 0, notas: ''
}

export default function FacturasPage() {
  const { toast }   = useToast()
  const { usuario } = useAuth()
  const { proyecto } = useProyecto()

  const [lista,         setLista]         = useState<Factura[]>([])
  const [ocDisponibles, setOcDisponibles] = useState<OcDisponible[]>([])
  const [filtroEstado,  setFiltroEstado]  = useState('')

  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [ocSel,      setOcSel]      = useState<OcDisponible | null>(null)
  const [error,      setError]      = useState('')
  const [cargando,   setCargando]   = useState(false)

  const [showDetalle, setShowDetalle] = useState(false)
  const [detalle,     setDetalle]     = useState<any>(null)
  const [cargandoDet, setCargandoDet] = useState(false)

  const [showPagar,   setShowPagar]   = useState(false)
  const [formPago,    setFormPago]    = useState({ fecha_pago: '', valor_pagado: 0 })
  const [pagoId,      setPagoId]      = useState('')

  const [cargandoPag, setCargandoPag] = useState(true)
  const pag = usePagination(lista)

  const cargarLista = async (estado = filtroEstado) => {
    const params = new URLSearchParams()
    if (proyecto?.proyecto_id) params.append('proyecto_id', proyecto.proyecto_id)
    if (estado)                params.append('estado', estado)
    const res = await api.get(`/api/facturas?${params}`)
    setLista(res.data.data); pag.reset()
  }

  useEffect(() => {
    if (!proyecto) { setLista([]); setCargandoPag(false); return }
    Promise.all([
      api.get(`/api/facturas?proyecto_id=${proyecto.proyecto_id}`),
      api.get(`/api/facturas/oc-disponibles/lista?proyecto_id=${proyecto.proyecto_id}`),
    ]).then(([rF, rOC]) => {
      setLista(rF.data.data)
      setOcDisponibles(rOC.data.data)
    }).finally(() => setCargandoPag(false))
  }, [proyecto?.proyecto_id])

  const set = (k: string, v: any) => setForm(s => ({ ...s, [k]: v }))

  const handleOC = (ocId: string) => {
    const oc = ocDisponibles.find(o => o.oc_id === ocId) || null
    setOcSel(oc)
    setForm(s => ({
      ...s, oc_id: ocId,
      proveedor_id:    oc?.proveedor_id    || '',
      nombre_proveedor: oc?.nombre_proveedor || '',
      valor_factura:   oc?.valor_total     || 0,
    }))
  }

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault(); setCargando(true); setError('')
    try {
      await api.post('/api/facturas', {
        ...form,
        proyecto_id:     proyecto?.proyecto_id,
        nombre_proyecto: proyecto?.nombre,
        edificio_id:     ocSel?.edificio_id,
        nombre_edificio: ocSel?.nombre_edificio,
      })
      toast.success('Factura registrada correctamente')
      setShowForm(false); setForm(EMPTY_FORM); setOcSel(null)
      cargarLista()
      const rOC = await api.get(
        `/api/facturas/oc-disponibles/lista?proyecto_id=${proyecto?.proyecto_id}`
      )
      setOcDisponibles(rOC.data.data)
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al guardar'
      setError(msg); toast.error(msg)
    } finally { setCargando(false) }
  }

  const verDetalle = async (facturaId: string) => {
    setCargandoDet(true); setShowDetalle(true)
    try {
      const res = await api.get(`/api/facturas/${facturaId}`)
      setDetalle(res.data.data)
    } finally { setCargandoDet(false) }
  }

  const abrirPagar = (f: Factura) => {
    setPagoId(f.factura_id)
    setFormPago({
      fecha_pago:   new Date().toISOString().slice(0, 10),
      valor_pagado: f.valor_factura,
    })
    setShowPagar(true)
  }

  const pagar = async () => {
    try {
      await api.put(`/api/facturas/${pagoId}/pagar`, formPago)
      toast.success('Factura marcada como pagada')
      setShowPagar(false); setShowDetalle(false); cargarLista()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  const anular = async (facturaId: string) => {
    if (!confirm('¿Anular esta factura?')) return
    try {
      await api.put(`/api/facturas/${facturaId}/anular`, {})
      toast.success('Factura anulada')
      setShowDetalle(false); cargarLista()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Error') }
  }

  const imprimirSoporte = (f: any) => {
    const ventana = window.open('', '_blank', 'width=800,height=900')
    if (!ventana) return

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Soporte Factura ${f.numero_factura}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; font-size: 13px; color: #1e293b; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
          .badge-success { background: #dcfce7; color: #16a34a; }
          .badge-warning { background: #fef9c3; color: #ca8a04; }
          .badge-danger  { background: #fee2e2; color: #dc2626; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0; }
          .field label { font-size: 10px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; }
          .field p { margin: 2px 0 0; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #1e293b; color: white; padding: 8px 12px; text-align: left; font-size: 11px; }
          td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
          .total-row td { font-weight: 700; background: #f8fafc; }
          .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <h1>Soporte de Factura</h1>
        <p style="color:#64748b;margin-bottom:16px">${f.factura_id}</p>
        <span class="badge badge-${f.estado === 'PAGADA' ? 'success' : f.estado === 'ANULADA' ? 'danger' : 'warning'}">
          ${f.estado}
        </span>

        <div class="grid" style="margin-top:20px">
          <div class="field"><label>Número de factura</label><p>${f.numero_factura}</p></div>
          <div class="field"><label>Fecha factura</label><p>${f.fecha_factura}</p></div>
          <div class="field"><label>Proveedor</label><p>${f.nombre_proveedor}</p></div>
          <div class="field"><label>Clasificación</label><p>${f.clasificacion}</p></div>
          <div class="field"><label>Proyecto</label><p>${f.nombre_proyecto}</p></div>
          <div class="field"><label>Edificación</label><p>${f.nombre_edificio || '—'}</p></div>
          ${f.oc_id ? `<div class="field"><label>Orden de compra</label><p>${f.oc_id}</p></div>` : ''}
          ${f.ea_id ? `<div class="field"><label>Entrada almacén</label><p>${f.ea_id}</p></div>` : ''}
          ${f.fecha_pago ? `<div class="field"><label>Fecha pago</label><p>${f.fecha_pago}</p></div>` : ''}
        </div>

        ${f.oc_detalle && f.oc_detalle.length > 0 ? `
          <h3 style="margin-top:24px;font-size:14px">Detalle de materiales (OC ${f.oc_id})</h3>
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Unidad</th>
                <th style="text-align:right">Cantidad</th>
                <th style="text-align:right">Precio Unitario</th>
                <th style="text-align:right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${f.oc_detalle.map((d: any) => `
                <tr>
                  <td>${d.nombre_material}</td>
                  <td>${d.unidad}</td>
                  <td style="text-align:right">${d.cantidad.toLocaleString('es-CO')}</td>
                  <td style="text-align:right">${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(d.precio_unitario)}</td>
                  <td style="text-align:right">${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(d.valor_total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        <table style="margin-top:16px;max-width:400px;margin-left:auto">
          <tr class="total-row">
            <td>Valor factura</td>
            <td style="text-align:right">${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(f.valor_factura)}</td>
          </tr>
          ${f.valor_pagado > 0 ? `
          <tr class="total-row">
            <td>Valor pagado</td>
            <td style="text-align:right">${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(f.valor_pagado)}</td>
          </tr>` : ''}
        </table>

        ${f.notas ? `<div style="margin-top:16px;padding:12px;background:#f8fafc;border-radius:6px"><strong>Notas:</strong> ${f.notas}</div>` : ''}

        <div class="footer">
          Registrado por ${f.registrado_por} · ${new Date(f.timestamp).toLocaleString('es-CO')}
        </div>

        <script>window.onload = () => window.print()</script>
      </body>
      </html>
    `
    ventana.document.write(html)
    ventana.document.close()
  }

  const puedeCrear = ['ADMIN','COORDINADOR','ENC_COMPRAS'].includes(usuario?.rol || '')
  const puedeGestionar = ['ADMIN','COORDINADOR'].includes(usuario?.rol || '')

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Facturación</h1>
          <p className="page-subtitle">{lista.length} factura{lista.length !== 1 ? 's' : ''}</p>
        </div>
        {puedeCrear && proyecto && (
          <button className="btn btn-primary" onClick={() => {
            setForm(EMPTY_FORM); setOcSel(null); setError(''); setShowForm(true)
          }}>
            <Plus size={15} /> Nueva factura
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="page-filters">
        <select className="form-select" value={filtroEstado}
          onChange={e => { setFiltroEstado(e.target.value); cargarLista(e.target.value) }}
          aria-label="Estado" style={{ width: 180 }}>
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">PENDIENTE</option>
          <option value="PAGADA">PAGADA</option>
          <option value="ANULADA">ANULADA</option>
        </select>
        <span className="td-muted" style={{ alignSelf: 'center', fontSize: 12 }}>
          {lista.length} registro{lista.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabla */}
      {cargandoPag ? (
        <div className="page-loading">
          <Loader2 size={20} className="spinner" /><span>Cargando...</span>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th><th>Nro. Factura</th><th>Proveedor</th>
                <th>Clasificación</th><th>Fecha</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th>OC vinculada</th><th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pag.itemsPagina.length === 0 ? (
                <tr><td colSpan={9}>
                  <div className="search-empty-state">
                    <FileText size={32} style={{ color: 'var(--color-text-muted)' }} />
                    <span>No hay facturas registradas</span>
                  </div>
                </td></tr>
              ) : pag.itemsPagina.map(f => (
                <tr key={f.factura_id}>
                  <td className="td-id">{f.factura_id}</td>
                  <td className="td-bold">{f.numero_factura}</td>
                  <td className="td-secondary">{f.nombre_proveedor}</td>
                  <td>
                    <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                      {f.clasificacion}
                    </span>
                  </td>
                  <td className="td-secondary">{f.fecha_factura}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {fmtCOP(f.valor_factura)}
                  </td>
                  <td className="td-secondary">{f.oc_id || '—'}</td>
                  <td>
                    <span className={`badge ${BADGE_ESTADO[f.estado] || 'badge-neutral'}`}>
                      {f.estado}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-sm"
                        onClick={() => verDetalle(f.factura_id)}>
                        <Eye size={13} /> Ver
                      </button>
                      {puedeGestionar && f.estado === 'PENDIENTE' && (
                        <button className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--color-success)' }}
                          onClick={() => abrirPagar(f)}>
                          <Check size={13} /> Pagar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination {...pag} />
        </div>
      )}

      {/* ── Modal nueva factura ─────────────────────────── */}
      {showForm && (
        <div className="modal-overlay"
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">Nueva factura</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}
                style={{ padding: '0 6px' }}><X size={16} /></button>
            </div>

            <form onSubmit={guardar}>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-error">
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}

                {/* OC vinculada */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label" htmlFor="fac-oc">
                    Orden de compra vinculada
                    <span className="form-hint" style={{ marginLeft: 6 }}>
                      (opcional — solo OC ya recibidas)
                    </span>
                  </label>
                  <select id="fac-oc" className="form-select"
                    value={form.oc_id}
                    onChange={e => handleOC(e.target.value)}
                    aria-label="OC vinculada">
                    <option value="">Sin OC vinculada</option>
                    {ocDisponibles.map(oc => (
                      <option key={oc.oc_id} value={oc.oc_id}>
                        {oc.oc_id} — {oc.nombre_proveedor} | {fmtCOP(oc.valor_total)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Info OC */}
                {ocSel && (
                  <div className="system-values-box" style={{ marginBottom: 16 }}>
                    <div className="form-grid-3">
                      {[
                        { label: 'Proveedor',   value: ocSel.nombre_proveedor },
                        { label: 'Proyecto',    value: ocSel.nombre_proyecto },
                        { label: 'Edificación', value: ocSel.nombre_edificio },
                      ].map(f => (
                        <div className="form-group" key={f.label}>
                          <label className="form-label">{f.label}</label>
                          <input className="form-input" value={f.value} disabled />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Proveedor manual si no hay OC */}
                {!form.oc_id && (
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label required">Proveedor</label>
                    <input className="form-input" value={form.nombre_proveedor}
                      onChange={e => set('nombre_proveedor', e.target.value)}
                      placeholder="Nombre del proveedor" required={!form.oc_id} />
                  </div>
                )}

                {/* Nro factura + Fecha + Clasificación */}
                <div className="form-grid-3" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="fac-nro">
                      Número de factura
                    </label>
                    <input id="fac-nro" className="form-input"
                      value={form.numero_factura}
                      onChange={e => set('numero_factura', e.target.value)}
                      required placeholder="Ej: FV-2026-001" />
                  </div>
                  <div className="form-group">
                    <label className="form-label required" htmlFor="fac-fecha">
                      Fecha factura
                    </label>
                    <input id="fac-fecha" type="date" className="form-input"
                      value={form.fecha_factura}
                      onChange={e => set('fecha_factura', e.target.value)}
                      required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="fac-clas">
                      Clasificación
                    </label>
                    <select id="fac-clas" className="form-select"
                      value={form.clasificacion}
                      onChange={e => set('clasificacion', e.target.value)}
                      aria-label="Clasificación">
                      {CLASIFICACIONES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Valor */}
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label required" htmlFor="fac-val">
                    Valor de la factura (COP)
                  </label>
                  <NumericInput id="fac-val" value={form.valor_factura}
                    onChange={val => set('valor_factura', val)}
                    prefix="$" required />
                </div>

                {/* Notas */}
                <div className="form-group">
                  <label className="form-label" htmlFor="fac-notas">Notas</label>
                  <textarea id="fac-notas" className="form-textarea"
                    value={form.notas}
                    onChange={e => set('notas', e.target.value)}
                    rows={2} placeholder="Observaciones" />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary"
                  onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={cargando}>
                  {cargando
                    ? <><Loader2 size={14} className="spinner" /> Guardando...</>
                    : 'Registrar factura'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal detalle factura ───────────────────────── */}
      {showDetalle && (
        <div className="modal-overlay"
          onClick={e => e.target === e.currentTarget && setShowDetalle(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">
                Factura — {detalle?.numero_factura}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDetalle(false)}
                style={{ padding: '0 6px' }}><X size={16} /></button>
            </div>

            <div className="modal-body">
              {cargandoDet ? (
                <div className="page-loading">
                  <Loader2 size={18} className="spinner" /><span>Cargando...</span>
                </div>
              ) : detalle && (
                <>
                  <div className="system-values-box" style={{ marginBottom: 16 }}>
                    <div className="form-grid-3">
                      {[
                        { id: 'fd-nro',  label: 'Nro. Factura',  value: detalle.numero_factura },
                        { id: 'fd-fec',  label: 'Fecha',         value: detalle.fecha_factura },
                        { id: 'fd-prov', label: 'Proveedor',     value: detalle.nombre_proveedor },
                        { id: 'fd-clas', label: 'Clasificación', value: detalle.clasificacion },
                        { id: 'fd-proy', label: 'Proyecto',      value: detalle.nombre_proyecto },
                        { id: 'fd-edif', label: 'Edificación',   value: detalle.nombre_edificio || '—' },
                        { id: 'fd-oc',   label: 'OC vinculada',  value: detalle.oc_id  || '—' },
                        { id: 'fd-ea',   label: 'EA vinculada',  value: detalle.ea_id  || '—' },
                        { id: 'fd-pag',  label: 'Fecha pago',    value: detalle.fecha_pago || '—' },
                      ].map(f => (
                        <div className="form-group" key={f.id}>
                          <label className="form-label" htmlFor={f.id}>{f.label}</label>
                          <input id={f.id} className="form-input" value={f.value} disabled />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Valores */}
                  <div style={{
                    display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap'
                  }}>
                    {[
                      { label: 'Valor factura', value: fmtCOP(detalle.valor_factura),
                        color: 'var(--color-primary)' },
                      { label: 'Valor pagado',  value: fmtCOP(detalle.valor_pagado),
                        color: 'var(--color-success)' },
                      { label: 'Estado',
                        value: detalle.estado,
                        color: detalle.estado === 'PAGADA' ? 'var(--color-success)'
                          : detalle.estado === 'ANULADA'   ? 'var(--color-danger)'
                          : 'var(--color-warning)'
                      },
                    ].map(k => (
                      <div key={k.label} style={{
                        flex: 1, minWidth: 140, background: 'var(--color-bg)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)', padding: '12px 16px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)',
                          textTransform: 'uppercase', marginBottom: 4 }}>{k.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: k.color }}>
                          {k.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Detalle OC si existe */}
                  {detalle.oc_detalle?.length > 0 && (
                    <>
                      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                        Materiales de la OC {detalle.oc_id}
                      </h3>
                      <div className="data-table-wrapper" style={{ marginBottom: 16 }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Material</th>
                              <th style={{ textAlign: 'center' }}>Unidad</th>
                              <th style={{ textAlign: 'right' }}>Cantidad</th>
                              <th style={{ textAlign: 'right' }}>P. Unitario</th>
                              <th style={{ textAlign: 'right' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detalle.oc_detalle.map((d: any) => (
                              <tr key={d.det_id}>
                                <td className="td-bold">{d.nombre_material}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className="badge badge-neutral">{d.unidad}</span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {d.cantidad.toLocaleString('es-CO')}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {fmtCOP(d.precio_unitario)}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                  {fmtCOP(d.valor_total)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {detalle.notas && (
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)',
                      padding: '10px 14px', background: 'var(--color-bg)',
                      borderRadius: 'var(--radius-md)' }}>
                      <strong>Notas:</strong> {detalle.notas}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer">
              {detalle && (
                <button className="btn btn-secondary btn-sm"
                  onClick={() => imprimirSoporte(detalle)}>
                  <Printer size={13} /> Imprimir soporte
                </button>
              )}
              {puedeGestionar && detalle?.estado === 'PENDIENTE' && (
                <button className="btn btn-primary btn-sm"
                  onClick={() => abrirPagar(detalle)}>
                  <Check size={14} /> Pagar
                </button>
              )}
              {puedeGestionar && detalle?.estado !== 'ANULADA' && (
                <button className="btn btn-danger btn-sm"
                  onClick={() => anular(detalle.factura_id)}>
                  <XCircle size={14} /> Anular
                </button>
              )}
              <button className="btn btn-secondary"
                onClick={() => setShowDetalle(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal pagar ─────────────────────────────────── */}
      {showPagar && (
        <div className="modal-overlay"
          onClick={e => e.target === e.currentTarget && setShowPagar(false)}>
          <div className="modal" style={{ width: 400 }}>
            <div className="modal-header">
              <span className="modal-title">Registrar pago</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPagar(false)}
                style={{ padding: '0 6px' }}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label required">Fecha de pago</label>
                <input type="date" className="form-input"
                  value={formPago.fecha_pago}
                  onChange={e => setFormPago(s => ({ ...s, fecha_pago: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label required">Valor pagado (COP)</label>
                <NumericInput value={formPago.valor_pagado}
                  onChange={val => setFormPago(s => ({ ...s, valor_pagado: val }))}
                  prefix="$" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPagar(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={pagar}>
                <Check size={14} /> Confirmar pago
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}