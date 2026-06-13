import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { useProyecto } from '../../context/ProyectoContext'
import { Plus, Pencil, Building2 } from 'lucide-react'
import {
  PageHeader, DataTable, FormModal, RowActions, EstadoBadge, LoadingState, AlertaProyecto,
} from '../../components/ui'
import type { Columna } from '../../components/ui'
import { usePagination } from '../../hooks/usePagination'
import { useFormModal } from '../../hooks/useFormModal'
import type { Proyecto, Edificacion } from '../../types'
import './EdificacionesPage.css'

/**
 * Formulario vacío para crear/editar una edificación.
 * area_m2 y pisos se manejan como string en el form (inputs numéricos
 * opcionales) y se convierten a número/null en el payload.
 */
const EMPTY_FORM = {
  proyecto_id: '', nombre: '', descripcion: '',
  area_m2: '', pisos: '', estado: 'ACTIVO', notas: '',
}

/**
 * Página maestra de Edificaciones: la lista depende del proyecto activo
 * de ProyectoContext (se recarga al cambiarlo) y el formulario va en modal.
 */
export default function EdificacionesPage() {
  const { proyecto } = useProyecto()

  const [edificaciones,  setEdificaciones]  = useState<Edificacion[]>([])
  const pag = usePagination(edificaciones)
  const [proyectos,      setProyectos]      = useState<Proyecto[]>([])
  const [cargandoPagina, setCargandoPagina] = useState(true)

  const fm = useFormModal(EMPTY_FORM)

  /** Carga el catálogo de proyectos para el select del modal. */
  const cargarProyectos = async () => {
    const res = await api.get('/api/proyectos')
    setProyectos(res.data.data)
  }

  /**
   * Carga las edificaciones. El proyecto llega como PARÁMETRO directo
   * (patrón cargarLista del proyecto).
   *
   * @param proyectoId - Filtro por proyecto ('' = todas)
   */
  const cargarEdificaciones = async (proyectoId = proyecto?.proyecto_id || '') => {
    const params = proyectoId ? `?proyecto_id=${proyectoId}` : ''
    const res = await api.get(`/api/edificaciones${params}`)
    setEdificaciones(res.data.data)
    pag.reset()
    setCargandoPagina(false)
  }

  useEffect(() => {
    cargarProyectos()
    cargarEdificaciones()
  }, [])

  /** Recarga al cambiar el proyecto activo (o limpia si se deselecciona). */
  useEffect(() => {
    if (proyecto?.proyecto_id) {
      cargarEdificaciones(proyecto.proyecto_id)
    } else {
      setEdificaciones([])
      pag.reset()
      setCargandoPagina(false)
    }
  }, [proyecto?.proyecto_id])

  /** Abre el modal en modo creación con el formulario limpio. */
  const abrirNuevo = () => fm.abrirNuevo()

  /** Abre el modal en modo edición (el proyecto no se puede cambiar). */
  const abrirEditar = (e: Edificacion) => {
    fm.abrirEditar(e.edificio_id, {
      proyecto_id: e.proyecto_id, nombre: e.nombre,
      descripcion: e.descripcion || '', area_m2: e.area_m2 ? String(e.area_m2) : '',
      pisos: e.pisos ? String(e.pisos) : '', estado: e.estado || 'ACTIVO', notas: e.notas || '',
    })
  }

  /** Crea o actualiza la edificación (área/pisos a número o null) y recarga. */
  const guardar = async (ev: FormEvent) => {
    ev.preventDefault()
    const ok = await fm.guardar(
      async () => {
        const payload = {
          ...fm.form,
          area_m2: fm.form.area_m2 ? Number(fm.form.area_m2) : null,
          pisos: fm.form.pisos ? Number(fm.form.pisos) : null,
        }
        if (fm.editId) await api.put(`/api/edificaciones/${fm.editId}`, payload)
        else           await api.post('/api/edificaciones', payload)
      },
      { exito: fm.editId ? 'Edificación actualizada correctamente' : 'Edificación creada correctamente' }
    )
    if (ok) cargarEdificaciones(proyecto?.proyecto_id || '')
  }

  /** Columnas de la tabla (mismo orden y clases que la versión anterior). */
  const columnas: Columna<Edificacion>[] = [
    { header: 'ID', render: e => <span className="font-mono td-id">{e.edificio_id}</span> },
    {
      header: 'Proyecto',
      className: 'td-project',
      render: e => (
        <>
          <span className="font-mono">{e.proyecto_id}</span>
          <span className="td-project-name">{e.nombre_proyecto}</span>
        </>
      ),
    },
    { header: 'Nombre', className: 'td-name', render: e => e.nombre },
    { header: 'Descripción', className: 'td-desc', render: e => e.descripcion || '—' },
    { header: 'Área m²', className: 'td-muted', render: e => e.area_m2 ? `${e.area_m2} m²` : '—' },
    { header: 'Pisos', className: 'td-muted', render: e => e.pisos || '—' },
    { header: 'Estado', render: e => <EstadoBadge estado={e.estado || ''} tipo="proyecto" /> },
    {
      header: 'Acciones',
      render: e => (
        <RowActions acciones={[
          { label: 'Editar', icon: <Pencil size={13} />, onClick: () => abrirEditar(e) },
        ]} />
      ),
    },
  ]

  return (
    <MainLayout>
      <AlertaProyecto />
      <PageHeader
        title="Edificaciones"
        subtitle={`${edificaciones.length} edificación${edificaciones.length !== 1 ? 'es' : ''} registrada${edificaciones.length !== 1 ? 's' : ''}`}
        actions={
          <button className="btn btn-primary" onClick={abrirNuevo}>
            <Plus size={15} /> Nueva edificación
          </button>
        }
      />

      {/* Tabla (loading fuera del wrapper, como la versión original) */}
      {cargandoPagina ? (
        <LoadingState texto="Cargando edificaciones..." />
      ) : (
        <DataTable
          columns={columnas}
          pag={pag}
          rowKey={e => e.edificio_id}
          emptyIcon={Building2}
          emptyText="No hay edificaciones registradas"
          emptyEnFila
        />
      )}

      {/* Modal crear/editar */}
      <FormModal
        open={fm.show}
        title={fm.editId ? `Editar — ${fm.editId}` : 'Nueva edificación'}
        onClose={fm.cerrar}
        onSubmit={guardar}
        className="modal-lg"
        error={fm.error}
        cargando={fm.cargando}
        submitLabel={fm.editId ? 'Guardar cambios' : 'Crear edificación'}
      >
        {/* Proyecto */}
        <div className="form-group form-section-gap">
          <label className="form-label required" htmlFor="edificacion-proyecto">Proyecto</label>
          <select id="edificacion-proyecto" className="form-select" value={fm.form.proyecto_id}
            onChange={e => fm.set('proyecto_id', e.target.value)}
            required disabled={!!fm.editId} title="Selecciona el proyecto" aria-label="Proyecto">
            <option value="">Selecciona un proyecto...</option>
            {proyectos.map(p => (
              <option key={p.proyecto_id} value={p.proyecto_id}>
                {p.proyecto_id} — {p.nombre}
              </option>
            ))}
          </select>
          {fm.editId && <span className="form-hint">El proyecto no se puede cambiar después de creada</span>}
        </div>

        {/* Nombre */}
        <div className="form-group form-section-gap">
          <label className="form-label required" htmlFor="edificacion-nombre">Nombre de la edificación</label>
          <input id="edificacion-nombre" className="form-input" value={fm.form.nombre}
            onChange={e => fm.set('nombre', e.target.value)}
            required placeholder="Ej: Torre A, Bloque 1, Casa Modelo" />
        </div>

        {/* Descripción */}
        <div className="form-group form-section-gap">
          <label className="form-label" htmlFor="edificacion-descripcion">Descripción</label>
          <textarea id="edificacion-descripcion" className="form-textarea" value={fm.form.descripcion}
            onChange={e => fm.set('descripcion', e.target.value)}
            placeholder="Descripción general de la edificación" rows={2} />
        </div>

        {/* Área + Pisos + Estado */}
        <div className="form-grid-3 form-section-gap">
          <div className="form-group">
            <label className="form-label">Área construida (m²)</label>
            <input type="number" className="form-input" value={fm.form.area_m2}
              onChange={e => fm.set('area_m2', e.target.value)}
              min={0} step="0.01" placeholder="0.00" />
          </div>
          <div className="form-group">
            <label className="form-label">Número de pisos</label>
            <input type="number" className="form-input" value={fm.form.pisos}
              onChange={e => fm.set('pisos', e.target.value)}
              min={1} placeholder="0" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="edificacion-estado">Estado</label>
            <select id="edificacion-estado" title="Estado de la edificación" className="form-select" value={fm.form.estado}
              onChange={e => fm.set('estado', e.target.value)}>
              <option value="ACTIVO">ACTIVO</option>
              <option value="SUSPENDIDO">SUSPENDIDO</option>
              <option value="TERMINADO">TERMINADO</option>
            </select>
          </div>
        </div>

        {/* Notas */}
        <div className="form-group form-section-top-gap">
          <label className="form-label" htmlFor="edificacion-notas">Notas</label>
          <textarea id="edificacion-notas" className="form-textarea" value={fm.form.notas}
            onChange={e => fm.set('notas', e.target.value)}
            placeholder="Observaciones adicionales" rows={2} />
        </div>
      </FormModal>
    </MainLayout>
  )
}
