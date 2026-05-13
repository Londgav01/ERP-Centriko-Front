import { useEffect, useState, useRef } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import {
  Warehouse, Loader2, Search, RefreshCw,
  DollarSign, AlertTriangle, Building2, Pencil
} from 'lucide-react'
import { usePagination } from '../../hooks/usePagination'
import Pagination from '../../components/ui/Pagination'

interface StockItem {
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

interface Edificacion { edificio_id: string; nombre: string }

const fmtCOP = (v: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(v || 0)

export default function StockPage() {
  const { usuario } = useAuth()
  const { toast }   = useToast()

  const [stock,         setStock]         = useState<StockItem[]>([])
  const pag = usePagination(stock)
  const [edificaciones, setEdificaciones] = useState<Edificacion[]>([])
  const [filtroEdif,    setFiltroEdif]    = useState('')
  const [filtroAlerta,  setFiltroAlerta]  = useState('')
  const [busqueda,      setBusqueda]      = useState('')
  const [cargando,      setCargando]      = useState(true)

  const [editandoMinimo, setEditandoMinimo] = useState<string | null>(null)
  const [valorMinimo,    setValorMinimo]    = useState<number>(0)
  const [guardandoMin,   setGuardandoMin]   = useState(false)

  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cargar = async (edif = filtroEdif, alerta = filtroAlerta, q = busqueda) => {
    setCargando(true)
    try {
      const params = new URLSearchParams()
      if (edif)   params.append('edificio_id', edif)
      if (alerta) params.append('alerta', alerta)
      if (q)      params.append('q', encodeURIComponent(q))
      const res = await api.get(`/api/ea/stock/lista?${params}`)
      setStock(res.data.data)
      pag.reset()
    } finally { setCargando(false) }
  }

  useEffect(() => {
    Promise.all([
      api.get('/api/ea/stock/lista'),
      api.get('/api/edificaciones'),
    ]).then(([rS, rE]) => {
      setStock(rS.data.data)
      setEdificaciones(rE.data.data)
        pag.reset()
    }).finally(() => setCargando(false))
  }, [])

  const handleBusqueda = (q: string) => {
    setBusqueda(q)
    if (debRef.current) clearTimeout(debRef.current)
    debRef.current = setTimeout(() => cargar(filtroEdif, filtroAlerta, q), 350)
  }

  const handleFiltro = (edif: string, alerta: string) => {
    setFiltroEdif(edif)
    setFiltroAlerta(alerta)
    cargar(edif, alerta, busqueda)
  }

  const guardarMinimo = async (stockId: string) => {
    if (valorMinimo < 0) { toast.error('El stock mínimo no puede ser negativo'); return }
    setGuardandoMin(true)
    try {
      await api.put(`/api/ea/stock/${stockId}/minimo`, { stock_minimo: valorMinimo })
      toast.success('Stock mínimo actualizado')
      setEditandoMinimo(null)
      cargar()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al actualizar')
    } finally { setGuardandoMin(false) }
  }

  // KPIs
  const totalItems       = stock.length
  const valorTotal       = stock.reduce((s, i) => s + (i.stock_actual * i.costo_promedio), 0)
  const alertas          = stock.filter(i => i.alerta === 1).length
  const edificsConStock  = new Set(stock.filter(i => i.stock_actual > 0).map(i => i.edificio_id)).size

  const rowBg = (item: StockItem) => {
    if (item.stock_actual <= 0) return 'var(--color-danger-bg)'
    if (item.alerta === 1)      return 'var(--color-warning-bg)'
    return undefined
  }

  const stockBadge = (item: StockItem) => {
    if (item.stock_actual <= 0)
      return <span className="badge badge-danger">{item.stock_actual} {item.unidad}</span>
    if (item.alerta === 1)
      return <span className="badge badge-warning">{item.stock_actual.toLocaleString('es-CO')} {item.unidad}</span>
    return <span className="badge badge-success">{item.stock_actual.toLocaleString('es-CO')} {item.unidad}</span>
  }

  const puedeEditarMinimo = ['ADMIN','COORDINADOR'].includes(usuario?.rol || '')

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventario de Stock</h1>
          <p className="page-subtitle">
            Control de materiales en obra — solo lectura
            {puedeEditarMinimo && <span className="td-muted"> · Puedes editar el stock mínimo haciendo clic en el valor</span>}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => cargar()}>
          <RefreshCw size={14} /> Recargar
        </button>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Warehouse size={16} style={{ color: 'var(--color-primary)' }} />
            </div>
            <span className="kpi-label">Ítems en stock</span>
          </div>
          <div className="kpi-value">{totalItems}</div>
        </div>

        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={16} style={{ color: 'var(--color-success)' }} />
            </div>
            <span className="kpi-label">Valor total inventario</span>
          </div>
          <div className="kpi-value" style={{ fontSize: 18 }}>{fmtCOP(valorTotal)}</div>
        </div>

        <div className="kpi-card" style={{
          borderLeft: alertas > 0 ? '3px solid var(--color-warning)' : undefined
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />
            </div>
            <span className="kpi-label">Alertas stock mínimo</span>
          </div>
          <div className="kpi-value" style={{
            color: alertas > 0 ? 'var(--color-warning)' : 'var(--color-text-primary)'
          }}>
            {alertas}
          </div>
        </div>

        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={16} style={{ color: 'var(--color-info)' }} />
            </div>
            <span className="kpi-label">Edificaciones con stock</span>
          </div>
          <div className="kpi-value">{edificsConStock}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="page-filters">
        <div className="search-bar" style={{ width: 280 }}>
          <Search size={14} />
          <input
            className="form-input"
            placeholder="Buscar material, edificación..."
            value={busqueda}
            onChange={e => handleBusqueda(e.target.value)}
            aria-label="Buscar en inventario"
          />
        </div>

        <select className="form-select" value={filtroEdif}
          onChange={e => handleFiltro(e.target.value, filtroAlerta)}
          aria-label="Filtrar por edificación" style={{ width: 220 }}>
          <option value="">Todas las edificaciones</option>
          {edificaciones.map(e => (
            <option key={e.edificio_id} value={e.edificio_id}>
              {e.edificio_id} — {e.nombre}
            </option>
          ))}
        </select>

        <select className="form-select" value={filtroAlerta}
          onChange={e => handleFiltro(filtroEdif, e.target.value)}
          aria-label="Filtrar por alerta" style={{ width: 180 }}>
          <option value="">Todo el inventario</option>
          <option value="1">Solo con alerta</option>
          <option value="0">Sin alerta</option>
        </select>

        <span className="td-muted" style={{ alignSelf: 'center', fontSize: 12 }}>
          {stock.length} registro{stock.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabla */}
      {cargando ? (
        <div className="page-loading">
          <Loader2 size={20} className="spinner" /><span>Cargando inventario...</span>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID Stock</th>
                <th>Edificación</th>
                <th>Material</th>
                <th style={{ textAlign: 'center' }}>Unidad</th>
                <th style={{ textAlign: 'center' }}>Stock actual</th>
                <th style={{ textAlign: 'right' }}>
                  Stock mín.
                  {puedeEditarMinimo && (
                    <Pencil size={10} style={{ marginLeft: 4, opacity: 0.4 }} />
                  )}
                </th>
                <th style={{ textAlign: 'right' }}>Costo prom.</th>
                <th style={{ textAlign: 'right' }}>Valor total</th>
                <th style={{ textAlign: 'center' }}>Alerta</th>
                <th>Últ. entrada</th>
                <th>Últ. salida</th>
              </tr>
            </thead>
            <tbody>
              {stock.length === 0 ? (
                <tr><td colSpan={11}>
                  <div className="search-empty-state">
                    <Warehouse size={32} style={{ color: 'var(--color-text-muted)' }} />
                    <span>No hay registros de inventario</span>
                  </div>
                </td></tr>
              ) : (
                <>
                  {pag.itemsPagina.map(item => (
                    <tr key={item.stock_id} style={{ background: rowBg(item) }}>

                  {/* ID Stock */}
                  <td>
                    <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                      {item.stock_id}
                    </span>
                  </td>

                  {/* Edificación */}
                  <td className="td-secondary">{item.nombre_edificio}</td>

                  {/* Material */}
                  <td className="td-bold">{item.nombre_material}</td>

                  {/* Unidad */}
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge badge-neutral">{item.unidad}</span>
                  </td>

                  {/* Stock actual con badge */}
                  <td style={{ textAlign: 'center' }}>{stockBadge(item)}</td>

                  {/* Stock mínimo — editable para ADMIN/COORDINADOR */}
                  <td style={{ textAlign: 'right' }}>
                    {puedeEditarMinimo ? (
                      editandoMinimo === item.stock_id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                          <input
                            type="number"
                            min={0}
                            value={valorMinimo}
                            onChange={e => setValorMinimo(Number(e.target.value))}
                            onKeyDown={e => {
                              if (e.key === 'Enter')  guardarMinimo(item.stock_id)
                              if (e.key === 'Escape') setEditandoMinimo(null)
                            }}
                            autoFocus
                            style={{
                              width: 70, height: 28, padding: '0 6px',
                              fontSize: 12, textAlign: 'right',
                              border: '1px solid var(--color-border-focus)',
                              borderRadius: 'var(--radius-sm)', outline: 'none',
                              boxShadow: '0 0 0 2px rgb(59 130 246 / 0.15)',
                              fontFamily: 'inherit',
                            }}
                          />
                          <button
                            onClick={() => guardarMinimo(item.stock_id)}
                            disabled={guardandoMin}
                            style={{
                              height: 28, padding: '0 8px', fontSize: 11,
                              background: 'var(--color-primary)', color: 'white',
                              border: 'none', borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                            }}
                          >
                            {guardandoMin ? '...' : 'OK'}
                          </button>
                          <button
                            onClick={() => setEditandoMinimo(null)}
                            style={{
                              height: 28, padding: '0 6px', fontSize: 12,
                              background: 'var(--color-bg)',
                              color: 'var(--color-text-muted)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditandoMinimo(item.stock_id)
                            setValorMinimo(item.stock_minimo)
                          }}
                          title="Clic para editar stock mínimo"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: item.stock_minimo > 0
                              ? 'var(--color-text-primary)'
                              : 'var(--color-text-muted)',
                            fontFamily: 'inherit', fontSize: 13,
                            padding: '2px 6px', borderRadius: 4,
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            textDecoration: 'underline dotted var(--color-border)',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          {item.stock_minimo > 0
                            ? item.stock_minimo.toLocaleString('es-CO')
                            : '—'
                          }
                          <Pencil size={10} style={{ opacity: 0.35 }} />
                        </button>
                      )
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)' }}>
                        {item.stock_minimo > 0
                          ? item.stock_minimo.toLocaleString('es-CO')
                          : '—'
                        }
                      </span>
                    )}
                  </td>

                  {/* Costo promedio */}
                  <td style={{ textAlign: 'right' }}>{fmtCOP(item.costo_promedio)}</td>

                  {/* Valor total */}
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {fmtCOP(item.stock_actual * item.costo_promedio)}
                  </td>

                  {/* Alerta */}
                  <td style={{ textAlign: 'center' }}>
                    {item.alerta === 1
                      ? <span className="badge badge-warning">
                          <AlertTriangle size={10} /> SÍ
                        </span>
                      : <span className="badge badge-success">NO</span>
                    }
                  </td>

                  {/* Última entrada */}
                  <td className="td-secondary">
                    {item.ultima_entrada
                      ? new Date(item.ultima_entrada + 'T00:00:00').toLocaleDateString('es-CO')
                      : '—'}
                  </td>

                  {/* Última salida */}
                  <td className="td-secondary">
                    {item.ultima_salida
                      ? new Date(item.ultima_salida + 'T00:00:00').toLocaleDateString('es-CO')
                      : '—'}
                  </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
          <Pagination {...pag} />
        </div>
      )}
    </MainLayout>
  )
}