import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import MainLayout from '../../components/layout/MainLayout'
import { api } from '../../lib/api'
import { Plus, Pencil, Building2 } from 'lucide-react'
import {
  PageHeader, DataTable, FormModal, RowActions, EstadoBadge, LoadingState,
} from '../../components/ui'
import type { Columna } from '../../components/ui'
import { usePagination } from '../../hooks/usePagination'
import { useFormModal } from '../../hooks/useFormModal'
import { fmtCOP, fmtMiles, fmtFecha } from '../../utils/formato'
import type { Proyecto } from '../../types'
import './ProyectosPage.css'

/** Formulario vacío para crear/editar un proyecto. */
const EMPTY_FORM = {
  nombre: '', ciudad: '', direccion: '',
  presupuesto_total: 0, fecha_inicio: '', fecha_fin_esperada: '',
  estado: 'ACTIVO', responsable: '', notas: '',
}

/**
 * Página maestra de Proyectos: tabla paginada y formulario en modal con
 * presupuesto formateado (separador de miles) y validación de fechas.
 */
export default function ProyectosPage() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const pag = usePagination(proyectos)
  const [cargandoPagina, setCargandoPagina] = useState(true)

  const fm = useFormModal(EMPTY_FORM)
  /** Vista formateada (separador de miles) del presupuesto total. */
  const [presupuestoView, setPresupuestoView] = useState('')

  /** Carga todos los proyectos. */
  const cargar = async () => {
    try {
      const res = await api.get('/api/proyectos')
      setProyectos(res.data.data)
      pag.reset()
    } finally { setCargandoPagina(false) }
  }

  useEffect(() => { cargar() }, [])

  /** Abre el modal en modo creación con el formulario limpio. */
  const abrirNuevo = () => {
    setPresupuestoView('')
    fm.abrirNuevo()
  }

  /** Abre el modal en modo edición con los datos del proyecto. */
  const abrirEditar = (p: Proyecto) => {
    setPresupuestoView(p.presupuesto_total ? fmtMiles(p.presupuesto_total) : '')
    fm.abrirEditar(p.proyecto_id, {
      nombre: p.nombre, ciudad: p.ciudad || '', direccion: p.direccion || '',
      presupuesto_total: p.presupuesto_total ?? 0, fecha_inicio: p.fecha_inicio || '',
      fecha_fin_esperada: p.fecha_fin_esperada || '', estado: p.estado || 'ACTIVO',
      responsable: p.responsable || '', notas: p.notas || '',
    })
  }

  /** Mantiene el presupuesto numérico en el form y su vista con separador de miles. */
  const onPresupuestoChange = (value: string) => {
    const soloDigitos = value.replace(/\D/g, '')
    if (!soloDigitos) {
      setPresupuestoView('')
      fm.set('presupuesto_total', 0)
      return
    }
    const numero = Number(soloDigitos)
    fm.set('presupuesto_total', numero)
    setPresupuestoView(fmtMiles(numero))
  }

  /**
   * Crea o actualiza el proyecto. Valida en cliente que la fecha de fin
   * no sea anterior a la de inicio (solo mensaje en el modal, sin toast).
   */
  const guardar = async (e: FormEvent) => {
    e.preventDefault()

    if (fm.form.fecha_inicio && fm.form.fecha_fin_esperada && fm.form.fecha_fin_esperada < fm.form.fecha_inicio) {
      fm.setError('La fecha de fin no puede ser anterior a la fecha de inicio')
      return
    }

    const ok = await fm.guardar(
      async () => {
        if (fm.editId) await api.put(`/api/proyectos/${fm.editId}`, fm.form)
        else           await api.post('/api/proyectos', fm.form)
      },
      { exito: fm.editId ? 'Proyecto actualizado correctamente' : 'Proyecto creado correctamente' }
    )
    if (ok) cargar()
  }

  /** Columnas de la tabla (mismo orden y clases que la versión anterior). */
  const columnas: Columna<Proyecto>[] = [
    { header: 'ID', render: p => <span className="font-mono projects-table-id">{p.proyecto_id}</span> },
    { header: 'Nombre', className: 'projects-table-name', render: p => p.nombre },
    { header: 'Ciudad', className: 'projects-table-muted', render: p => p.ciudad || '—' },
    { header: 'Responsable', className: 'projects-table-muted', render: p => p.responsable || '—' },
    { header: 'Presupuesto', className: 'projects-table-budget', render: p => fmtCOP(p.presupuesto_total ?? 0) },
    { header: 'Fecha inicio', className: 'projects-table-muted', render: p => fmtFecha(p.fecha_inicio) },
    { header: 'Estado', render: p => <EstadoBadge estado={p.estado || ''} tipo="proyecto" /> },
    {
      header: 'Acciones',
      render: p => (
        <RowActions acciones={[
          { label: 'Editar', icon: <Pencil size={13} />, onClick: () => abrirEditar(p) },
        ]} />
      ),
    },
  ]

  return (
    <MainLayout>
      <PageHeader
        title="Proyectos"
        subtitle={`${proyectos.length} proyecto${proyectos.length !== 1 ? 's' : ''} registrado${proyectos.length !== 1 ? 's' : ''}`}
        actions={
          <button className="btn btn-primary" onClick={abrirNuevo}>
            <Plus size={15} /> Nuevo proyecto
          </button>
        }
      />

      {/* Tabla (loading fuera del wrapper, como la versión original) */}
      {cargandoPagina ? (
        <LoadingState texto="Cargando proyectos..." />
      ) : (
        <DataTable
          columns={columnas}
          pag={pag}
          rowKey={p => p.proyecto_id}
          emptyIcon={Building2}
          emptyText="No hay proyectos registrados. Crea el primero."
          emptyEnFila
        />
      )}

      {/* Modal crear/editar */}
      <FormModal
        open={fm.show}
        title={fm.editId ? `Editar — ${fm.editId}` : 'Nuevo proyecto'}
        onClose={fm.cerrar}
        onSubmit={guardar}
        className="modal-lg"
        error={fm.error}
        cargando={fm.cargando}
        submitLabel={fm.editId ? 'Guardar cambios' : 'Crear proyecto'}
      >
        {/* Fila 1: Nombre (full) */}
        <div className="form-section-gap">
          <div className="form-group">
            <label className="form-label required" htmlFor="proyecto-nombre">Nombre del proyecto</label>
            <input className="form-input" value={fm.form.nombre}
              id="proyecto-nombre"
              onChange={e => fm.set('nombre', e.target.value)}
              required placeholder="Ej: Torre Residencial El Parque" />
          </div>
        </div>

        {/* Fila 2: Ciudad + Responsable */}
        <div className="form-grid-2 form-section-gap">
          <div className="form-group">
            <label className="form-label" htmlFor="proyecto-ciudad">Ciudad</label>
            <input className="form-input" value={fm.form.ciudad}
              id="proyecto-ciudad"
              onChange={e => fm.set('ciudad', e.target.value)}
              placeholder="Ej: Medellín" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="proyecto-responsable">Responsable</label>
            <input className="form-input" value={fm.form.responsable}
              id="proyecto-responsable"
              onChange={e => fm.set('responsable', e.target.value)}
              placeholder="Nombre del director de obra" />
          </div>
        </div>

        {/* Fila 3: Dirección (full) */}
        <div className="form-section-gap">
          <div className="form-group">
            <label className="form-label" htmlFor="proyecto-direccion">Dirección</label>
            <input className="form-input" value={fm.form.direccion}
              id="proyecto-direccion"
              onChange={e => fm.set('direccion', e.target.value)}
              placeholder="Ej: Cra 45 #80-23" />
          </div>
        </div>

        {/* Fila 4: Presupuesto + Fechas */}
        <div className="form-grid-3 form-section-gap">
          <div className="form-group">
            <label className="form-label required" htmlFor="proyecto-presupuesto">Presupuesto total (COP)</label>
            <input type="text" className="form-input" value={presupuestoView}
              id="proyecto-presupuesto"
              inputMode="numeric"
              onChange={e => onPresupuestoChange(e.target.value)}
              required min={0} placeholder="0" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="proyecto-fecha-inicio">Fecha inicio</label>
            <input type="date" className="form-input" value={fm.form.fecha_inicio}
              id="proyecto-fecha-inicio"
              onChange={e => fm.set('fecha_inicio', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="proyecto-fecha-fin">Fecha fin esperada</label>
            <input type="date" className="form-input" value={fm.form.fecha_fin_esperada}
              id="proyecto-fecha-fin"
              min={fm.form.fecha_inicio || undefined}
              onChange={e => fm.set('fecha_fin_esperada', e.target.value)} />
          </div>
        </div>

        {/* Fila 5: Estado + Notas */}
        <div className="form-grid-2 form-section-no-gap">
          <div className="form-group">
            <label className="form-label" htmlFor="proyecto-estado">Estado</label>
            <select className="form-select" value={fm.form.estado}
              id="proyecto-estado"
              title="Estado del proyecto"
              onChange={e => fm.set('estado', e.target.value)}>
              <option value="ACTIVO">ACTIVO</option>
              <option value="SUSPENDIDO">SUSPENDIDO</option>
              <option value="TERMINADO">TERMINADO</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="proyecto-notas">Notas</label>
            <textarea className="form-textarea" value={fm.form.notas}
              id="proyecto-notas"
              onChange={e => fm.set('notas', e.target.value)}
              placeholder="Observaciones generales del proyecto" rows={2} />
          </div>
        </div>
      </FormModal>
    </MainLayout>
  )
}
