import { useEffect, useState } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  TrendingUp, TrendingDown, DollarSign,
  AlertTriangle, CheckCircle2, Loader2,
  RefreshCw, BarChart3, Activity
} from 'lucide-react'

interface Capitulo {
  capitulo_id: string; codigo: string; nombre_capitulo: string
  valor_presupuestado: number; valor_comprometido: number
  valor_ejecutado: number; saldo_presupuestal: number
  avance_fisico_pct: number; avance_economico_pct: number
  desviacion_pct: number; indice_eficiencia: number
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

// Color semáforo según índice eficiencia
const colorEficiencia = (idx: number) => {
  if (idx === 0)    return 'var(--color-text-muted)'
  if (idx >= 1.1)   return 'var(--color-success)'
  if (idx >= 0.9)   return 'var(--color-info)'
  if (idx >= 0.75)  return 'var(--color-warning)'
  return 'var(--color-danger)'
}

const labelEficiencia = (idx: number) => {
  if (idx === 0)   return '—'
  if (idx >= 1.1)  return 'Eficiente'
  if (idx >= 0.9)  return 'Normal'
  if (idx >= 0.75) return 'Atención'
  return 'Riesgo'
}

const badgeEficiencia = (idx: number) => {
  if (idx === 0)   return 'badge-neutral'
  if (idx >= 1.1)  return 'badge-success'
  if (idx >= 0.9)  return 'badge-info'
  if (idx >= 0.75) return 'badge-warning'
  return 'badge-danger'
}

export default function DashboardPage() {
  const [capitulos,      setCapitulos]     = useState<Capitulo[]>([])
  const [proyectos,      setProyectos]     = useState<Proyecto[]>([])
  const [edificaciones,  setEdificaciones] = useState<Edificacion[]>([])
  const [edifFiltradas,  setEdifFiltradas] = useState<Edificacion[]>([])
  const [filtroProyecto, setFiltroProyecto]= useState('')
  const [filtroEdificio, setFiltroEdificio]= useState('')
  const [cargando,       setCargando]      = useState(true)
  const [vistaGrafica,   setVistaGrafica]  = useState<'barras' | 'comparativo'>('comparativo')

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

  // ── KPIs globales ──────────────────────────────────────────
  const totalPresupuestado  = capitulos.reduce((s, c) => s + c.valor_presupuestado, 0)
  const totalComprometido   = capitulos.reduce((s, c) => s + c.valor_comprometido, 0)
  const totalEjecutado      = capitulos.reduce((s, c) => s + c.valor_ejecutado, 0)
  const totalSaldo          = capitulos.reduce((s, c) => s + c.saldo_presupuestal, 0)

  const avanceFisicoPromedio    = capitulos.length > 0
    ? capitulos.reduce((s, c) => s + c.avance_fisico_pct, 0) / capitulos.length : 0
  const avanceEconomicoPromedio = capitulos.length > 0
    ? capitulos.reduce((s, c) => s + c.avance_economico_pct, 0) / capitulos.length : 0

  const eficienciaGlobal = avanceEconomicoPromedio > 0
    ? avanceFisicoPromedio / avanceEconomicoPromedio : 0

  const enRiesgo    = capitulos.filter(c => c.desviacion_pct > 5).length
  const eficientes  = capitulos.filter(c => c.indice_eficiencia >= 1.1).length
  const sinInicio   = capitulos.filter(c => c.avance_fisico_pct === 0 && c.valor_ejecutado === 0).length

  // ── Datos para gráficas ────────────────────────────────────
  const datosComparativo = [...capitulos]
    .filter(c => c.avance_fisico_pct > 0 || c.avance_economico_pct > 0)
    .sort((a, b) => b.avance_economico_pct - a.avance_economico_pct)
    .slice(0, 10)
    .map(c => ({
      name:       c.codigo || c.nombre_capitulo.slice(0, 10),
      'Av. Físico':    Math.round(c.avance_fisico_pct * 10) / 10,
      'Av. Económico': Math.round(c.avance_economico_pct * 10) / 10,
    }))

  const datosBarras = [...capitulos]
    .sort((a, b) => b.valor_presupuestado - a.valor_presupuestado)
    .slice(0, 8)
    .map(c => ({
      name:          c.codigo || c.nombre_capitulo.slice(0, 12),
      Presupuestado: c.valor_presupuestado,
      Comprometido:  c.valor_comprometido,
      Ejecutado:     c.valor_ejecutado,
    }))

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tablero de Control</h1>
          <p className="page-subtitle">Avance físico vs económico por capítulo</p>
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
          onChange={e => { setFiltroEdificio(e.target.value); cargar(filtroProyecto, e.target.value) }}
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
          {/* ── KPIs financieros ─────────────────────────── */}
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <div className="kpi-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DollarSign size={16} style={{ color: 'var(--color-primary)' }} />
                </div>
                <span className="kpi-label">Total presupuestado</span>
              </div>
              <div className="kpi-value" style={{ fontSize: 16 }}>{fmtCOP(totalPresupuestado)}</div>
              <div className="kpi-delta td-muted" style={{ marginTop: 4 }}>
                {capitulos.length} capítulos
              </div>
            </div>

            <div className="kpi-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-info-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={16} style={{ color: 'var(--color-info)' }} />
                </div>
                <span className="kpi-label">Comprometido</span>
              </div>
              <div className="kpi-value" style={{ fontSize: 16, color: 'var(--color-info)' }}>
                {fmtCOP(totalComprometido)}
              </div>
              <div className="kpi-delta" style={{ marginTop: 4 }}>
                <span className="td-muted">
                  {totalPresupuestado > 0 ? `${((totalComprometido / totalPresupuestado) * 100).toFixed(1)}% del presupuesto` : '—'}
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
              <div className="kpi-value" style={{ fontSize: 16, color: 'var(--color-success)' }}>
                {fmtCOP(totalEjecutado)}
              </div>
              <div className="kpi-delta" style={{ marginTop: 4 }}>
                <span className="td-muted">
                  {totalPresupuestado > 0 ? `${((totalEjecutado / totalPresupuestado) * 100).toFixed(1)}% del presupuesto` : '—'}
                </span>
              </div>
            </div>

            <div className="kpi-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DollarSign size={16} style={{ color: 'var(--color-text-muted)' }} />
                </div>
                <span className="kpi-label">Saldo disponible</span>
              </div>
              <div className="kpi-value" style={{ fontSize: 16, color: totalSaldo >= 0 ? 'var(--color-text-primary)' : 'var(--color-danger)' }}>
                {fmtCOP(totalSaldo)}
              </div>
            </div>
          </div>

          {/* ── KPIs de avance ───────────────────────────── */}
          <div className="kpi-grid" style={{ marginBottom: 28, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>

            {/* Avance físico */}
            <div className="kpi-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Activity size={16} style={{ color: 'var(--color-primary)' }} />
                </div>
                <span className="kpi-label">Avance físico prom.</span>
              </div>
              <div className="kpi-value" style={{ fontSize: 24, color: 'var(--color-primary)' }}>
                {avanceFisicoPromedio.toFixed(1)}%
              </div>
              <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(avanceFisicoPromedio, 100)}%`, background: 'var(--color-primary)', borderRadius: 3 }} />
              </div>
              <div className="kpi-delta td-muted" style={{ marginTop: 4 }}>
                Cantidades ejecutadas / contratadas
              </div>
            </div>

            {/* Avance económico */}
            <div className="kpi-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart3 size={16} style={{ color: 'var(--color-warning)' }} />
                </div>
                <span className="kpi-label">Avance económico prom.</span>
              </div>
              <div className="kpi-value" style={{ fontSize: 24, color: 'var(--color-warning)' }}>
                {avanceEconomicoPromedio.toFixed(1)}%
              </div>
              <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(avanceEconomicoPromedio, 100)}%`, background: 'var(--color-warning)', borderRadius: 3 }} />
              </div>
              <div className="kpi-delta td-muted" style={{ marginTop: 4 }}>
                Ejecutado / presupuestado
              </div>
            </div>

            {/* Índice de eficiencia global */}
            <div className="kpi-card" style={{
              borderLeft: eficienciaGlobal > 0 && eficienciaGlobal < 0.9
                ? '3px solid var(--color-danger)'
                : eficienciaGlobal >= 1.1 ? '3px solid var(--color-success)' : undefined
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8,
                  background: eficienciaGlobal >= 1 ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {eficienciaGlobal >= 1
                    ? <TrendingUp size={16} style={{ color: 'var(--color-success)' }} />
                    : <TrendingDown size={16} style={{ color: 'var(--color-danger)' }} />
                  }
                </div>
                <span className="kpi-label">Índice de eficiencia</span>
              </div>
              <div className="kpi-value" style={{ fontSize: 24, color: colorEficiencia(eficienciaGlobal) }}>
                {eficienciaGlobal > 0 ? eficienciaGlobal.toFixed(2) : '—'}
              </div>
              <div style={{ marginTop: 6 }}>
                <span className={`badge ${badgeEficiencia(eficienciaGlobal)}`}>
                  {labelEficiencia(eficienciaGlobal)}
                </span>
              </div>
              <div className="kpi-delta td-muted" style={{ marginTop: 4 }}>
                Físico / económico · ideal ≥ 1.0
              </div>
            </div>

            {/* Alertas */}
            <div className="kpi-card" style={{ borderLeft: enRiesgo > 0 ? '3px solid var(--color-danger)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={16} style={{ color: 'var(--color-danger)' }} />
                </div>
                <span className="kpi-label">En riesgo</span>
              </div>
              <div className="kpi-value" style={{ color: enRiesgo > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                {enRiesgo}
              </div>
              <div className="kpi-delta" style={{ marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="badge badge-success" style={{ fontSize: 10 }}>
                  {eficientes} eficientes
                </span>
                <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                  {sinInicio} sin inicio
                </span>
              </div>
            </div>
          </div>

          {/* ── Selector de vista gráfica ─────────────────── */}
          {capitulos.some(c => c.avance_fisico_pct > 0 || c.valor_ejecutado > 0) && (
            <div style={{
              background: 'white', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)', padding: '20px 24px',
              marginBottom: 28, boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                  Análisis de avance
                </h2>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className={`btn btn-sm ${vistaGrafica === 'comparativo' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setVistaGrafica('comparativo')}>
                    Físico vs Económico
                  </button>
                  <button
                    className={`btn btn-sm ${vistaGrafica === 'barras' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setVistaGrafica('barras')}>
                    Financiero
                  </button>
                </div>
              </div>

              {vistaGrafica === 'comparativo' ? (
                <>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 2, background: '#1d4ed8' }} />
                      <span>Avance físico (cantidades)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 2, background: '#d97706' }} />
                      <span>Avance económico (presupuesto)</span>
                    </div>
                    <span className="td-muted">· Físico {'>'} Económico = Eficiente · Físico {'<'} Económico = Riesgo</span>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={datosComparativo} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip
                        formatter={(value: any, name: any) => [
                          typeof value === 'number' ? `${value}%` : value,
                          name
                        ]}
                        contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}
                      />
                      <Bar dataKey="Av. Físico"    fill="#1d4ed8" radius={[3,3,0,0]} />
                      <Bar dataKey="Av. Económico" fill="#d97706" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={datosBarras} margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tickFormatter={fmtCOPCorto} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      formatter={(value: any) => (typeof value === 'number' ? fmtCOP(value) : value)}
                      contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Presupuestado" fill="#e2e8f0" radius={[3,3,0,0]} />
                    <Bar dataKey="Comprometido"  fill="#0284c7" radius={[3,3,0,0]} />
                    <Bar dataKey="Ejecutado"     fill="#16a34a" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* ── Tabla de capítulos ────────────────────────── */}
          <div className="data-table-wrapper" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: 1000 }}>
              <thead>
                <tr>
                  <th>Capítulo</th>
                  <th>Proyecto / Edificación</th>
                  <th style={{ textAlign: 'right' }}>Presupuestado</th>
                  <th style={{ textAlign: 'right' }}>Ejecutado</th>
                  <th style={{ textAlign: 'center', width: 130 }}>Avance físico</th>
                  <th style={{ textAlign: 'center', width: 130 }}>Avance económico</th>
                  <th style={{ textAlign: 'center', width: 90 }}>Eficiencia</th>
                  <th style={{ textAlign: 'center', width: 90 }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {capitulos.length === 0 ? (
                  <tr><td colSpan={8}>
                    <div className="search-empty-state">
                      <BarChart3 size={32} style={{ color: 'var(--color-text-muted)' }} />
                      <span>No hay capítulos registrados</span>
                    </div>
                  </td></tr>
                ) : capitulos.map(cap => {
                  const enRiesgoRow = cap.desviacion_pct > 5

                  return (
                    <tr key={cap.capitulo_id}
                      style={{ background: enRiesgoRow ? 'rgba(220,38,38,0.03)' : undefined }}>

                      <td>
                        <span className="font-mono" style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 600 }}>
                          {cap.codigo}
                        </span>
                        <span className="td-bold" style={{ display: 'block' }}>{cap.nombre_capitulo}</span>
                      </td>

                      <td>
                        <span className="td-bold" style={{ fontSize: 12 }}>{cap.nombre_proyecto}</span>
                        <span className="td-muted" style={{ display: 'block' }}>{cap.nombre_edificio}</span>
                      </td>

                      <td style={{ textAlign: 'right' }}>{fmtCOP(cap.valor_presupuestado)}</td>

                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                          {fmtCOP(cap.valor_ejecutado)}
                        </span>
                        <span className="td-muted" style={{ display: 'block', fontSize: 11 }}>
                          Saldo: {fmtCOP(cap.saldo_presupuestal)}
                        </span>
                      </td>

                      {/* Avance físico */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 3,
                              width: `${Math.min(cap.avance_fisico_pct, 100)}%`,
                              background: 'var(--color-primary)',
                            }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, minWidth: 40, textAlign: 'right',
                            color: 'var(--color-primary)' }}>
                            {cap.avance_fisico_pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {/* Avance económico */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 3,
                              width: `${Math.min(cap.avance_economico_pct, 100)}%`,
                              background: enRiesgoRow ? 'var(--color-danger)' : 'var(--color-warning)',
                            }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, minWidth: 40, textAlign: 'right',
                            color: enRiesgoRow ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                            {cap.avance_economico_pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {/* Índice eficiencia */}
                      <td style={{ textAlign: 'center' }}>
                        {cap.indice_eficiencia > 0 ? (
                          <>
                            <div style={{ fontSize: 15, fontWeight: 700,
                              color: colorEficiencia(cap.indice_eficiencia) }}>
                              {cap.indice_eficiencia.toFixed(2)}
                            </div>
                            <span className={`badge ${badgeEficiencia(cap.indice_eficiencia)}`}
                              style={{ fontSize: 10 }}>
                              {labelEficiencia(cap.indice_eficiencia)}
                            </span>
                          </>
                        ) : (
                          <span className="td-muted">—</span>
                        )}
                      </td>

                      {/* Estado global */}
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
              marginTop: 16, padding: '12px 16px',
              background: 'var(--color-bg)', borderRadius: 'var(--radius-md)',
              display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12,
              color: 'var(--color-text-muted)'
            }}>
              <span>
                <strong style={{ color: colorEficiencia(1.5) }}>Eficiencia ≥ 1.10</strong>
                {' '}— avanza físicamente más de lo que se gasta
              </span>
              <span>
                <strong style={{ color: colorEficiencia(0.95) }}>0.90–1.10</strong>
                {' '}— avance físico y económico alineados
              </span>
              <span>
                <strong style={{ color: colorEficiencia(0.5) }}>{'< 0.90'}</strong>
                {' '}— gasto supera el avance físico — atención o riesgo
              </span>
            </div>
          )}
        </>
      )}
    </MainLayout>
  )
}