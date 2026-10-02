import { useState } from 'react'
import { C } from '../utils/helpers.js'

// ── Card indicador ─────────────────────────────────────────────
export function Card({ icon, label, valor, sub, cor = C.verdeClaro, badge }) {
  return (
    <div style={{
      background: C.bgCard, borderRadius: 10, padding: '14px 16px',
      borderLeft: `3px solid ${cor}`, border: `1px solid ${C.border}`,
      borderLeftWidth: 3,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: C.textoMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {icon} {label}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: cor, fontFamily: 'monospace', marginTop: 4 }}>
            {valor}
          </div>
          {sub && <div style={{ fontSize: 11, color: C.textoMuted, marginTop: 2 }}>{sub}</div>}
        </div>
        {badge && (
          <span style={{ background: `${cor}22`, color: cor, fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 4 }}>
            {badge}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────────
export function Modal({ titulo, onClose, children, largura = 520 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: 14, width: '100%', maxWidth: largura,
        maxHeight: '90vh', overflow: 'auto',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
        }}>
          <h3 style={{ color: C.texto, fontSize: 15, fontWeight: 700 }}>{titulo}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: C.textoMuted,
            fontSize: 20, cursor: 'pointer', lineHeight: 1,
          }}>×</button>
        </div>
        <div style={{ padding: '20px' }}>{children}</div>
      </div>
    </div>
  )
}

// ── Campo de formulário ────────────────────────────────────────
export function Campo({ label, type = 'text', value, onChange, placeholder, required, options, step }) {
  const style = {
    width: '100%', padding: '9px 12px', borderRadius: 7,
    border: `1.5px solid ${C.border}`, background: C.bgInput,
    color: C.texto, fontSize: 13, fontFamily: type === 'number' ? 'monospace' : 'inherit',
    boxSizing: 'border-box',
  }
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 11, color: C.textoSub, marginBottom: 4, fontWeight: 600 }}>
        {label}{required && <span style={{ color: C.critico }}> *</span>}
      </label>
      {type === 'select' ? (
        <select value={value} onChange={e => onChange(e.target.value)} style={style}>
          <option value="">Selecione...</option>
          {options?.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} rows={3}
          style={{ ...style, resize: 'vertical' }} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} step={step}
          style={style}
          onFocus={e => e.target.style.borderColor = C.verdeClaro}
          onBlur={e  => e.target.style.borderColor = C.border} />
      )}
    </div>
  )
}

// ── Grid de campos ─────────────────────────────────────────────
export function Grid({ cols = 2, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '0 16px' }}>
      {children}
    </div>
  )
}

// ── Botão ──────────────────────────────────────────────────────
export function Btn({ children, onClick, cor = C.verde, outline, size = 'md', disabled, type = 'button' }) {
  const pad = size === 'sm' ? '6px 12px' : '10px 18px'
  const fz  = size === 'sm' ? 12 : 13
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      padding: pad, borderRadius: 7, border: outline ? `1.5px solid ${cor}` : 'none',
      background: outline ? 'transparent' : (disabled ? C.border : cor),
      color: outline ? cor : '#fff',
      fontSize: fz, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'opacity 0.12s', opacity: disabled ? 0.6 : 1,
    }}>
      {children}
    </button>
  )
}

// ── Tabela ─────────────────────────────────────────────────────
export function Tabela({ colunas, dados, onEdit, onDelete, loading }) {
  if (loading) return <div style={{ color: C.textoMuted, padding: 20, textAlign: 'center' }}>Carregando...</div>
  if (!dados?.length) return (
    <div style={{ color: C.textoMuted, padding: 32, textAlign: 'center', fontSize: 13 }}>
      Nenhum registro encontrado
    </div>
  )
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${C.border}` }}>
            {colunas.map(c => (
              <th key={c.key} style={{
                padding: '10px 12px', textAlign: 'left',
                color: C.textoMuted, fontWeight: 600,
                fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>{c.label}</th>
            ))}
            {(onEdit || onDelete) && <th style={{ width: 80 }}></th>}
          </tr>
        </thead>
        <tbody>
          {dados.map((row, i) => (
            <tr key={row.id ?? i} style={{
              borderBottom: `1px solid ${C.border}`,
              background: i % 2 === 0 ? 'transparent' : `${C.verde}08`,
            }}>
              {colunas.map(c => (
                <td key={c.key} style={{ padding: '10px 12px', color: c.cor ? c.cor(row) : C.texto }}>
                  {c.render ? c.render(row) : (row[c.key] ?? '—')}
                </td>
              ))}
              {(onEdit || onDelete) && (
                <td style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {onEdit   && <Btn size="sm" cor={C.verde}    outline onClick={() => onEdit(row)}>✏️</Btn>}
                    {onDelete && <Btn size="sm" cor={C.critico}  outline onClick={() => onDelete(row)}>🗑️</Btn>}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Badge de alerta ────────────────────────────────────────────
export function BadgeAlerta({ tipo, dias }) {
  if (dias === null) return null
  const s = dias <= 0 ? { cor: C.critico, txt: 'VENCIDO' }
           : dias < 3  ? { cor: C.critico, txt: `${dias}d` }
           : dias < 7  ? { cor: C.ambar,   txt: `${dias}d` }
           : null
  if (!s) return null
  return (
    <span style={{
      background: `${s.cor}33`, color: s.cor,
      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
    }}>{s.txt}</span>
  )
}

// ── Seção com título ────────────────────────────────────────────
export function Secao({ titulo, icon, cor = C.verdeClaro, children, acao }) {
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderRadius: 12, overflow: 'hidden', marginBottom: 20,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
        background: `${cor}18`,
      }}>
        <div style={{ color: cor, fontWeight: 700, fontSize: 13 }}>
          {icon} {titulo}
        </div>
        {acao}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  )
}

// ── Toast ──────────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState([])
  function toast(msg, tipo = 'ok') {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, tipo }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }
  function ToastContainer() {
    return (
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.tipo === 'ok' ? C.verde : C.critico,
            color: '#fff', padding: '10px 16px', borderRadius: 8,
            fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}>
            {t.tipo === 'ok' ? '✅' : '⚠️'} {t.msg}
          </div>
        ))}
      </div>
    )
  }
  return { toast, ToastContainer }
}
