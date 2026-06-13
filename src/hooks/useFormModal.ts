import { useState } from 'react'
import { useToast } from '../context/ToastContext'
import { getApiError } from '../utils/errores'

// Estado del patrón formulario-en-modal repetido en las páginas:
// form + set(campo) + abrirNuevo/abrirEditar/cerrar + error + cargando,
// y un envoltorio `guardar` que maneja toast y mensaje de error de la API.
export function useFormModal<F extends object>(emptyForm: F) {
  const { toast } = useToast()

  const [show, setShow] = useState(false)
  const [form, setForm] = useState<F>(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const set = <K extends keyof F>(key: K, val: F[K]) =>
    setForm(s => ({ ...s, [key]: val }))

  const abrirNuevo = (inicial?: Partial<F>) => {
    setForm({ ...emptyForm, ...inicial })
    setEditId(null)
    setError('')
    setShow(true)
  }

  const abrirEditar = (id: string, valores: F) => {
    setForm(valores)
    setEditId(id)
    setError('')
    setShow(true)
  }

  const cerrar = () => setShow(false)

  // Ejecuta la operación de guardado (POST/PUT que decide la página).
  // Maneja cargando, toast de éxito/error y deja el mensaje en `error`.
  // Devuelve true si guardó, false si falló (la página decide recargar).
  const guardar = async (
    fn: () => Promise<void>,
    opts: { exito?: string; fallo?: string; cerrarAlGuardar?: boolean } = {}
  ): Promise<boolean> => {
    const { exito, fallo = 'Error al guardar', cerrarAlGuardar = true } = opts
    setCargando(true)
    setError('')
    try {
      await fn()
      if (exito) toast.success(exito)
      if (cerrarAlGuardar) setShow(false)
      return true
    } catch (err) {
      const msg = getApiError(err, fallo)
      setError(msg)
      toast.error(msg)
      return false
    } finally {
      setCargando(false)
    }
  }

  return {
    show, setShow,
    form, setForm, set,
    editId, setEditId,
    error, setError,
    cargando,
    abrirNuevo, abrirEditar, cerrar, guardar,
  }
}
