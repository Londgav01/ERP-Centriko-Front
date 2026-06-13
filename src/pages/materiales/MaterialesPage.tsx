import { useState, useEffect } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { Plus, Pencil, Package, Loader2, AlertCircle, Search, Download, CheckCircle } from 'lucide-react'
import {
  PageHeader, FilterBar, SelectFiltro, DataTable, FormModal, RowActions,
} from '../../components/ui'
import type { Columna } from '../../components/ui'
import { useListado } from '../../hooks/useListado'
import { useFormModal } from '../../hooks/useFormModal'
import { useDebounce } from '../../hooks/useDebounce'
import { fmtCOP, fmtMiles } from '../../utils/formato'
import { getApiError } from '../../utils/errores'
import type { Material } from '../../types'
import * as XLSX from 'xlsx'
import './MaterialesPage.css'

/** Unidades de medida disponibles para el catálogo de materiales. */
const UNIDADES = ['UN', 'ML', 'M2', 'M3', 'KG', 'TON', 'GL', 'LT', 'BOLSA', 'ROLLO', 'JUEGO', 'OTROS']

/** Formulario vacío para crear/editar un material. */
const EMPTY_FORM = {
  codigo: '', nombre: '', descripcion: '', unidad: 'UN',
  categoria: '', precio_ref: 0, activo: true,
}

/** Fila parseada del Excel de importación masiva. */
interface PreviewItem {
  tipo: string
  nombre: string
  unidad: string
  precio_ref: number
  categoria: string | null
}

/**
 * Página maestra de Materiales: búsqueda con debounce, filtros por
 * categoría y estado, formulario en modal e importación masiva desde Excel.
 */
export default function MaterialesPage() {
  const { toast } = useToast()

  const { setLista, cargando: buscando, pag, cargar } =
    useListado<Material>('/api/materiales')

  const [busqueda,        setBusqueda]        = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroActivo,    setFiltroActivo]    = useState('')
  const [hasBuscado,      setHasBuscado]      = useState(false)
  const [categoriasOpts,  setCategoriasOpts]  = useState<string[]>([])

  const fm = useFormModal(EMPTY_FORM)
  /** Vista formateada (separador de miles) del precio de referencia. */
  const [precioView, setPrecioView] = useState('')

  // Importación Excel
  const [showImport,   setShowImport]   = useState(false)
  const [preview,      setPreview]      = useState<PreviewItem[]>([])
  const [importando,   setImportando]   = useState(false)
  const [resultImport, setResultImport] = useState<{ insertados: number; omitidos: number } | null>(null)

  /** Carga el catálogo de categorías activas de tipo MATERIAL (una vez). */
  useEffect(() => {
    api.get('/api/categorias?tipo=MATERIAL&activo=1')
      .then(res => {
        setCategoriasOpts(res.data.data.map((c: { nombre: string }) => c.nombre))
      })
      .catch(() => setCategoriasOpts([]))
  }, [])

  /**
   * Carga la lista de materiales. Los filtros llegan como PARÁMETROS
   * directos (patrón cargarLista del proyecto).
   *
   * @param activo - '' | '1' | '0'
   * @param q - Texto de búsqueda (basta 1 carácter para activar la carga)
   * @param cat - Categoría seleccionada
   * @param forzar - Fuerza la carga aunque no haya criterio (filtro de estado)
   */
  const cargarLista = async (activo = filtroActivo, q = busqueda, cat = filtroCategoria, forzar = false) => {
    const activarBusqueda = forzar || q.length >= 1 || !!cat || activo !== ''
    if (!activarBusqueda) { setLista([]); setHasBuscado(false); return }

    setHasBuscado(true)
    await cargar({ activo, q, categoria: cat })
  }

  /** Búsqueda con debounce de 350 ms; pasa el texto nuevo como parámetro. */
  const buscarDebounced = useDebounce((q: string) => {
    cargarLista(filtroActivo, q, filtroCategoria)
  }, 350)

  const handleBusqueda = (q: string) => {
    setBusqueda(q)
    buscarDebounced(q)
  }

  /**
   * Lee el archivo Excel y arma la vista previa de importación.
   * Busca la hoja MATERIALES y descarta encabezados y filas sin datos.
   */
  const leerExcel = (e: ChangeEvent<HTMLInputElement>) => {
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
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]

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
          tipo: String(row[0] || ''),
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

  /** Envía la vista previa al endpoint de importación masiva. */
  const ejecutarImport = async () => {
    if (!preview.length) return
    setImportando(true)
    try {
      const res = await api.post('/api/materiales/importar-bulk', { items: preview })
      setResultImport(res.data.data)
      toast.success(`Importación completada: ${res.data.data.insertados} insertados`)
      if (res.data.data.insertados > 0) cargarLista()
    } catch (err) {
      toast.error(getApiError(err, 'Error en la importación'))
    } finally { setImportando(false) }
  }

  /** Abre el modal en modo creación con el formulario limpio. */
  const abrirNuevo = () => {
    setPrecioView('')
    fm.abrirNuevo()
  }

  /** Abre el modal en modo edición con los datos del material. */
  const abrirEditar = (m: Material) => {
    setPrecioView(m.precio_ref ? fmtMiles(m.precio_ref) : '')
    fm.abrirEditar(m.material_id, {
      codigo: m.codigo, nombre: m.nombre, descripcion: m.descripcion || '',
      unidad: m.unidad, categoria: m.categoria || '',
      precio_ref: m.precio_ref ?? 0, activo: m.activo === 1,
    })
  }

  /** Mantiene el precio numérico en el form y su vista con separador de miles. */
  const handlePrecioChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '')
    const num = raw ? Number(raw) : 0
    fm.set('precio_ref', num)
    setPrecioView(raw ? fmtMiles(num) : '')
  }

  /** Crea o actualiza el material y recarga la lista con los filtros vigentes. */
  const guardar = async (ev: FormEvent) => {
    ev.preventDefault()
    const ok = await fm.guardar(
      async () => {
        if (fm.editId) await api.put(`/api/materiales/${fm.editId}`, fm.form)
        else           await api.post('/api/materiales', fm.form)
      },
      { exito: fm.editId ? 'Material actualizado correctamente' : 'Material creado correctamente' }
    )
    if (ok) cargarLista()
  }

  /** Columnas de la tabla (mismo orden y clases que la versión anterior). */
  const columnas: Columna<Material>[] = [
    { header: 'ID', className: 'td-id', render: m => m.material_id },
    { header: 'Código', render: m => <span className="font-mono font-mono-strong">{m.codigo}</span> },
    { header: 'Nombre', className: 'td-bold', render: m => m.nombre },
    { header: 'Descripción', className: 'td-secondary td-ellipsis', render: m => m.descripcion || '—' },
    { header: 'Unidad', render: m => <span className="badge badge-neutral">{m.unidad}</span> },
    { header: 'Categoría', className: 'td-muted', render: m => m.categoria || '—' },
    { header: 'Precio ref.', className: 'td-strong', render: m => fmtCOP(m.precio_ref ?? 0) },
    {
      header: 'Estado',
      render: m => (
        <span className={`badge ${m.activo ? 'badge-success' : 'badge-danger'}`}>
          {m.activo ? 'ACTIVO' : 'INACTIVO'}
        </span>
      ),
    },
    {
      header: 'Acciones',
      render: m => (
        <RowActions acciones={[
          { label: 'Editar', icon: <Pencil size={13} />, onClick: () => abrirEditar(m) },
        ]} />
      ),
    },
  ]

  return (
    <MainLayout>
      <PageHeader
        title="Materiales"
        subtitle="Catálogo de insumos del sistema"
        actions={
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
        }
      />

      {/* Barra de búsqueda y filtros */}
      <FilterBar>
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

        <SelectFiltro
          className="form-select--w180"
          value={filtroCategoria}
          onChange={v => { setFiltroCategoria(v); cargarLista(filtroActivo, busqueda, v) }}
          placeholder="Todas las categorías"
          options={categoriasOpts.map(c => ({ value: c, label: c }))}
          ariaLabel="Filtrar por categoría"
        />

        <SelectFiltro
          className="form-select--w140"
          value={filtroActivo}
          onChange={v => { setFiltroActivo(v); cargarLista(v, busqueda, filtroCategoria, true) }}
          placeholder="Todos"
          options={[
            { value: '1', label: 'Activos' },
            { value: '0', label: 'Inactivos' },
          ]}
          ariaLabel="Filtrar por estado"
        />
      </FilterBar>

      {/* Tabla / estados */}
      <DataTable
        columns={columnas}
        pag={pag}
        rowKey={m => m.material_id}
        cargando={buscando}
        cargandoTexto="Buscando materiales..."
        cargandoSize={18}
        emptyIcon={Package}
        emptyText={!hasBuscado
          ? 'Escribe al menos 3 caracteres o aplica un filtro para ver materiales'
          : 'No se encontraron materiales con ese criterio'}
      />

      {/* Modal crear/editar */}
      <FormModal
        open={fm.show}
        title={fm.editId ? `Editar — ${fm.editId}` : 'Nuevo material'}
        onClose={fm.cerrar}
        onSubmit={guardar}
        className="modal-lg"
        error={fm.error}
        cargando={fm.cargando}
        submitLabel={fm.editId ? 'Guardar cambios' : 'Crear material'}
      >
        {/* Código + Nombre */}
        <div className="form-grid-3 form-section-gap">
          <div className="form-group">
            <label className="form-label required" htmlFor="mat-codigo">Código</label>
            <input
              id="mat-codigo"
              className="form-input font-mono"
              value={fm.form.codigo}
              onChange={e => fm.set('codigo', e.target.value.toUpperCase())}
              required placeholder="Ej: CEM-GR"
            />
            <span className="form-hint">Único en el catálogo</span>
          </div>
          <div className="form-group col-span-2">
            <label className="form-label required" htmlFor="mat-nombre">Nombre</label>
            <input
              id="mat-nombre"
              className="form-input"
              value={fm.form.nombre}
              onChange={e => fm.set('nombre', e.target.value)}
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
            value={fm.form.descripcion}
            onChange={e => fm.set('descripcion', e.target.value)}
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
              value={fm.form.unidad}
              onChange={e => fm.set('unidad', e.target.value)}
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
              value={fm.form.categoria}
              onChange={e => fm.set('categoria', e.target.value)}
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
              className={`toggle ${fm.form.activo ? 'on' : 'off'}`}
              onClick={() => fm.set('activo', !fm.form.activo)}
              aria-label={fm.form.activo ? 'Desactivar material' : 'Activar material'}
            />
            <span className="toggle-label">
              {fm.form.activo ? 'Material activo — disponible en requisiciones' : 'Material inactivo — no aparece en requisiciones'}
            </span>
          </div>
        </div>
      </FormModal>

      {/* Modal importación */}
      <FormModal
        open={showImport}
        title="Importar materiales desde Excel"
        onClose={() => setShowImport(false)}
        className="modal-lg"
        footer={
          <>
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
          </>
        }
      >
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
      </FormModal>
    </MainLayout>
  )
}
