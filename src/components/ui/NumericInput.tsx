import { useState, useEffect } from 'react'

interface NumericInputProps {
  id?: string
  value: number
  onChange: (value: number) => void
  placeholder?: string
  required?: boolean
  min?: number
  max?: number
  disabled?: boolean
  className?: string
  prefix?: string
  suffix?: string
  decimals?: number
}

function formatear(valor: number, decimals: number): string {
  if (!valor) return ''
  if (decimals > 0) {
    const [entero, decimal] = valor.toFixed(decimals).split('.')
    return entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + decimal
  }
  return valor.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function parsear(texto: string): number {
  const limpio = texto.replace(/\./g, '').replace(',', '.')
  const num = parseFloat(limpio)
  return isNaN(num) ? 0 : num
}

export default function NumericInput({
  id, value, onChange, placeholder, required, min, max,
  disabled, className = '', prefix, suffix, decimals = 0
}: NumericInputProps) {
  const [display, setDisplay] = useState('')
  const [focused, setFocused] = useState(false)

  // Sincroniza valor externo cuando no está enfocado
  useEffect(() => {
    if (!focused) {
      setDisplay(value ? formatear(value, decimals) : '')
    }
  }, [value, focused, decimals])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d.,]/g, '')
    setDisplay(raw)
    onChange(parsear(raw))
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true)
    // Al enfocar muestra número sin formato para editar fácil
    // Si es 0 o vacío, limpia para que se vea el placeholder
    const rawVal = value ? value.toString().replace('.', ',') : ''
    setDisplay(rawVal)
    // Selecciona todo el texto al enfocar
    setTimeout(() => e.target.select(), 0)
  }

  const handleBlur = () => {
    setFocused(false)
    let numero = parsear(display)
    // Aplicar límites si están definidos
    if (min !== undefined && numero < min) numero = min
    if (max !== undefined && numero > max) numero = max
    onChange(numero)
    // Si quedó en 0 muestra vacío, si tiene valor formatea
    setDisplay(numero ? formatear(numero, decimals) : '')
  }

  const paddingLeft  = prefix ? 24 : 10
  const paddingRight = suffix ? 32 : 10

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {prefix && (
        <span style={{
          position: 'absolute', left: 10, fontSize: 13, lineHeight: 1,
          color: 'var(--color-text-muted)', pointerEvents: 'none', userSelect: 'none',
          zIndex: 1,
        }}>
          {prefix}
        </span>
      )}

      <input
        id={id}
        type="text"
        inputMode="numeric"
        className={`form-input ${className}`}
        style={{ paddingLeft, paddingRight, textAlign: 'right' }}
        value={display}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder || (required ? '0' : '')}
        required={required}
        disabled={disabled}
      />

      {suffix && (
        <span style={{
          position: 'absolute', right: 10, fontSize: 12, lineHeight: 1,
          color: 'var(--color-text-muted)', pointerEvents: 'none', userSelect: 'none',
        }}>
          {suffix}
        </span>
      )}
    </div>
  )
}