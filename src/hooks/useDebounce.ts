import { useCallback, useEffect, useRef } from 'react'

// Devuelve una versión debounced de fn (350 ms por defecto, como las
// búsquedas existentes). Reemplaza el patrón manual repetido:
//   const ref = useRef(...); clearTimeout(ref.current); ref.current = setTimeout(...)
export function useDebounce<A extends unknown[]>(fn: (...args: A) => void, ms = 350) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  return useCallback((...args: A) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fnRef.current(...args), ms)
  }, [ms])
}
