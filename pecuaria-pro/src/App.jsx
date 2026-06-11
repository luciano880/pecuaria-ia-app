import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth.jsx'
import AuthPage      from './pages/AuthPage.jsx'
import Layout        from './components/Layout.jsx'
import Dashboard     from './pages/Dashboard.jsx'
import Animais       from './pages/Animais.jsx'
import ProducaoLeite from './pages/ProducaoLeite.jsx'
import Reproducao    from './pages/Reproducao.jsx'
import Sanidade      from './pages/Sanidade.jsx'
import Estoque       from './pages/Estoque.jsx'
import Pesagens      from './pages/Pesagens.jsx'
import AnaliseIA     from './pages/AnaliseIA.jsx'
import Configuracoes from './pages/Configuracoes.jsx'
import { C } from './utils/helpers.js'

// Financeiro inline simples para não depender de arquivo externo
import { lazy, Suspense } from 'react'
const Financeiro = lazy(() => import('./pages/Financeiro.jsx').catch(() => ({ default: () => (
  <div style={{color:C.texto,padding:32,textAlign:'center'}}>
    <div style={{fontSize:32,marginBottom:12}}>💰</div>
    <div>Módulo Financeiro</div>
    <div style={{color:C.textoMuted,fontSize:13,marginTop:8}}>Copie o Financeiro.jsx da versão anterior para src/pages/</div>
  </div>
) })))

function Carregando() {
  return (
    <div style={{ minHeight:'100vh', background: C.bg, display:'flex', alignItems:'center',
      justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div className="pulse" style={{ fontSize:40 }}>🐄</div>
      <div style={{ color: C.textoMuted, fontSize:14 }}>Carregando...</div>
    </div>
  )
}

function Privado({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Carregando />
  if (!user) return <Navigate to="/auth" replace />
  return children
}

export default function App() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/" element={<Privado><Layout /></Privado>}>
        <Route index                 element={<Dashboard />} />
        <Route path="animais"        element={<Animais />} />
        <Route path="producao-leite" element={<ProducaoLeite />} />
        <Route path="reproducao"     element={<Reproducao />} />
        <Route path="sanidade"       element={<Sanidade />} />
        <Route path="estoque"        element={<Estoque />} />
        <Route path="pesagens"       element={<Pesagens />} />
        <Route path="analise-ia"     element={<AnaliseIA />} />
        <Route path="financeiro"     element={<Suspense fallback={<Carregando/>}><Financeiro /></Suspense>} />
        <Route path="configuracoes"  element={<Configuracoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
