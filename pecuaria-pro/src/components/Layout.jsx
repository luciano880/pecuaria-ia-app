import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { C, getCor } from '../utils/helpers.js'

export default function Layout() {
  const { perfil, logout } = useAuth()
  const navigate = useNavigate()
  const seg = perfil?.segmento
  const { accent, primary } = getCor(seg || 'leite')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navLeite = [
    { to:'/',               icon:'🏠', label:'Início' },
    { to:'/animais',        icon:'🏷️', label:'Animais' },
    { to:'/producao-leite', icon:'🥛', label:'Produção de Leite' },
    { to:'/reproducao',     icon:'🐄', label:'Reprodução' },
    { to:'/sanidade',       icon:'💊', label:'Sanidade' },
    { to:'/estoque',        icon:'🌽', label:'Estoque & Dietas' },
    { to:'/pesagens',       icon:'⚖️', label:'Pesagens' },
    { to:'/financeiro',     icon:'💰', label:'Financeiro & IR' },
    { to:'/analise-ia',     icon:'🤖', label:'Análise IA' },
  ]
  const navCorte = [
    { to:'/',           icon:'🏠', label:'Início' },
    { to:'/animais',    icon:'🏷️', label:'Animais' },
    { to:'/pesagens',   icon:'⚖️', label:'Pesagens & GMD' },
    { to:'/reproducao', icon:'🐄', label:'Reprodução' },
    { to:'/sanidade',   icon:'💊', label:'Sanidade' },
    { to:'/estoque',    icon:'🌽', label:'Estoque & Dietas' },
    { to:'/financeiro', icon:'💰', label:'Financeiro & IR' },
    { to:'/analise-ia', icon:'🤖', label:'Análise IA' },
  ]
  const nav = seg === 'leite' ? navLeite : navCorte

  async function sair() { await logout(); navigate('/auth') }

  const navItemStyle = (isActive) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 12px', borderRadius: 8, marginBottom: 2,
    textDecoration: 'none',
    fontWeight: isActive ? 700 : 500,
    color: isActive ? C.texto : C.textoMuted,
    background: isActive ? `${accent}2A` : 'transparent',
    borderLeft: `3px solid ${isActive ? accent : 'transparent'}`,
    fontSize: 13, transition: 'all 0.1s',
  })

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div style={{ padding: '20px 18px 14px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${primary}, ${accent})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>🐄</div>
          <div>
            <div style={{ color: C.texto, fontWeight: 800, fontSize: 14, fontFamily: "'Syne',sans-serif" }}>PecuáriaIA</div>
            <div style={{ color: C.textoMuted, fontSize: 10, marginTop: 1 }}>{perfil?.fazenda || '—'}</div>
          </div>
        </div>
        {/* Badge segmento */}
        <div style={{ marginTop: 12 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: `${primary}33`, border: `1px solid ${accent}`,
            borderRadius: 20, padding: '3px 10px',
            fontSize: 10, fontWeight: 700, color: accent,
          }}>
            {seg === 'leite' ? '🥛 Leiteira' : '🥩 Corte'}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
        {nav.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'}
            style={({ isActive }) => navItemStyle(isActive)}
            onClick={() => setSidebarOpen(false)}
          >
            <span style={{ fontSize: 15, width: 22, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}

        <div style={{ borderTop: `1px solid ${C.border}`, margin: '8px 0' }} />

        <NavLink to="/configuracoes"
          style={({ isActive }) => ({ ...navItemStyle(isActive), borderLeftColor: isActive ? C.ambar : 'transparent', background: isActive ? `${C.ambar}22` : 'transparent' })}
          onClick={() => setSidebarOpen(false)}>
          <span style={{ fontSize: 15, width: 22, textAlign: 'center', flexShrink: 0 }}>⚙️</span>
          <span>Configurações</span>
        </NavLink>
      </nav>

      {/* Perfil + sair */}
      <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: `linear-gradient(135deg, ${primary}, ${accent})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0,
          }}>
            {perfil?.nome?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 12, color: C.textoSub, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {perfil?.nome}
            </div>
            <div style={{ fontSize: 10, color: C.textoMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {perfil?.email}
            </div>
          </div>
        </div>
        <button onClick={sair} style={{
          width: '100%', padding: '7px 0', borderRadius: 6,
          border: `1px solid ${C.border}`, background: 'transparent',
          color: C.textoMuted, fontSize: 11, fontWeight: 600, cursor: 'pointer',
          transition: 'all 0.12s',
        }}
        onMouseEnter={e => { e.target.style.background = C.critico; e.target.style.color = '#fff'; e.target.style.borderColor = C.critico }}
        onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = C.textoMuted; e.target.style.borderColor = C.border }}>
          Sair da conta
        </button>
      </div>
    </>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: C.bg }}>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 40, display: 'none',
        }} className="mobile-overlay" />
      )}

      {/* Sidebar desktop */}
      <aside style={{
        width: 228, background: C.bgCard, borderRight: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        position: 'sticky', top: 0, height: '100dvh', overflowY: 'auto',
      }}>
        <SidebarContent />
      </aside>

      {/* Conteúdo */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', minWidth: 0 }} className="main-content">

        {/* Topbar mobile (hamburger) */}
        <div style={{
          display: 'none', alignItems: 'center', gap: 12,
          marginBottom: 16, paddingBottom: 12,
          borderBottom: `1px solid ${C.border}`,
        }} className="mobile-topbar">
          <button onClick={() => setSidebarOpen(true)} style={{
            background: C.bgCard, border: `1px solid ${C.border}`,
            borderRadius: 7, padding: '7px 10px', cursor: 'pointer', color: C.texto,
          }}>☰</button>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, color: C.texto }}>PecuáriaIA</span>
        </div>

        <Outlet />
      </main>

      <style>{`
        @media (max-width: 768px) {
          aside { display: none !important; }
          .mobile-topbar { display: flex !important; }
          .main-content { padding: 16px !important; }
        }
      `}</style>
    </div>
  )
}
