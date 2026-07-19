import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth.jsx'
import AuthPage           from './pages/AuthPage.jsx'
import Layout             from './components/Layout.jsx'
import Dashboard          from './pages/Dashboard.jsx'
import Animais            from './pages/Animais.jsx'
import ProducaoLeite      from './pages/ProducaoLeite.jsx'
import Reproducao         from './pages/Reproducao.jsx'
import Sanidade           from './pages/Sanidade.jsx'
import Estoque            from './pages/Estoque.jsx'
import Pesagens           from './pages/Pesagens.jsx'
import AnaliseIA          from './pages/AnaliseIA.jsx'
import Financeiro         from './pages/Financeiro.jsx'
import FinanceiroPessoal  from './pages/FinanceiroPessoal.jsx'
import IndicesZootecnicos from './pages/IndicesZootecnicos.jsx'
import Configuracoes      from './pages/Configuracoes.jsx'
import FichaAnimal        from './pages/FichaAnimal.jsx'
import { C } from './utils/helpers.js'

function Carregando() {
  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div className="pulse" style={{ fontSize:40 }}>🐄</div>
      <div style={{ color:C.textoMuted, fontSize:14 }}>Carregando...</div>
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
        <Route index                        element={<Dashboard />} />
        <Route path="animais"               element={<Animais />} />
        <Route path="animais/:brinco"       element={<FichaAnimal />} />
        <Route path="producao-leite"        element={<ProducaoLeite />} />
        <Route path="reproducao"            element={<Reproducao />} />
        <Route path="sanidade"              element={<Sanidade />} />
        <Route path="estoque"               element={<Estoque />} />
        <Route path="pesagens"              element={<Pesagens />} />
        <Route path="analise-ia"            element={<AnaliseIA />} />
        <Route path="financeiro"            element={<Financeiro />} />
        <Route path="financeiro-pessoal"    element={<FinanceiroPessoal />} />
        <Route path="indices"               element={<IndicesZootecnicos />} />
        <Route path="configuracoes"         element={<Configuracoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
