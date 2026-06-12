import { useEffect, useRef, useCallback } from 'react'

const TIEMPO_ADVERTENCIA = 25 * 60 * 1000  // 25 minutos
const TIEMPO_LOGOUT      = 30 * 60 * 1000  // 30 minutos

interface UseInactividadProps {
  onAdvertencia: () => void
  onLogout:      () => void
  activo:        boolean  // solo cuando hay sesión activa
}

export function useInactividad({ onAdvertencia, onLogout, activo }: UseInactividadProps) {
  const timerAdvertencia = useRef<ReturnType<typeof setTimeout> | null>(null)
  const timerLogout      = useRef<ReturnType<typeof setTimeout> | null>(null)

  const limpiarTimers = useCallback(() => {
    if (timerAdvertencia.current) clearTimeout(timerAdvertencia.current)
    if (timerLogout.current)      clearTimeout(timerLogout.current)
  }, [])

  const reiniciarTimers = useCallback(() => {
    if (!activo) return
    limpiarTimers()

    timerAdvertencia.current = setTimeout(onAdvertencia, TIEMPO_ADVERTENCIA)
    timerLogout.current      = setTimeout(onLogout,      TIEMPO_LOGOUT)
  }, [activo, onAdvertencia, onLogout, limpiarTimers])

  useEffect(() => {
    if (!activo) { limpiarTimers(); return }

    const eventos = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    eventos.forEach(e => window.addEventListener(e, reiniciarTimers, { passive: true }))
    reiniciarTimers()

    return () => {
      eventos.forEach(e => window.removeEventListener(e, reiniciarTimers))
      limpiarTimers()
    }
  }, [activo, reiniciarTimers, limpiarTimers])
}