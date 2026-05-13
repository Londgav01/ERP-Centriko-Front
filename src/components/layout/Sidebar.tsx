import { useAuth } from '../../context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import type {Rol} from '../../types'
import {
  BarChart3, Building2, FileText, Package, Users,
  ShoppingCart, Warehouse, DollarSign, CheckCircle2,
  LogOut, ChevronRight, Settings,
} from 'lucide-react'

interface MenuItem {
  label: string
  path: string
  icon: React.ReactNode
  roles: Rol[]
  grupo?: string
}

const MENU: MenuItem[] = [
  { label: 'Tablero',          path: '/',               icon: <BarChart3 size={15}/>,    roles: ['ADMIN','COORDINADOR','ING_RESIDENTE','ENC_COMPRAS','ALMACENISTA','CONSULTA'] },
  // Maestros
  { label: 'Proyectos',        path: '/proyectos',      icon: <Building2 size={15}/>,    roles: ['ADMIN','COORDINADOR'], grupo: 'Maestros' },
  { label: 'Edificaciones',    path: '/edificaciones',  icon: <Building2 size={15}/>,    roles: ['ADMIN','COORDINADOR'], grupo: 'Maestros' },
  { label: 'Capítulos',        path: '/capitulos',      icon: <FileText size={15}/>,     roles: ['ADMIN','COORDINADOR'], grupo: 'Maestros' },
  { label: 'Materiales',       path: '/materiales',     icon: <Package size={15}/>,      roles: ['ADMIN','COORDINADOR'], grupo: 'Maestros' },
  { label: 'Proveedores',      path: '/proveedores',    icon: <Users size={15}/>,        roles: ['ADMIN','COORDINADOR'], grupo: 'Maestros' },
  { label: 'Contratistas',     path: '/contratistas',   icon: <Users size={15}/>,        roles: ['ADMIN','COORDINADOR'], grupo: 'Maestros' },
  { label: 'Usuarios',         path: '/usuarios',       icon: <Users size={15}/>,        roles: ['ADMIN'],               grupo: 'Maestros' },
  { label: 'Categorías',       path: '/categorias',     icon: <Settings size={15}/>,     roles: ['ADMIN'],               grupo: 'Maestros' },
  // Materiales
  { label: 'Requisiciones',    path: '/requisiciones',  icon: <FileText size={15}/>,     roles: ['ADMIN','COORDINADOR','ING_RESIDENTE'],               grupo: 'Materiales' },
  { label: 'Cotizaciones',     path: '/cotizaciones',   icon: <DollarSign size={15}/>,   roles: ['ADMIN','COORDINADOR','ENC_COMPRAS'],                 grupo: 'Materiales' },
  { label: 'Órdenes de compra',path: '/ordenes-compra', icon: <ShoppingCart size={15}/>, roles: ['ADMIN','COORDINADOR','ENC_COMPRAS'],                 grupo: 'Materiales' },
  { label: 'Entradas almacén', path: '/entradas',       icon: <Warehouse size={15}/>,    roles: ['ADMIN','COORDINADOR','ALMACENISTA'],                 grupo: 'Materiales' },
  { label: 'Inventario',       path: '/stock',          icon: <Warehouse size={15}/>,    roles: ['ADMIN','COORDINADOR','ING_RESIDENTE','ALMACENISTA'], grupo: 'Materiales' },
  { label: 'Salidas almacén',  path: '/salidas',        icon: <Warehouse size={15}/>,    roles: ['ADMIN','COORDINADOR','ALMACENISTA'],                 grupo: 'Materiales' },
  // Contratos
  { label: 'Contratos',        path: '/contratos',      icon: <FileText size={15}/>,     roles: ['ADMIN','COORDINADOR'], grupo: 'Contratos' },
  { label: 'Anticipos',        path: '/anticipos',      icon: <DollarSign size={15}/>,   roles: ['ADMIN','COORDINADOR'], grupo: 'Contratos' },
  { label: 'Actas de avance',  path: '/actas',          icon: <CheckCircle2 size={15}/>, roles: ['ADMIN','COORDINADOR','ING_RESIDENTE'], grupo: 'Contratos' },
]

export default function Sidebar() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const items = MENU.filter(i => usuario?.rol && i.roles.includes(usuario.rol))

  // Agrupar
  const grupos: Record<string, MenuItem[]> = {}
  items.forEach(i => {
    const g = i.grupo || 'General'
    if (!grupos[g]) grupos[g] = []
    grupos[g].push(i)
  })

  return (
    <aside style={{
      width: 220, height: '100vh', background: 'var(--color-sidebar-bg)',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', left: 0, top: 0, zIndex: 100,
      borderRight: '1px solid #1e293b',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 30, height: 30, background: 'var(--color-primary)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>ERP Obra</div>
            <div style={{ fontSize: 10, color: 'var(--color-sidebar-text)', marginTop: 1 }}>Gestión de proyectos</div>
          </div>
        </div>
        {/* Usuario */}
        <div style={{ background: '#1e293b', borderRadius: 6, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, background: 'var(--color-primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0 }}>
            {usuario?.nombre?.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{usuario?.nombre}</div>
            <div style={{ fontSize: 10, color: 'var(--color-sidebar-text)' }}>{usuario?.rol}</div>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
        {Object.entries(grupos).map(([grupo, items]) => (
          <div key={grupo} style={{ marginBottom: 4 }}>
            {grupo !== 'General' && (
              <div style={{ fontSize: 10, fontWeight: 600, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '10px 8px 4px' }}>
                {grupo}
              </div>
            )}
            {items.map(item => {
              const active = location.pathname === item.path
              return (
                <button key={item.path} onClick={() => navigate(item.path)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '7px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: active ? 'var(--color-sidebar-active)' : 'transparent',
                  color: active ? 'white' : 'var(--color-sidebar-text)',
                  fontSize: 13, textAlign: 'left', transition: 'all var(--transition)',
                  marginBottom: 1,
                }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#1e293b'; (e.currentTarget as HTMLElement).style.color = 'white' }}
                  onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--color-sidebar-text)' } }}
                >
                  <span style={{ opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                  <span style={{ flex: 1, fontWeight: active ? 600 : 400 }}>{item.label}</span>
                  {active && <ChevronRight size={12} />}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div style={{ padding: '10px 8px', borderTop: '1px solid #1e293b' }}>
        <button onClick={logout} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '7px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
          background: 'transparent', color: 'var(--color-sidebar-text)',
          fontSize: 13, transition: 'all var(--transition)',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#7f1d1d'; (e.currentTarget as HTMLElement).style.color = '#fca5a5' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--color-sidebar-text)' }}
        >
          <LogOut size={15} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}