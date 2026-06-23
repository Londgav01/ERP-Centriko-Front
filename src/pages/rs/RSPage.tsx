import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useToast } from '../../context/ToastContext'
import { useProyecto } from '../../context/ProyectoContext'
import { Plus, FileText, AlertCircle, Check, Eye } from 'lucide-react'
import {
  PageHeader, FilterBar, SelectFiltro, DataTable, ConfirmModal, EstadoBadge,
  AlertaProyecto, LoadingState, RowActions,
} from '../../components/ui'
import type { Columna } from '../../components/ui'
import { useListado } from '../../hooks/useListado'
import { useFormModal } from '../../hooks/useFormModal'
import { useCascadaUbicacion } from '../../hooks/useCascadaUbicacion'
import { usePermisos } from '../../hooks/usePermisos'
import { fmtFecha } from '../../utils/formato'
import { getApiError } from '../../utils/errores'
import { ESTADOS_RS } from '../../lib/constantes'
import type { RS, RSDetalle, Proyecto, Edificacion, Capitulo, Material } from '../../types'
import RSFormModal, { EMPTY_RS_FORM } from './RSFormModal'
import type { RSForm, ItemRS, UltimoPrecio } from './RSFormModal'
import RSDetalleModal from './RSDetalleModal'
import './RSPage.css'

/**
 * Página de Requisiciones de Materiales (contenedor). Orquesta la lista
 * paginada, los catálogos para la cascada Proyecto → Edificación → Capítulo,
 * el modal de creación con ítems y el modal de detalle/aprobación.
 */
export default function RSPage() {
  const { toast } = useToast()
  const { proyecto } = useProyecto()
  const { es, esAlguno } = usePermisos()

  const { lista, setLista, pag, cargar } = useListado<RS>('/api/rs')
  const [cargandoPagina, setCargandoPagina] = useState(true)

  // Catálogos para la cascada del formulario
  const [proyectos,     setProyectos]     = useState<Proyecto[]>([])
  const [edificaciones, setEdificaciones] = useState<Edificacion[]>([])
  const [capitulos,     setCapitulos]     = useState<Capitulo[]>([])
  const cascada = useCascadaUbicacion(edificaciones, capitulos)

  const [filtroEstado,   setFiltroEstado]   = useState('')
  const [filtroProyecto, setFiltroProyecto] = useState('')

  // Formulario de nueva RS + sus ítems
  const fm = useFormModal<RSForm>(EMPTY_RS_FORM)
  const [items, setItems] = useState<ItemRS[]>([])
  const [ultimosPrecios, setUltimosPrecios] = useState<Record<string, UltimoPrecio>>({})

  // Modal detalle / aprobación
  const [showDetalle,   setShowDetalle]   = useState(false)
  const [rsDetalle,     setRsDetalle]     = useState<RS | null>(null)
  const [detalleItems,  setDetalleItems]  = useState<RSDetalle[]>([])
  const [cargandoDet,   setCargandoDet]   = useState(false)
  const [modoAprobar,   setModoAprobar]   = useState(false)
  const [cantAprobadas, setCantAprobadas] = useState<Record<string, number>>({})
  const [notasAprobar,  setNotasAprobar]  = useState('')
  const [procesando,    setProcesando]    = useState(false)

  // Confirmación de rechazo/anulación (reemplaza el confirm() nativo)
  const [confirmAccion, setConfirmAccion] = useState<{ rsId: string; accion: 'rechazar' | 'anular' } | null>(null)

  /** Carga inicial: requisiciones + catálogos en una sola tanda. */
  useEffect(() => {
    Promise.all([
      api.get('/api/rs'),
      api.get('/api/proyectos'),
      api.get('/api/edificaciones'),
      api.get('/api/capitulos'),
    ]).then(([rRS, rP, rE, rC]) => {
      setLista(rRS.data.data)
      setProyectos(rP.data.data)
      setEdificaciones(rE.data.data)
      setCapitulos(rC.data.data)
      pag.reset()
    }).finally(() => setCargandoPagina(false))
  }, [])

  /**
   * Recarga la lista. Los filtros llegan como PARÁMETROS directos
   * (patrón cargarLista del proyecto).
   *
   * @param estado - Estado de la requisición ('' = todos)
   * @param proyId - Proyecto ('' = todos)
   */
  const cargarLista = (estado = filtroEstado, proyId = filtroProyecto) =>
    cargar({ estado, proyecto_id: proyId })

  // ── Cascada Proyecto → Edificación → Capítulo ─────────────
  /** Cambia el proyecto del form y limpia edificación/capítulo. */
  const onProyecto = (proyId: string) => {
    fm.set('proyecto_id', proyId); fm.set('edificio_id', ''); fm.set('capitulo_id', '')
    cascada.alCambiarProyecto(proyId)
  }
  /** Cambia la edificación del form y limpia el capítulo. */
  const onEdificio = (edifId: string) => {
    fm.set('edificio_id', edifId); fm.set('capitulo_id', '')
    cascada.alCambiarEdificio(edifId)
  }

  /** Abre el modal de creación, precargando el proyecto activo si existe. */
  const abrirNuevo = () => {
    setItems([])
    cascada.reset()
    fm.abrirNuevo({ proyecto_id: proyecto?.proyecto_id || '' })
    if (proyecto?.proyecto_id) onProyecto(proyecto.proyecto_id)
  }

  // ── Ítems del formulario ──────────────────────────────────
  /** Agrega una fila de ítem vacía. */
  const agregarItem = () =>
    setItems(s => [...s, { material_id: '', nombre_material: '', unidad: '', cantidad_solicitada: 0, notas: '' }])

  /** Elimina la fila de ítem indicada. */
  const eliminarItem = (idx: number) => setItems(s => s.filter((_, i) => i !== idx))

  /** Actualiza un campo de un ítem. */
  const actualizarItem = (idx: number, key: keyof ItemRS, val: string | number) =>
    setItems(s => s.map((it, i) => (i === idx ? { ...it, [key]: val } : it)))

  /** Asigna el material a un ítem y carga su último precio (una sola vez). */
  const onSelectMaterial = (idx: number, mat: Material) => {
    setItems(s => s.map((it, i) =>
      i === idx ? { ...it, material_id: mat.material_id, nombre_material: mat.nombre, unidad: mat.unidad } : it
    ))
    if (!ultimosPrecios[mat.material_id]) {
      api.get(`/api/rs/ultimo-precio/${mat.material_id}`)
        .then(res => { if (res.data.data) setUltimosPrecios(s => ({ ...s, [mat.material_id]: res.data.data })) })
        .catch(() => {})
    }
  }

  /** Valida los ítems y crea la requisición. */
  const guardar = async (ev: FormEvent) => {
    ev.preventDefault()
    if (items.length === 0) { fm.setError('Debe agregar al menos un material'); return }
    for (const item of items) {
      if (!item.material_id) { fm.setError('Todos los ítems deben tener un material seleccionado'); return }
      if (!item.cantidad_solicitada || item.cantidad_solicitada <= 0) {
        fm.setError('Todos los ítems deben tener cantidad mayor a cero'); return
      }
    }
    const ok = await fm.guardar(
      async () => { await api.post('/api/rs', { ...fm.form, items }) },
      { exito: 'Requisición creada correctamente' }
    )
    if (ok) { setItems([]); cargarLista() }
  }

  // ── Detalle / aprobación ──────────────────────────────────
  /** Abre el modal de detalle (o de aprobación) de una requisición. */
  const verDetalle = async (rsId: string, aprobar = false) => {
    setCargandoDet(true); setShowDetalle(true)
    setModoAprobar(aprobar); setNotasAprobar('')
    try {
      const res = await api.get(`/api/rs/${rsId}`)
      const data = res.data.data
      setRsDetalle(data); setDetalleItems(data.detalle)
      const aprobadas: Record<string, number> = {}
      data.detalle.forEach((d: RSDetalle) => {
        aprobadas[d.det_id] = d.cantidad_aprobada ?? d.cantidad_solicitada
      })
      setCantAprobadas(aprobadas)
    } finally { setCargandoDet(false) }
  }

  /** Aprueba la requisición con las cantidades ajustadas. */
  const aprobar = async () => {
    setProcesando(true)
    try {
      const items_aprobados = detalleItems.map(d => ({
        det_id: d.det_id,
        cantidad_aprobada: cantAprobadas[d.det_id] ?? d.cantidad_solicitada,
      }))
      await api.put(`/api/rs/${rsDetalle?.rs_id}/aprobar`, { items_aprobados, notas: notasAprobar })
      toast.success('Requisición aprobada')
      setShowDetalle(false); cargarLista()
    } catch (err) {
      toast.error(getApiError(err, 'Error al aprobar'))
    } finally { setProcesando(false) }
  }

  /** Ejecuta el rechazo/anulación confirmado en el ConfirmModal. */
  const confirmarAccion = async () => {
    if (!confirmAccion) return
    setProcesando(true)
    try {
      await api.put(`/api/rs/${confirmAccion.rsId}/${confirmAccion.accion}`, {})
      toast.success(confirmAccion.accion === 'rechazar' ? 'Requisición rechazada' : 'Requisición anulada')
      setConfirmAccion(null); setShowDetalle(false); cargarLista()
    } catch (err) {
      toast.error(getApiError(err, 'Error'))
    } finally { setProcesando(false) }
  }

  const puedeCrear   = esAlguno('ADMIN', 'COORDINADOR', 'ING_RESIDENTE')
  const puedeAprobar = esAlguno('ADMIN', 'COORDINADOR')
  const soloLectura  = es('ALMACENISTA')

  /** Columnas de la tabla (mismo orden y clases que la versión anterior). */
  const columnas: Columna<RS>[] = [
    { header: 'RS ID', className: 'td-id', render: r => r.rs_id },
    {
      header: 'Proyecto / Capítulo',
      render: r => (
        <>
          <span className="td-bold">{r.nombre_proyecto}</span>
          <span className="td-muted rs-block-muted">{r.nombre_capitulo}</span>
        </>
      ),
    },
    { header: 'Solicitante', className: 'td-secondary', render: r => r.solicitante },
    { header: 'Prioridad', render: r => <EstadoBadge estado={r.prioridad} tipo="prioridad" /> },
    { header: 'Fecha', className: 'td-secondary', render: r => fmtFecha(r.fecha_solicitud) },
    { header: 'Estado', render: r => <EstadoBadge estado={r.estado} tipo="rs" /> },
    {
      header: 'Acciones',
      render: r => (
        <RowActions acciones={[
          { label: 'Ver', icon: <Eye size={13} />, onClick: () => verDetalle(r.rs_id) },
          {
            label: 'Aprobar', icon: <Check size={13} />, className: 'rs-success-action',
            visible: puedeAprobar && r.estado === 'BORRADOR',
            onClick: () => verDetalle(r.rs_id, true),
          },
        ]} />
      ),
    },
  ]

  return (
    <MainLayout>
      <AlertaProyecto />
      <PageHeader
        title="Requisiciones de Materiales"
        subtitle={`${lista.length} requisición${lista.length !== 1 ? 'es' : ''}`}
        actions={puedeCrear && (
          <button className="btn btn-primary" onClick={abrirNuevo}>
            <Plus size={15} /> Nueva requisición
          </button>
        )}
      />

      {soloLectura && (
        <div className="alert alert-info rs-readonly-alert">
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <span>Modo solo lectura — el almacenista puede consultar requisiciones pero no crearlas ni modificarlas</span>
        </div>
      )}

      <FilterBar>
        <SelectFiltro
          className="rs-filter-select--estado"
          value={filtroEstado}
          onChange={v => { setFiltroEstado(v); cargarLista(v, filtroProyecto) }}
          placeholder="Todos los estados"
          options={ESTADOS_RS.map(e => ({ value: e, label: e }))}
          ariaLabel="Filtrar por estado"
        />
        <SelectFiltro
          className="rs-filter-select--proyecto"
          value={filtroProyecto}
          onChange={v => { setFiltroProyecto(v); cargarLista(filtroEstado, v) }}
          placeholder="Todos los proyectos"
          options={proyectos.map(p => ({ value: p.proyecto_id, label: `${p.proyecto_id} — ${p.nombre}` }))}
          ariaLabel="Filtrar por proyecto"
        />
      </FilterBar>

      {cargandoPagina ? (
        <LoadingState texto="Cargando..." />
      ) : (
        <DataTable
          columns={columnas}
          pag={pag}
          rowKey={r => r.rs_id}
          emptyIcon={FileText}
          emptyText="No hay requisiciones registradas"
          emptyEnFila
        />
      )}

      <RSFormModal
        open={fm.show}
        onClose={fm.cerrar}
        onSubmit={guardar}
        error={fm.error}
        cargando={fm.cargando}
        form={fm.form}
        set={fm.set}
        proyectos={proyectos}
        edifFiltradas={cascada.edifFiltradas}
        capFiltrados={cascada.capFiltrados}
        onProyecto={onProyecto}
        onEdificio={onEdificio}
        items={items}
        agregarItem={agregarItem}
        eliminarItem={eliminarItem}
        actualizarItem={actualizarItem}
        onSelectMaterial={onSelectMaterial}
        ultimosPrecios={ultimosPrecios}
      />

      <RSDetalleModal
        open={showDetalle}
        onClose={() => setShowDetalle(false)}
        cargando={cargandoDet}
        rs={rsDetalle}
        items={detalleItems}
        modoAprobar={modoAprobar}
        cantAprobadas={cantAprobadas}
        setCantAprobada={(detId, val) => setCantAprobadas(s => ({ ...s, [detId]: val }))}
        notasAprobar={notasAprobar}
        setNotasAprobar={setNotasAprobar}
        onAprobar={aprobar}
        onRechazar={() => rsDetalle && setConfirmAccion({ rsId: rsDetalle.rs_id, accion: 'rechazar' })}
        onAnular={() => rsDetalle && setConfirmAccion({ rsId: rsDetalle.rs_id, accion: 'anular' })}
        procesando={procesando}
        puedeAprobar={puedeAprobar}
      />

      <ConfirmModal
        open={!!confirmAccion}
        titulo={confirmAccion?.accion === 'rechazar' ? 'Rechazar requisición' : 'Anular requisición'}
        mensaje={confirmAccion?.accion === 'rechazar' ? '¿Rechazar esta requisición?' : '¿Anular esta requisición?'}
        confirmLabel={confirmAccion?.accion === 'rechazar' ? 'Rechazar' : 'Anular'}
        peligro
        cargando={procesando}
        onConfirm={confirmarAccion}
        onCancel={() => setConfirmAccion(null)}
      />
    </MainLayout>
  )
}
