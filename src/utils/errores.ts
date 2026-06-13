// Extrae el mensaje de error del formato { ok, error } que devuelve la API.
// Reemplaza el patrón repetido: err.response?.data?.error || 'Error...'
export function getApiError(err: unknown, fallback = 'Error'): string {
  const e = err as { response?: { data?: { error?: string } } } | undefined
  return e?.response?.data?.error || fallback
}
