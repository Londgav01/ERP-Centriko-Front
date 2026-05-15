import { useState, useEffect } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { exportarCSV } from '../../utils/exportarCSV'
import {
  Download, Loader2, FileText, BarChart3,
  Building2, Layers, TrendingUp, Calendar
} from 'lucide-react'

interface Proyecto    { proyecto_id: string; nombre: string }
interface Edificacion { edificio_id: string; nombre: string; proyecto_id: string }

type TipoReporte =
  | 'gastos-mes'
  | 'por-proyecto'
  | 'por-edificacion'
  | 'por-capitulo'
  | 'avances-obra'

const REPORTES: {
  id: TipoReporte; label: string; desc: string
  icon: React.ReactNode; colorBg: string; colorIcon: string
  filtroProy: boolean; filtroEdif: boolean; filtroFecha: boolean
}[] = [
  {
    id: 'gastos-mes', label: 'Gastos por mes',
    desc: 'Materiales y contratos agrupados por mes, proyecto y capítulo',
    icon: <Calendar size={20} />,
    colorBg: 'var(--color-info-bg)', colorIcon: 'var(--color-info)',
    filtroProy: true, filtroEdif: false, filtroFecha: true,
  },
  {
    id: 'por-proyecto', label: 'Por proyecto',
    desc: 'Consolidado de presupuesto, comprometido y ejecutado por proyecto',
    icon: <FileText size={20} />,
    colorBg: 'var(--color-primary-light)', colorIcon: 'var(--color-primary)',
    filtroProy: false, filtroEdif: false, filtroFecha: false,
  },
  {
    id: 'por-edificacion', label: 'Por edificación',
    desc: 'Avance económico y físico consolidado por edificación',
    icon: <Building2 size={20} />,
    colorBg: 'var(--color-success-bg)', colorIcon: 'var(--color-success)',
    filtroProy: true, filtroEdif: false, filtroFecha: false,
  },
  {
    id: 'por-capitulo', label: 'Por capítulo',
    desc: 'Detalle completo por capítulo con índice de eficiencia y alertas',
    icon: <Layers size={20} />,
    colorBg: 'var(--color-warning-bg)', colorIcon: 'var(--color-warning)',
    filtroProy: true, filtroEdif: true, filtroFecha: false,
  },
  {
    id: 'avances-obra', label: 'Avances de obra',
    desc: 'Historial de actas de avance con avance físico y económico',
    icon: <TrendingUp size={20} />,
    colorBg: '#fdf2f8', colorIcon: '#9333ea',
    filtroProy: true, filtroEdif: false, filtroFecha: true,
  },
]

const fmtCOP = (v: any) => {
  const n = Number(v)
  if (isNaN(n)) return v
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
  }).format(n)
}

const COLS_MONEDA = new Set([
  'Presupuestado','Comprometido','Ejecutado','Saldo',
  'Gasto Materiales','Gasto Contratos','Total Gasto',
  'Valor Acta','Valor Retención','Amortización Anticipo','Neto a Pagar',
])

export default function ReportesPage() {
  const { toast } = useToast()

  const [proyectos,    setProyectos]    = useState<Proyecto[]>([])
  const [edificaciones,setEdificaciones]= useState<Edificacion[]>([])
  const [edifFilt,     setEdifFilt]     = useState<Edificacion[]>([])

  const [tipoSel,     setTipoSel]     = useState<TipoReporte | null>(null)
  const [proyectoId,  setProyectoId]  = useState('')
  const [edificioId,  setEdificioId]  = useState('')
  const [desde,       setDesde]       = useState('')
  const [hasta,       setHasta]       = useState('')

  const [datos,     setDatos]     = useState<any[]>([])
  const [columnas,  setColumnas]  = useState<string[]>([])
  const [cargando,  setCargando]  = useState(false)
  const [, setCargandoInit] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/api/proyectos'),
      api.get('/api/edificaciones'),
    ]).then(([rP, rE]) => {
      setProyectos(rP.data.data)
      setEdificaciones(rE.data.data)
    }).finally(() => setCargandoInit(false))
  }, [])

  const reporteActual = REPORTES.find(r => r.id === tipoSel)

  const handleProyecto = (proyId: string) => {
    setProyectoId(proyId)
    setEdificioId('')
    setEdifFilt(edificaciones.filter(e => e.proyecto_id === proyId))
    setDatos([]); setColumnas([])
  }

  const generarReporte = async () => {
    if (!tipoSel) return
    setCargando(true); setDatos([]); setColumnas([])
    try {
      const params = new URLSearchParams()
      if (proyectoId) params.append('proyecto_id', proyectoId)
      if (edificioId) params.append('edificio_id', edificioId)
      if (desde)      params.append('desde', desde)
      if (hasta)      params.append('hasta', hasta)

      const res = await api.get(`/api/reportes/${tipoSel}?${params}`)
      const rows = res.data.data

      if (!rows.length) {
        toast.warning('No hay datos con los filtros seleccionados')
        return
      }

      setDatos(rows)
      setColumnas(Object.keys(rows[0]))
      toast.success(`${rows.length} registros cargados`)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al generar el reporte')
    } finally { setCargando(false) }
  }

  const descargar = () => {
    if (!datos.length || !tipoSel) return
    const nombre = `reporte_${tipoSel}`
    exportarCSV(datos, nombre)
    toast.success('CSV descargado correctamente')
  }

  const seleccionarTipo = (id: TipoReporte) => {
    setTipoSel(id); setDatos([]); setColumnas([])
    setProyectoId(''); setEdificioId('')
    setDesde(''); setHasta('')
    setEdifFilt([])
  }

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reportes</h1>
          <p className="page-subtitle">Genera y descarga reportes en formato CSV</p>
        </div>
        {datos.length > 0 && (
          <button className="btn btn-primary" onClick={descargar}>
            <Download size={15} /> Descargar CSV
          </button>
        )}
      </div>

      {/* Selector de tipo de reporte */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 12, marginBottom: 28
      }}>
        {REPORTES.map(r => (
          <button
            key={r.id}
            onClick={() => seleccionarTipo(r.id)}
            style={{
              background: tipoSel === r.id ? r.colorBg : 'white',
              border: `2px solid ${tipoSel === r.id ? r.colorIcon : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-lg)', padding: '16px',
              cursor: 'pointer', textAlign: 'left',
              transition: 'all var(--transition)',
              boxShadow: tipoSel === r.id ? `0 0 0 3px ${r.colorBg}` : 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8,
                background: r.colorBg, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: r.colorIcon, flexShrink: 0 }}>
                {r.icon}
              </div>
              <span style={{ fontWeight: 600, fontSize: 13,
                color: tipoSel === r.id ? r.colorIcon : 'var(--color-text-primary)' }}>
                {r.label}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
              {r.desc}
            </p>
          </button>
        ))}
      </div>

      {/* Filtros del reporte seleccionado */}
      {reporteActual && (
        <div style={{
          background: 'white', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', padding: '20px 24px',
          marginBottom: 24, boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6,
              background: reporteActual.colorBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: reporteActual.colorIcon }}>
              <BarChart3 size={14} />
            </div>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              Configurar: {reporteActual.label}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* Filtro proyecto */}
            {reporteActual.filtroProy && (
              <div className="form-group" style={{ margin: 0, minWidth: 240 }}>
                <label className="form-label">Proyecto</label>
                <select className="form-select" value={proyectoId}
                  onChange={e => handleProyecto(e.target.value)}
                  aria-label="Filtrar por proyecto">
                  <option value="">Todos los proyectos</option>
                  {proyectos.map(p => (
                    <option key={p.proyecto_id} value={p.proyecto_id}>
                      {p.proyecto_id} — {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Filtro edificación */}
            {reporteActual.filtroEdif && (
              <div className="form-group" style={{ margin: 0, minWidth: 200 }}>
                <label className="form-label">Edificación</label>
                <select className="form-select" value={edificioId}
                  onChange={e => setEdificioId(e.target.value)}
                  disabled={!proyectoId}
                  aria-label="Filtrar por edificación">
                  <option value="">Todas</option>
                  {edifFilt.map(e => (
                    <option key={e.edificio_id} value={e.edificio_id}>{e.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Filtro fechas */}
            {reporteActual.filtroFecha && (
              <>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Desde</label>
                  <input type="date" className="form-input" value={desde}
                    onChange={e => setDesde(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Hasta</label>
                  <input type="date" className="form-input" value={hasta}
                    onChange={e => setHasta(e.target.value)} />
                </div>
              </>
            )}

            {/* Botón generar */}
            <button className="btn btn-primary" onClick={generarReporte}
              disabled={cargando} style={{ alignSelf: 'flex-end' }}>
              {cargando
                ? <><Loader2 size={14} className="spinner" /> Generando...</>
                : <><BarChart3 size={14} /> Generar reporte</>
              }
            </button>
          </div>
        </div>
      )}

      {/* Vista previa */}
      {datos.length > 0 && (
        <>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 12
          }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                Vista previa — {datos.length} registros
              </span>
              <span className="td-muted" style={{ marginLeft: 8, fontSize: 12 }}>
                (primeras 50 filas)
              </span>
            </div>
            <button className="btn btn-primary btn-sm" onClick={descargar}>
              <Download size={13} /> Descargar CSV completo
            </button>
          </div>

          <div className="data-table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: columnas.length * 130 }}>
              <thead>
                <tr>
                  {columnas.map(col => (
                    <th key={col} style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datos.slice(0, 50).map((row, idx) => (
                  <tr key={idx}>
                    {columnas.map(col => {
                      const val = row[col]
                      const esMonto = COLS_MONEDA.has(col)
                      const esPct   = String(col).includes('%')

                      return (
                        <td key={col} style={{
                          whiteSpace: 'nowrap', fontSize: 12,
                          textAlign: (esMonto || esPct) ? 'right' : undefined,
                          fontWeight: esMonto ? 600 : undefined,
                          color: col === 'Alerta' && val === 'RIESGO'
                            ? 'var(--color-danger)'
                            : col === 'Alerta' && val === 'COMPLETO'
                            ? 'var(--color-success)'
                            : undefined,
                        }}>
                          {esMonto ? fmtCOP(val)
                            : val === null || val === undefined ? '—'
                            : String(val)
                          }
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {datos.length > 50 && (
            <div style={{
              textAlign: 'center', padding: '12px',
              color: 'var(--color-text-muted)', fontSize: 12,
              borderTop: '1px solid var(--color-border)'
            }}>
              Mostrando 50 de {datos.length} registros — descarga el CSV para ver todos
            </div>
          )}
        </>
      )}

      {/* Estado vacío */}
      {!tipoSel && (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          color: 'var(--color-text-muted)'
        }}>
          <BarChart3 size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ fontSize: 14, margin: 0 }}>
            Selecciona un tipo de reporte para comenzar
          </p>
        </div>
      )}
    </MainLayout>
  )
}