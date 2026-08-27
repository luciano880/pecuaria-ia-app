import { useState, useRef, useEffect } from 'react'
import { C } from '../utils/helpers.js'

// Scanner de brinco via câmera (QR code ou código de barras)
export default function ScannerBrinco({ onLer, onClose }) {
  const videoRef = useRef(null)
  const [erro, setErro] = useState('')
  const [suportado, setSuportado] = useState(true)
  const [manual, setManual] = useState('')
  const streamRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    let detector = null
    let ativo = true

    async function iniciar() {
      // Verificar suporte ao BarcodeDetector
      if (!('BarcodeDetector' in window)) {
        setSuportado(false)
        return
      }

      try {
        detector = new window.BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'codabar']
        })

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' } // câmera traseira
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        // Loop de detecção
        const detectar = async () => {
          if (!ativo || !videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0) {
              const valor = codes[0].rawValue
              pararCamera()
              onLer(valor)
              return
            }
          } catch (e) { /* continua tentando */ }
          rafRef.current = requestAnimationFrame(detectar)
        }
        detectar()
      } catch (e) {
        if (e.name === 'NotAllowedError') setErro('Permissão de câmera negada.')
        else if (e.name === 'NotFoundError') setErro('Nenhuma câmera encontrada.')
        else setErro('Erro ao acessar a câmera: ' + e.message)
      }
    }

    function pararCamera() {
      ativo = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }

    iniciar()
    return () => pararCamera()
  }, [onLer])

  function confirmarManual() {
    if (manual.trim()) {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      onLer(manual.trim())
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 16 }}>
          📷 Escanear Brinco
        </h3>

        {suportado && !erro && (
          <>
            <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: `3px solid ${C.verdeVivo}`, marginBottom: 16 }}>
              <video ref={videoRef} style={{ width: '100%', display: 'block' }} playsInline muted />
              {/* Mira */}
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                width: '70%', height: '35%', border: `2px solid ${C.verdeVivo}`, borderRadius: 12,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.3)'
              }} />
            </div>
            <p style={{ color: '#ccc', fontSize: 13, marginBottom: 16 }}>
              Aponte a câmera para o QR code ou código de barras do brinco
            </p>
          </>
        )}

        {(!suportado || erro) && (
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⌨️</div>
            <p style={{ color: '#fff', fontSize: 14, marginBottom: 4 }}>
              {erro || 'Câmera não disponível neste dispositivo.'}
            </p>
            <p style={{ color: '#999', fontSize: 12 }}>Digite o número do brinco manualmente:</p>
          </div>
        )}

        {/* Entrada manual sempre disponível */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            value={manual}
            onChange={e => setManual(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && confirmarManual()}
            placeholder="Digite o brinco..."
            style={{
              flex: 1, padding: '12px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: '#1a1a1a', color: '#fff', fontSize: 15
            }}
          />
          <button onClick={confirmarManual} style={{
            padding: '12px 20px', borderRadius: 8, border: 'none', background: C.verdeVivo,
            color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 15
          }}>OK</button>
        </div>

        <button onClick={() => {
          if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
          onClose()
        }} style={{
          padding: '10px 24px', borderRadius: 8, border: '1px solid #666',
          background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 14
        }}>Cancelar</button>
      </div>
    </div>
  )
}
