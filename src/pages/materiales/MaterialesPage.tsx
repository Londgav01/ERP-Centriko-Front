import { useState, useRef, useEffect } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { Plus, Pencil, Package, Loader2, AlertCircle, X, Search, Download, CheckCircle } from 'lucide-react'
import { usePagination } from '../../hooks/usePagination'
import Pagination from '../../components/ui/Pagination'
import * as XLSX from 'xlsx'
import './MaterialesPage.css'

const UNIDADES = ['UN', 'ML', 'M2', 'M3', 'KG', 'TON', 'GL', 'LT', 'BOLSA', 'ROLLO', 'JUEGO', 'OTROS']

interface Material {
  material_id: string; codigo: string; nombre: string
  descripcion: string; unidad: string; categoria: string
  precio_ref: number; activo: number
}

const EMPTY = {
  codigo: '', nombre: '', descripcion: '', unidad: 'UN',
  categoria: '', precio_ref: 0, activo: true
}

const fmtCOP = (v: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0
}).format(v || 0)

const fmtMiles = (v: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(v || 0)

export default function MaterialesPage() {
  const { toast } = useToast()

  const [materiales, setMateriales] = useState<Material[]>([])
  const pag = usePagination(materiales)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroActivo, setFiltroActivo] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [hasBuscado, setHasBuscado] = useState(false)

  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const [precioView, setPrecioView] = useState('')
  const [categoriasOpts, setCategoriasOpts] = useState<string[]>([])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [showImport, setShowImport] = useState(false)
  const [preview, setPreview] = useState<any[]>([])
  const [importando, setImportando] = useState(false)
  const [resultImport, setResultImport] = useState<{ insertados: number; omitidos: number } | null>(null)

  useEffect(() => {
    api.get('/api/categorias?tipo=MATERIAL&activo=1')
      .then(res => {
        setCategoriasOpts(res.data.data.map((c: any) => c.nombre))
      })
      .catch(() => setCategoriasOpts([]))
  }, [])

  const cargarLista = async (activo = filtroActivo, q = busqueda, cat = filtroCategoria, forzar = false) => {
    const activarBusqueda = forzar || q.length >= 1 || !!cat || activo !== ''
    if (!activarBusqueda) { setMateriales([]); setHasBuscado(false); return }

    setBuscando(true)
    setHasBuscado(true)
    try {
      const params = new URLSearchParams()
      if (activo !== '') params.append('activo', activo)
      if (q) params.append('q', q)
      if (cat) params.append('categoria', cat)
      const res = await api.get(`/api/materiales?${params}`)
      setMateriales(res.data.data)
      pag.reset()
    } finally { setBuscando(false) }
  }

  const leerExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer)
      const wb = XLSX.read(data, { type: 'array' })

      // Buscar hoja MATERIALES
      const sheetName = wb.SheetNames.find(n => n.toUpperCase() === 'MATERIALES')
      if (!sheetName) { toast.error('No se encontró la hoja MATERIALES en el Excel'); return }

      const ws = wb.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]

      // Filtrar filas válidas: tiene descripción y unidad
      const materiales = rows
        .filter(row =>
          row[1] && row[2] &&                              // tiene descripción y unidad
          typeof row[1] === 'string' &&
          row[1] !== 'DESCRIPCIÓN' &&                      // no es encabezado
          row[1] !== 'BASE DE DATOS DE MATERIALES' &&
          row[1] !== 'MASTER PACK COLOMBIA'
        )
        .map(row => ({
          tipo: row[0] || '',
          nombre: String(row[1]).trim(),
          unidad: String(row[2]).trim(),
          precio_ref: Number(row[3]) || 0,
          categoria: row[0] ? String(row[0]).trim() : null,
        }))
        .filter(m => m.nombre.length > 2)  // descartar filas muy cortas

      setPreview(materiales)
      setResultImport(null)
    }
    reader.readAsArrayBuffer(file)
  }


  const ejecutarImport = async () => {
    if (!preview.length) return
    setImportando(true)
    try {
      const res = await api.post('/api/materiales/importar-bulk', { items: preview })
      setResultImport(res.data.data)
      toast.success(`Importación completada: ${res.data.data.insertados} insertados`)
      if (res.data.data.insertados > 0) cargarLista()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error en la importación')
    } finally { setImportando(false) }
  }

  const handleBusqueda = (q: string) => {
    setBusqueda(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => cargarLista(filtroActivo, q, filtroCategoria), 350)
  }

  const set = (key: string, value: any) => setForm(s => ({ ...s, [key]: value }))

  const abrirNuevo = () => {
    setForm(EMPTY); setEditId(null); setError(''); setPrecioView(''); setShowForm(true)
  }

  const abrirEditar = (m: Material) => {
    setForm({
      codigo: m.codigo, nombre: m.nombre, descripcion: m.descripcion || '',
      unidad: m.unidad, categoria: m.categoria || '',
      precio_ref: m.precio_ref, activo: m.activo === 1
    })
    setEditId(m.material_id); setError(''); setPrecioView(m.precio_ref ? fmtMiles(m.precio_ref) : ''); setShowForm(true)
  }

  const handlePrecioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '')
    const num = raw ? Number(raw) : 0
    set('precio_ref', num)
    setPrecioView(raw ? fmtMiles(num) : '')
  }

  const guardar = async (ev: React.FormEvent) => {
    ev.preventDefault(); setCargando(true); setError('')
    try {
      if (editId) {
        await api.put(`/api/materiales/${editId}`, form)
        toast.success('Material actualizado correctamente')
      } else {
        await api.post('/api/materiales', form)
        toast.success('Material creado correctamente')
      }
      setShowForm(false)
      cargarLista()
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Error al guardar'
      setError(msg); toast.error(msg)
    } finally { setCargando(false) }
  }

  return (
    <MainLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Materiales</h1>
          <p className="page-subtitle">Catálogo de insumos del sistema</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => {
            setShowImport(true); setPreview([]); setResultImport(null)
          }}>
            <Download size={15} /> Importar Excel
          </button>
          <button className="btn btn-primary" onClick={abrirNuevo}>
            <Plus size={15} /> Nuevo material
          </button>
        </div>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="page-filters">
        <div className="search-bar">
          <Search size={14} />
          <input
            className="form-input"
            placeholder="Buscar por nombre, código... (mín. 3 caracteres)"
            value={busqueda}
            onChange={e => handleBusqueda(e.target.value)}
            aria-label="Buscar materiales"
          />
        </div>

        <select
          className="form-select form-select--w180"
          value={filtroCategoria}
          onChange={e => { setFiltroCategoria(e.target.value); cargarLista(filtroActivo, busqueda, e.target.value) }}
          aria-label="Filtrar por categoría"
        >
          <option value="">Todas las categorías</option>
          {categoriasOpts.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          className="form-select form-select--w140"
          value={filtroActivo}
          onChange={e => { const val = e.target.value; setFiltroActivo(val); cargarLista(val, busqueda, filtroCategoria, true) }}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos</option>
          <option value="1">Activos</option>
          <option value="0">Inactivos</option>
        </select>
      </div>

      {/* Tabla / estados */}
      <div className="data-table-wrapper">
        {buscando ? (
          <div className="page-loading">
            <Loader2 size={18} className="spinner" />
            <span>Buscando materiales...</span>
          </div>
        ) : !hasBuscado ? (
          <div className="search-empty-state">
            <Package size={32} style={{ color: 'var(--color-text-muted)' }} />
            <span>Escribe al menos 3 caracteres o aplica un filtro para ver materiales</span>
          </div>
        ) : materiales.length === 0 ? (
          <div className="search-empty-state">
            <Package size={32} style={{ color: 'var(--color-text-muted)' }} />
            <span>No se encontraron materiales con ese criterio</span>
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Unidad</th>
                  <th>Categoría</th>
                  <th>Precio ref.</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pag.itemsPagina.map(m => (
                  <tr key={m.material_id}>
                    <td className="td-id">{m.material_id}</td>
                    <td><span className="font-mono font-mono-strong">{m.codigo}</span></td>
                    <td className="td-bold">{m.nombre}</td>
                    <td className="td-secondary td-ellipsis">
                      {m.descripcion || '—'}
                    </td>
                    <td><span className="badge badge-neutral">{m.unidad}</span></td>
                    <td className="td-muted">{m.categoria || '—'}</td>
                    <td className="td-strong">{fmtCOP(m.precio_ref)}</td>
                    <td>
                      <span className={`badge ${m.activo ? 'badge-success' : 'badge-danger'}`}>
                        {m.activo ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(m)}>
                          <Pencil size={13} /> Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination {...pag} />
          </>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">
                {editId ? `Editar — ${editId}` : 'Nuevo material'}
              </span>
              <button className="btn btn-ghost btn-sm modal-close-button" onClick={() => setShowForm(false)}
                aria-label="Cerrar">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={guardar}>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-error">
                    <AlertCircle size={15} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Código + Nombre */}
                <div className="form-grid-3 form-section-gap">
                  <div className="form-group">
                    <label className="form-label required" htmlFor="mat-codigo">Código</label>
                    <input
                      id="mat-codigo"
                      className="form-input font-mono"
                      value={form.codigo}
                      onChange={e => set('codigo', e.target.value.toUpperCase())}
                      required placeholder="Ej: CEM-GR"
                    />
                    <span className="form-hint">Único en el catálogo</span>
                  </div>
                  <div className="form-group col-span-2">
                    <label className="form-label required" htmlFor="mat-nombre">Nombre</label>
                    <input
                      id="mat-nombre"
                      className="form-input"
                      value={form.nombre}
                      onChange={e => set('nombre', e.target.value)}
                      required placeholder="Ej: Cemento gris 50kg"
                    />
                  </div>
                </div>

                {/* Descripción */}
                <div className="form-group form-section-gap">
                  <label className="form-label" htmlFor="mat-desc">Descripción</label>
                  <textarea
                    id="mat-desc"
                    className="form-textarea"
                    value={form.descripcion}
                    onChange={e => set('descripcion', e.target.value)}
                    placeholder="Especificaciones técnicas del material"
                    rows={2}
                  />
                </div>

                {/* Unidad + Categoría + Precio */}
                <div className="form-grid-3 form-section-gap">
                  <div className="form-group">
                    <label className="form-label required" htmlFor="mat-unidad">Unidad de medida</label>
                    <select
                      id="mat-unidad"
                      className="form-select"
                      value={form.unidad}
                      onChange={e => set('unidad', e.target.value)}
                      required
                      aria-label="Unidad de medida"
                    >
                      {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="mat-cat">Categoría</label>
                    <select
                      id="mat-cat"
                      className="form-select"
                      value={form.categoria}
                      onChange={e => set('categoria', e.target.value)}
                      aria-label="Categoría del material"
                    >
                      <option value="">Sin categoría</option>
                      {categoriasOpts.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="mat-precio">Precio de referencia (COP)</label>
                    <input
                      id="mat-precio"
                      type="text"
                      inputMode="numeric"
                      className="form-input"
                      value={precioView}
                      onChange={handlePrecioChange}
                      placeholder="0"
                      title="Precio de referencia — solo formato visual"
                      aria-label="Precio de referencia (formato visual con separador de miles)"
                    />
                    <span className="form-hint">Referencia — el precio real viene de la OC</span>
                  </div>
                </div>

                {/* Activo */}
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <div className="toggle-wrap">
                    <button
                      type="button"
                      className={`toggle ${form.activo ? 'on' : 'off'}`}
                      onClick={() => set('activo', !form.activo)}
                      aria-label={form.activo ? 'Desactivar material' : 'Activar material'}
                    />
                    <span className="toggle-label">
                      {form.activo ? 'Material activo — disponible en requisiciones' : 'Material inactivo — no aparece en requisiciones'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={cargando}>
                  {cargando
                    ? <><Loader2 size={14} className="spinner" /> Guardando...</>
                    : editId ? 'Guardar cambios' : 'Crear material'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal importación */}
      {showImport && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowImport(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">Importar materiales desde Excel</span>
              <button type="button" className="btn btn-ghost btn-sm modal-close-button"
                onClick={() => setShowImport(false)} aria-label="Cerrar"><X size={16} /></button>
            </div>

            <div className="modal-body">
              <div className="alert alert-info mat-import-info">
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>
                  Selecciona un archivo Excel con una hoja llamada <strong>MATERIALES</strong>.
                  Columnas requeridas: <strong>DESCRIPCIÓN | UNIDAD | PRECIO UNITARIO</strong>
                </span>
              </div>

              <div className="form-group mat-import-file">
                <label className="form-label" htmlFor="mat-import-file">Archivo Excel (.xlsx)</label>
                <input id="mat-import-file" type="file" accept=".xlsx,.xls" className="form-input"
                  title="Seleccionar archivo Excel" onChange={leerExcel} />
              </div>

              {resultImport && (
                <div className={`alert mat-import-result ${resultImport.insertados > 0 ? 'alert-success' : 'alert-warning'}`}>
                  <CheckCircle size={15} style={{ flexShrink: 0 }} />
                  <span>
                    <strong>{resultImport.insertados}</strong> materiales importados ·{' '}
                    <strong>{resultImport.omitidos}</strong> omitidos (ya existían o sin datos)
                  </span>
                </div>
              )}

              {preview.length > 0 && !resultImport && (
                <>
                  <p className="form-hint mat-preview-header">
                    {preview.length} materiales encontrados — vista previa (primeros 10)
                  </p>
                  <div className="data-table-wrapper mat-preview-table">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Nombre</th>
                          <th className="mat-th-unidad">Unidad</th>
                          <th className="mat-th-precio">Precio ref.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.slice(0, 10).map((m, i) => (
                          <tr key={i}>
                            <td className="mat-td-nombre">{m.nombre}</td>
                            <td className="mat-td-unidad">
                              <span className="badge badge-neutral">{m.unidad}</span>
                            </td>
                            <td className="mat-td-precio">{fmtCOP(m.precio_ref)}</td>
                          </tr>
                        ))}
                        {preview.length > 10 && (
                          <tr>
                            <td colSpan={3} className="td-muted mat-td-more">
                              … y {preview.length - 10} materiales más
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowImport(false)}>
                Cerrar
              </button>
              {preview.length > 0 && !resultImport && (
                <button type="button" className="btn btn-primary" onClick={ejecutarImport} disabled={importando}>
                  {importando
                    ? <><Loader2 size={14} className="spinner" /> Importando {preview.length} materiales...</>
                    : <><Download size={14} /> Importar {preview.length} materiales</>
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  )
}