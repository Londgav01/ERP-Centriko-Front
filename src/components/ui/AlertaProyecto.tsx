import { useProyecto } from '../../context/ProyectoContext'
import { AlertTriangle } from 'lucide-react'
import './AlertaProyecto.css'

export default function AlertaProyecto() {
  const { proyecto } = useProyecto()
  if (proyecto) return null

  return (
    <div className="alerta-proyecto">
      <AlertTriangle size={15} className="alerta-proyecto-icon" />
      <span>
        <strong>Sin proyecto activo.</strong> Selecciona un proyecto en la barra superior
        para ver los datos correspondientes.
      </span>
    </div>
  )
}