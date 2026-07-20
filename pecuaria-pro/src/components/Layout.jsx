import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { C, getCor } from '../utils/helpers.js'

export default function Layout() {
  const { perfil, logout } = useAuth()
  const navigate = useNavigate()
  const seg = perfil?.segmento
  const { accent, primary } = getCor(seg || 'leite')
  const [open, setOpen] = useState(false)

  const navLeite = [
    { to:'/',                    icon:'🏠', label:'Início' },
    { to:'/animais',             icon:'🏷️', label:'Animais' },
    { to:'/producao-leite',      icon:'🥛', label:'Produção de Leite' },
    { to:'/reproducao',          icon:'🐄', label:'Reprodução' },
    { to:'/indices',             icon:'📊', label:'Índices Zootécnicos' },
    { to:'/sanidade',            icon:'💊', label:'Sanidade' },
    { to:'/estoque',             icon:'🌽', label:'Estoque & Dietas' },
    { to:'/pesagens',            icon:'⚖️', label:'Pesagens' },
    { to:'/financeiro',          icon:'💰', label:'Financeiro Rural' },
    { to:'/financeiro-pessoal',  icon:'👤', label:'Financeiro Pessoal' },
    { to:'/declaracao-ir',       icon:'📋', label:'Declaração IR' },
    { to:'/analise-ia',          icon:'🤖', label:'Análise IA' },
  ]
  const navCorte = [
    { to:'/',                    icon:'🏠', label:'Início' },
    { to:'/animais',             icon:'🏷️', label:'Animais' },
    { to:'/pesagens',            icon:'⚖️', label:'Pesagens & GMD' },
    { to:'/reproducao',          icon:'🐄', label:'Reprodução' },
    { to:'/indices',             icon:'📊', label:'Índices Zootécnicos' },
    { to:'/sanidade',            icon:'💊', label:'Sanidade' },
    { to:'/estoque',             icon:'🌽', label:'Estoque & Dietas' },
    { to:'/financeiro',          icon:'💰', label:'Financeiro Rural' },
    { to:'/financeiro-pessoal',  icon:'👤', label:'Financeiro Pessoal' },
    { to:'/declaracao-ir',       icon:'📋', label:'Declaração IR' },
    { to:'/analise-ia',          icon:'🤖', label:'Análise IA' },
  ]
  const nav = seg === 'leite' ? navLeite : navCorte

  async function sair() { await logout(); navigate('/auth') }

  const itemStyle = (isActive) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', borderRadius: 8, marginBottom: 2,
    textDecoration: 'none',
    fontWeight: isActive ? 700 : 500,
    color: isActive ? C.texto : C.textoMuted,
    background: isActive ? `${accent}2A` : 'transparent',
    borderLeft: `3px solid ${isActive ? accent : 'transparent'}`,
    fontSize: 14,
  })

  const SidebarConteudo = () => (
    <>
      <div style={{ padding: '18px 16px 12px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg,${primary},${accent})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🐄</div>
            <div>
              <div style={{ color:C.texto, fontWeight:800, fontSize:14, fontFamily:"'Syne',sans-serif" }}>PecuáriaIA</div>
              <div style={{ color:C.textoMuted, fontSize:10 }}>{perfil?.fazenda || '—'}</div>
            </div>
          </div>
          <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', color:C.textoMuted, fontSize:22, cursor:'pointer', padding:4 }}>×</button>
        </div>
        <div style={{ marginTop:10 }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:`${primary}33`, border:`1px solid ${accent}`, borderRadius:20, padding:'3px 10px', fontSize:10, fontWeight:700, color:accent }}>
            {seg === 'leite' ? '🥛 Leiteira' : '🥩 Corte'}
          </span>
        </div>
      </div>

      <nav style={{ flex:1, padding:'10px', overflowY:'auto' }}>
        {nav.map(item => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} style={({ isActive }) => itemStyle(isActive)} onClick={() => setOpen(false)}>
            <span style={{ fontSize:16, width:24, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
        <div style={{ borderTop:`1px solid ${C.border}`, margin:'8px 0' }} />
        <NavLink to="/configuracoes" style={({ isActive }) => ({ ...itemStyle(isActive), borderLeftColor: isActive ? C.ambar : 'transparent', background: isActive ? `${C.ambar}22` : 'transparent' })} onClick={() => setOpen(false)}>
          <span style={{ fontSize:16, width:24, textAlign:'center', flexShrink:0 }}>⚙️</span>
          <span>Configurações</span>
        </NavLink>
      </nav>

      <div style={{ padding:'12px 14px', borderTop:`1px solid ${C.border}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:`linear-gradient(135deg,${primary},${accent})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#fff', flexShrink:0 }}>
            {perfil?.nome?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div style={{ overflow:'hidden' }}>
            <div style={{ fontSize:12, color:C.textoSub, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{perfil?.nome}</div>
            <div style={{ fontSize:10, color:C.textoMuted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{perfil?.email}</div>
          </div>
        </div>
        <button onClick={sair} style={{ width:'100%', padding:'7px 0', borderRadius:6, border:`1px solid ${C.border}`, background:'transparent', color:C.textoMuted, fontSize:11, fontWeight:600, cursor:'pointer' }}
          onMouseEnter={e => { e.target.style.background=C.critico; e.target.style.color='#fff' }}
          onMouseLeave={e => { e.target.style.background='transparent'; e.target.style.color=C.textoMuted }}>
          Sair da conta
        </button>
      </div>
    </>
  )

  return (
    <div style={{ display:'flex', minHeight:'100dvh', background:C.bg }}>

      {/* Overlay mobile */}
      {open && (
        <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:998 }} />
      )}

      {/* Sidebar desktop */}
      <aside id="sidebar-desktop" style={{ width:228, background:C.bgCard, borderRight:`1px solid ${C.border}`, display:'flex', flexDirection:'column', flexShrink:0, position:'sticky', top:0, height:'100dvh', overflowY:'auto' }}>
        <SidebarConteudo />
      </aside>

      {/* Sidebar mobile (overlay deslizante) */}
      <aside id="sidebar-mobile" style={{ position:'fixed', top:0, left:0, width:280, height:'100dvh', background:C.bgCard, borderRight:`1px solid ${C.border}`, display:'flex', flexDirection:'column', zIndex:999, transform: open ? 'translateX(0)' : 'translateX(-100%)', transition:'transform 0.25s ease', overflowY:'auto' }}>
        <SidebarConteudo />
      </aside>

      {/* Conteúdo principal */}
      <main style={{ flex:1, overflowY:'auto', minWidth:0 }}>

        {/* Topbar mobile */}
        <div id="topbar-mobile" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:`1px solid ${C.border}`, background:C.bgCard, position:'sticky', top:0, zIndex:10 }}>
          <button onClick={() => setOpen(true)} style={{ background:C.bgInput, border:`1px solid ${C.border}`, borderRadius:8, padding:'8px 12px', cursor:'pointer', color:C.texto, fontSize:20, lineHeight:1 }}>☰</button>
          <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, color:C.texto, fontSize:16 }}>PecuáriaIA</span>
          <span style={{ marginLeft:'auto', fontSize:10, fontWeight:700, color:accent, background:`${primary}33`, border:`1px solid ${accent}`, borderRadius:12, padding:'2px 8px' }}>
            {seg === 'leite' ? '🥛' : '🥩'} {seg === 'leite' ? 'Leiteira' : 'Corte'}
          </span>
        </div>

        <div style={{ padding:'20px 16px' }}>
          <Outlet />
        </div>
      </main>

      <style>{`
        @media (min-width: 769px) {
          #sidebar-mobile { display: none !important; }
          #topbar-mobile  { display: none !important; }
        }
        @media (max-width: 768px) {
          #sidebar-desktop { display: none !important; }
        }
      `}</style>
    </div>
  )
}
