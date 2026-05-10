import type { ReactNode } from 'react'
import Sidebar from './Sidebar'

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, padding: '28px 32px', minWidth: 0 }}>
        {children}
      </main>
    </div>
  )
}