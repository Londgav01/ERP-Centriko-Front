import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

interface Props {
  visible:       boolean
  onContinuar:   () => void
  onCerrarSesion:() => void
}

export default function ModalInactividad({ visible, onContinuar, onCerrarSesion }: Props) {
  const [segundos, setSegundos] = useState(300) // 5 minutos de cuenta regresiva

  useEffect(() => {
    if (!visible) { setSegundos(300); return }

    const intervalo = setInterval(() => {
      setSegundos(s => {
        if (s <= 1) { clearInterval(intervalo); return 0 }
        return s - 1
      })
    }, 1000)

    return () => clearInterval(intervalo)
  }, [visible])

  if (!visible) return null

  const minutos = Math.floor(segundos / 60)
  const segs    = segundos % 60
  const tiempo  = `${minutos}:${String(segs).padStart(2, '0')}`

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'white', borderRadius: 'var(--radius-xl)',
        padding: '32px', maxWidth: 400, width: '90%',
        boxShadow: 'var(--shadow-lg)', textAlign: 'center',
      }}>
        {/* Ícono */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'var(--color-warning-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <Clock size={28} style={{ color: 'var(--color-warning)' }} />
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          ¿Sigues ahí?
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 20 }}>
          Tu sesión cerrará por inactividad en
        </p>

        {/* Cuenta regresiva */}
        <div style={{
          fontSize: 40, fontWeight: 700, color: segundos <= 60
            ? 'var(--color-danger)' : 'var(--color-warning)',
          marginBottom: 24, fontFamily: 'var(--font-mono)',
        }}>
          {tiempo}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCerrarSesion}
            className="btn btn-secondary"
            style={{ flex: 1 }}>
            Cerrar sesión
          </button>
          <button
            onClick={onContinuar}
            className="btn btn-primary"
            style={{ flex: 1 }}>
            Continuar
          </button>
        </div>
      </div>
    </div>
  )
}