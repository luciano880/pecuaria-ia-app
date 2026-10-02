import { useState } from 'react'
import { C } from '../utils/helpers.js'
import Financeiro from './Financeiro.jsx'
import FinanceiroAnimal from './FinanceiroAnimal.jsx'
import FinanceiroPessoal from './FinanceiroPessoal.jsx'
import DeclaracaoIR from './DeclaracaoIR.jsx'

// Hub que unifica os 4 módulos financeiros em sub-abas
export default function FinanceiroHub() {
  const [aba, setAba] = useState('rural')

  const abas = [
    { id: 'rural',    label: 'Rural',        icon: '💰' },
    { id: 'animal',   label: 'Por Animal',   icon: '🐄' },
    { id: 'pessoal',  label: 'Pessoal',      icon: '👤' },
    { id: 'ir',       label: 'Declaração IR', icon: '📋' },
  ]

  return (
    <div>
      {/* Sub-navegação */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap',
        borderBottom: `1px solid ${C.border}`, paddingBottom: 12,
      }}>
        {abas.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
            fontSize: 13, fontWeight: 700,
            border: `1px solid ${aba === a.id ? C.ambar : C.border}`,
            background: aba === a.id ? `${C.ambar}22` : 'transparent',
            color: aba === a.id ? C.ambar : C.textoMuted,
            transition: 'all 0.15s',
          }}>
            <span style={{ fontSize: 15 }}>{a.icon}</span>
            {a.label}
          </button>
        ))}
      </div>

      {/* Conteúdo da aba selecionada */}
      {aba === 'rural'   && <Financeiro />}
      {aba === 'animal'  && <FinanceiroAnimal />}
      {aba === 'pessoal' && <FinanceiroPessoal />}
      {aba === 'ir'      && <DeclaracaoIR />}
    </div>
  )
}
