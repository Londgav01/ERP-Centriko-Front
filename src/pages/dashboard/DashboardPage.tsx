import { useEffect, useState } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign,
  AlertTriangle, CheckCircle2, Loader2, RefreshCw
} from 'lucide-react'

interface Capitulo {
  capitulo_id: string; codigo: string; nombre_capitulo: string
  valor_presupuestado: number; valor_comprometido: number
  valor_ejecutado: number; avance_fisico_pct: number
  pct_gasto: number; desviacion_pct: number
  nombre_edificio: string; nombre_proyecto: string
  edificio_id: string; proyecto_id: string; estado: string
}

interface Proyecto    { proyecto_id: string; nombre: string }
interface Edificacion { edificio_id: string; nombre: string; proyecto_id: string }

const fmtCOP = (v: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(v || 0)

const fmtCOPCorto = (v: number) => {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000)     return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)         return `$${(v / 1_000).toFixed(0)}K`
  return fmtCOP(v)
}

export default function DashboardPage() {
  const [capitulos,     setCapitulos]     = useState<Capitulo[]>([])
  const [proyectos,     setProyectos]     = useState<Proyecto[]>([])
  const [edificaciones, setEdificaciones] = useState<Edificacion[]>([])
  const [edifFiltradas, setEdifFiltradas] = useState<Edificacion[]>([])

  const [filtroProyecto, setFiltroProyecto] = useState('')
  const [filtroEdificio, setFiltroEdificio] = useState('')
  const [cargando,       setCargando]       = useState(true)

  const cargar = async (proy = filtroProyecto, edif = filtroEdificio) => {
    setCargando(true)
    try {
      const params = new URLSearchParams()
      if (proy) params.append('proyecto_id', proy)
      if (edif) params.append('edificio_id', edif)
      const res = await api.get(`/api/tablero?${params}`)
      setCapitulos(res.data.data)
    } finally { setCargando(false) }
  }

  useEffect(() => {
    Promise.all([
      api.get('/api/tablero'),
      api.get('/api/proyectos'),
      api.get('/api/edificaciones'),
    ]).then(([rT, rP, rE]) => {
      setCapitulos(rT.data.data)
      setProyectos(rP.data.data)
      setEdificaciones(rE.data.data)
    }).finally(() => setCargando(false))
  }, [])

  const handleProyecto = (proyId: string) => {
    setFiltroProyecto(proyId)
    setFiltroEdificio('')
    setEdifFiltradas(edificaciones.filter(e => e.proyecto_id === proyId))
    cargar(proyId, '')
  }

  const handleEdificio = (edifId: string) => {
    setFiltroEdificio(edifId)
    cargar(filtroProyecto, edifId)
  }

  // KPIs globales
  const totalPresupuestado = capitulos.reduce((s, c) => s + c.valor_presupuestado, 0)
  const totalComprometido  = capitulos.reduce((s, c) => s + c.valor_comprometido, 0)
  const totalEjecutado     = capitulos.reduce((s, c) => s + c.valor_ejecutado, 0)
  const avancePromedio     = capitulos.length > 0
    ? capitulos.reduce((s, c) => s + c.avance_fisico_pct, 0) / capitulos.length : 0
  const enRiesgo           = capitulos.filter(c => c.desviacion_pct > 5).length
  const pctEjecutado       = totalPresupuestado > 0
    ? (totalEjecutado / totalPresupuestado) * 100 : 0

  // Datos para gráfica de barras (top 8 capítulos por presupuesto)
  const datosGrafica = [...capitulos]
    .sort((a, b) => b.valor_presupuestado - a.valor_presupuestado)
    .slice(0, 8)
    .map(c => ({
      name: c.codigo || c.nombre_capitulo.slice(0, 12),
      Presupuestado: c.valor_presupuestado,
      Comprometido:  c.valor_comprometido,
      Ejecutado:     c.valor_ejecutado,
    }))

  const colorDesviacion = (des: number) => {
    if (des > 10) return 'var(--color-danger)'
    if (des > 5)  return 'var(--color-warning)'
    if (des < -5) return 'var(--color-info)'
    return 'var(--color-success)'
  }

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tablero de Control</h1>
          <p className="page-subtitle">Presupuestado vs Comprometido vs Ejecutado por capítulo</p>
        </div>
        <button className="btn btn-secondary" onClick={() => cargar()}>
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="page-filters" style={{ marginBottom: 24 }}>
        <select className="form-select" value={filtroProyecto}
          onChange={e => handleProyecto(e.target.value)}
          aria-label="Filtrar por proyecto" style={{ width: 260 }}>
          <option value="">Todos los proyectos</option>
          {proyectos.map(p => (
            <option key={p.proyecto_id} value={p.proyecto_id}>
              {p.proyecto_id} — {p.nombre}
            </option>
          ))}
        </select>

        <select className="form-select" value={filtroEdificio}
          onChange={e => handleEdificio(e.target.value)}
          disabled={!filtroProyecto}
          aria-label="Filtrar por edificación" style={{ width: 220 }}>
          <option value="">Todas las edificaciones</option>
          {edifFiltradas.map(e => (
            <option key={e.edificio_id} value={e.edificio_id}>{e.nombre}</option>
          ))}
        </select>
      </div>

      {cargando ? (
        <div className="page-loading">
          <Loader2 size={24} className="spinner" /><span>Cargando tablero...</span>
        </div>
      ) : (
        <>
          {/* ── KPIs ─────────────────────────────────────── */}
          <div className="kpi-grid" style={{ marginBottom: 28 }}>
            <div className="kpi-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DollarSign size={16} style={{ color: 'var(--color-primary)' }} />
                </div>
                <span className="kpi-label">Total presupuestado</span>
              </div>
              <div className="kpi-value" style={{ fontSize: 18 }}>{fmtCOP(totalPresupuestado)}</div>
              <div className="kpi-delta" style={{ marginTop: 4 }}>
                <span className="td-muted">{capitulos.length} capítulos</span>
              </div>
            </div>

            <div className="kpi-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={16} style={{ color: 'var(--color-info)' }} />
                </div>
                <span className="kpi-label">Comprometido</span>
              </div>
              <div className="kpi-value" style={{ fontSize: 18, color: 'var(--color-info)' }}>
                {fmtCOP(totalComprometido)}
              </div>
              <div className="kpi-delta" style={{ marginTop: 4 }}>
                <span className="td-muted">
                  {totalPresupuestado > 0
                    ? `${((totalComprometido / totalPresupuestado) * 100).toFixed(1)}% del presupuesto`
                    : '—'}
                </span>
              </div>
            </div>

            <div className="kpi-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />
                </div>
                <span className="kpi-label">Ejecutado</span>
              </div>
              <div className="kpi-value" style={{ fontSize: 18, color: 'var(--color-success)' }}>
                {fmtCOP(totalEjecutado)}
              </div>
              <div className="kpi-delta" style={{ marginTop: 4 }}>
                <span className="td-muted">
                  {totalPresupuestado > 0
                    ? `${pctEjecutado.toFixed(1)}% del presupuesto`
                    : '—'}
                </span>
              </div>
            </div>

            <div className="kpi-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8,
                  background: avancePromedio > 0 ? 'var(--color-primary-light)' : 'var(--color-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={16} style={{ color: 'var(--color-primary)' }} />
                </div>
                <span className="kpi-label">Avance físico prom.</span>
              </div>
              <div className="kpi-value" style={{ fontSize: 24, color: 'var(--color-primary)' }}>
                {avancePromedio.toFixed(1)}%
              </div>
              <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(avancePromedio, 100)}%`, background: 'var(--color-primary)', borderRadius: 3 }} />
              </div>
            </div>

            <div className="kpi-card" style={{
              borderLeft: enRiesgo > 0 ? '3px solid var(--color-danger)' : undefined
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={16} style={{ color: 'var(--color-danger)' }} />
                </div>
                <span className="kpi-label">Capítulos en riesgo</span>
              </div>
              <div className="kpi-value" style={{ color: enRiesgo > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                {enRiesgo}
              </div>
              <div className="kpi-delta" style={{ marginTop: 4 }}>
                <span className="td-muted">Gasto {'>'} avance físico en {'>'} 5%</span>
              </div>
            </div>
          </div>

          {/* ── Gráfica de barras ─────────────────────────── */}
          {datosGrafica.length > 0 && (
            <div style={{
              background: 'white', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)', padding: '20px 24px',
              marginBottom: 28, boxShadow: 'var(--shadow-sm)'
            }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 20 }}>
                Comparativo por capítulo
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 8 }}>
                  (top {datosGrafica.length} por presupuesto)
                </span>
              </h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={datosGrafica} margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tickFormatter={fmtCOPCorto} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(value: number) => fmtCOP(value)}
                    contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Presupuestado" fill="#e2e8f0" radius={[3,3,0,0]} />
                  <Bar dataKey="Comprometido"  fill="#0284c7" radius={[3,3,0,0]} />
                  <Bar dataKey="Ejecutado"     fill="#16a34a" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Tabla de capítulos ────────────────────────── */}
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Capítulo</th>
                  <th>Proyecto / Edificación</th>
                  <th style={{ textAlign: 'right' }}>Presupuestado</th>
                  <th style={{ textAlign: 'right' }}>Comprometido</th>
                  <th style={{ textAlign: 'right' }}>Ejecutado</th>
                  <th style={{ textAlign: 'center', width: 140 }}>Avance físico</th>
                  <th style={{ textAlign: 'center', width: 130 }}>Gasto vs avance</th>
                  <th style={{ textAlign: 'center' }}>Alerta</th>
                </tr>
              </thead>
              <tbody>
                {capitulos.length === 0 ? (
                  <tr><td colSpan={8}>
                    <div className="search-empty-state">
                      <TrendingUp size={32} style={{ color: 'var(--color-text-muted)' }} />
                      <span>No hay capítulos registrados</span>
                    </div>
                  </td></tr>
                ) : capitulos.map(cap => {
                  const enRiesgoRow = cap.desviacion_pct > 5
                  const rowBg = enRiesgoRow ? 'rgba(220,38,38,0.03)' : undefined

                  return (
                    <tr key={cap.capitulo_id} style={{ background: rowBg }}>
                      {/* Capítulo */}
                      <td>
                        <span className="font-mono" style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: 12 }}>
                          {cap.codigo}
                        </span>
                        <span className="td-bold" style={{ display: 'block' }}>
                          {cap.nombre_capitulo}
                        </span>
                      </td>

                      {/* Proyecto / Edificación */}
                      <td>
                        <span className="td-bold" style={{ fontSize: 12 }}>{cap.nombre_proyecto}</span>
                        <span className="td-muted" style={{ display: 'block' }}>{cap.nombre_edificio}</span>
                      </td>

                      {/* Presupuestado */}
                      <td style={{ textAlign: 'right' }}>
                        {fmtCOP(cap.valor_presupuestado)}
                      </td>

                      {/* Comprometido con barra */}
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ color: 'var(--color-info)', fontWeight: 600 }}>
                          {fmtCOP(cap.valor_comprometido)}
                        </span>
                        {cap.valor_presupuestado > 0 && (
                          <div style={{ height: 3, background: '#e2e8f0', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 2,
                              width: `${Math.min((cap.valor_comprometido / cap.valor_presupuestado) * 100, 100)}%`,
                              background: 'var(--color-info)',
                            }} />
                          </div>
                        )}
                      </td>

                      {/* Ejecutado con barra */}
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                          {fmtCOP(cap.valor_ejecutado)}
                        </span>
                        {cap.valor_presupuestado > 0 && (
                          <div style={{ height: 3, background: '#e2e8f0', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 2,
                              width: `${Math.min((cap.valor_ejecutado / cap.valor_presupuestado) * 100, 100)}%`,
                              background: 'var(--color-success)',
                            }} />
                          </div>
                        )}
                      </td>

                      {/* Avance físico */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 3,
                              width: `${Math.min(cap.avance_fisico_pct, 100)}%`,
                              background: enRiesgoRow ? 'var(--color-danger)' : 'var(--color-primary)',
                            }} />
                          </div>
                          <span style={{
                            fontSize: 12, fontWeight: 600, minWidth: 36,
                            color: enRiesgoRow ? 'var(--color-danger)' : 'var(--color-text-primary)'
                          }}>
                            {cap.avance_fisico_pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {/* Desviación gasto vs avance */}
                      <td style={{ textAlign: 'center' }}>
                        {cap.avance_fisico_pct > 0 || cap.pct_gasto > 0 ? (
                          <div>
                            <div style={{
                              fontSize: 12, fontWeight: 700,
                              color: colorDesviacion(cap.desviacion_pct)
                            }}>
                              {cap.desviacion_pct > 0 ? '+' : ''}{cap.desviacion_pct.toFixed(1)}%
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
                              Gasto: {cap.pct_gasto.toFixed(1)}%
                            </div>
                          </div>
                        ) : (
                          <span className="td-muted">—</span>
                        )}
                      </td>

                      {/* Alerta */}
                      <td style={{ textAlign: 'center' }}>
                        {enRiesgoRow ? (
                          <span className="badge badge-danger">
                            <AlertTriangle size={10} /> RIESGO
                          </span>
                        ) : cap.avance_fisico_pct >= 100 ? (
                          <span className="badge badge-success">
                            <CheckCircle2 size={10} /> COMPLETO
                          </span>
                        ) : cap.valor_ejecutado > 0 ? (
                          <span className="badge badge-info">EN CURSO</span>
                        ) : (
                          <span className="badge badge-neutral">SIN INICIO</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Leyenda */}
          {capitulos.length > 0 && (
            <div style={{
              marginTop: 16, padding: '10px 16px',
              background: 'var(--color-bg)', borderRadius: 'var(--radius-md)',
              display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12,
              color: 'var(--color-text-muted)'
            }}>
              <span><strong style={{ color: 'var(--color-danger)' }}>RIESGO</strong> — Gasto {'>'} avance físico en más de 5%</span>
              <span><strong style={{ color: 'var(--color-warning)' }}>+%</strong> — Desviación positiva: se gasta más de lo que avanza</span>
              <span><strong style={{ color: 'var(--color-info)' }}>-%</strong> — Desviación negativa: avanza más de lo que se gasta</span>
            </div>
          )}
        </>
      )}
    </MainLayout>
  )
}