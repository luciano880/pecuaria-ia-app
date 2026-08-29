import { useState, useRef, useEffect } from 'react'
import { C } from '../utils/helpers.js'

// Scanner de brinco: lê código de barras/QR E número escrito (OCR)
export default function ScannerBrinco({ onLer, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [erro, setErro] = useState('')
  const [modo, setModo] = useState('codigo') // 'codigo' | 'ocr'
  const [manual, setManual] = useState('')
  const [lendo, setLendo] = useState(false)
  const [resultado, setResultado] = useState('')
  const [progresso, setProgresso] = useState(0)
  const streamRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    let detector = null
    let ativo = true

    async function iniciarCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },   // alta resolução para leitura melhor
            height: { ideal: 1080 },
          }
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        if (modo === 'codigo' && 'BarcodeDetector' in window) {
          detector = new window.BarcodeDetector({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'codabar', 'upc_a', 'upc_e', 'itf', 'data_matrix']
          })
          const detectar = async () => {
            if (!ativo || !videoRef.current) return
            try {
              const codes = await detector.detect(videoRef.current)
              if (codes.length > 0) {
                setResultado(codes[0].rawValue)
                pararCamera()
                return
              }
            } catch (e) { /* continua */ }
            rafRef.current = requestAnimationFrame(detectar)
          }
          detectar()
        }
      } catch (e) {
        if (e.name === 'NotAllowedError') setErro('Permissão de câmera negada. Autorize nas configurações do navegador.')
        else if (e.name === 'NotFoundError') setErro('Nenhuma câmera encontrada.')
        else setErro('Erro na câmera: ' + e.message)
      }
    }

    function pararCamera() {
      ativo = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }

    if (!resultado) iniciarCamera()
    return () => pararCamera()
  }, [modo, resultado])

  // Capturar foto e fazer OCR com pré-processamento
  async function lerNumero() {
    if (!videoRef.current || !canvasRef.current) return
    setLendo(true)
    setProgresso(0)
    setErro('')
    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const vw = video.videoWidth
      const vh = video.videoHeight

      // Recortar só a região central (a mira) para focar no número
      const cropW = Math.floor(vw * 0.75)
      const cropH = Math.floor(vh * 0.30)
      const cropX = Math.floor((vw - cropW) / 2)
      const cropY = Math.floor((vh - cropH) / 2)

      canvas.width = cropW
      canvas.height = cropH
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

      // Pré-processamento: escala de cinza + aumento de contraste (melhora OCR)
      const imgData = ctx.getImageData(0, 0, cropW, cropH)
      const d = imgData.data
      for (let i = 0; i < d.length; i += 4) {
        const gray = d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114
        // Binarização com limiar (preto/branco puro)
        const bin = gray > 120 ? 255 : 0
        d[i] = d[i+1] = d[i+2] = bin
      }
      ctx.putImageData(imgData, 0, 0)

      // Carregar Tesseract via CDN
      if (!window.Tesseract) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
          script.onload = resolve
          script.onerror = () => reject(new Error('Falha ao carregar OCR. Verifique a internet.'))
          document.head.appendChild(script)
        })
      }

      const { data } = await window.Tesseract.recognize(canvas, 'eng', {
        tessedit_char_whitelist: '0123456789',
        logger: m => {
          if (m.status === 'recognizing text') setProgresso(Math.round(m.progress * 100))
        }
      })
      const numeros = (data.text.match(/\d+/g) || []).sort((a, b) => b.length - a.length)
      if (numeros.length > 0) {
        setResultado(numeros[0])
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      } else {
        setErro('Número não reconhecido. Melhore a luz, aproxime a câmera ou digite manualmente.')
      }
    } catch (e) {
      setErro(e.message || 'Erro no OCR.')
    }
    setLendo(false)
    setProgresso(0)
  }

  function confirmar(valor) {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    onLer(valor)
  }

  function fechar() {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginBottom: 12 }}>📷 Escanear Brinco</h3>

        {resultado ? (
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 24, marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>Número lido:</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: C.verdeVivo, fontFamily: 'monospace', marginBottom: 8 }}>{resultado}</div>
            <input
              value={resultado} onChange={e => setResultado(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#000', color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 14, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setResultado(''); setErro('') }} style={{ flex: 1, padding: '12px', borderRadius: 8, border: '1px solid #666', background: 'transparent', color: '#fff', cursor: 'pointer' }}>🔄 Ler de novo</button>
              <button onClick={() => confirmar(resultado)} style={{ flex: 1, padding: '12px', borderRadius: 8, border: 'none', background: C.verdeVivo, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>✅ Confirmar</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, justifyContent: 'center' }}>
              <button onClick={() => { setModo('codigo'); setErro('') }} style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600,
                border: `1px solid ${modo === 'codigo' ? C.verdeVivo : '#555'}`,
                background: modo === 'codigo' ? `${C.verdeVivo}33` : 'transparent',
                color: modo === 'codigo' ? C.verdeVivo : '#aaa',
              }}>🏷️ Código/QR</button>
              <button onClick={() => { setModo('ocr'); setErro('') }} style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600,
                border: `1px solid ${modo === 'ocr' ? C.verdeVivo : '#555'}`,
                background: modo === 'ocr' ? `${C.verdeVivo}33` : 'transparent',
                color: modo === 'ocr' ? C.verdeVivo : '#aaa',
              }}>🔢 Ler número</button>
            </div>

            <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: `3px solid ${C.verdeVivo}`, marginBottom: 12 }}>
              <video ref={videoRef} style={{ width: '100%', display: 'block' }} playsInline muted />
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '75%', height: '30%', border: `2px solid ${C.verdeVivo}`, borderRadius: 8, boxShadow: '0 0 0 9999px rgba(0,0,0,0.25)' }} />
            </div>

            <p style={{ color: '#ccc', fontSize: 12, marginBottom: 12 }}>
              {modo === 'codigo'
                ? '🏷️ Aponte para o código de barras ou QR do brinco'
                : '🔢 Enquadre o número dentro da moldura e toque em "Ler número"'}
            </p>

            {modo === 'ocr' && (
              <button onClick={lerNumero} disabled={lendo} style={{
                width: '100%', padding: '14px', borderRadius: 8, border: 'none',
                background: lendo ? '#555' : C.verdeVivo, color: '#fff', fontWeight: 700, fontSize: 15, cursor: lendo ? 'wait' : 'pointer', marginBottom: 12
              }}>{lendo ? `⏳ Lendo... ${progresso}%` : '🔢 Ler número do brinco'}</button>
            )}

            {erro && (
              <div style={{ background: '#2a1a1a', borderRadius: 12, padding: 14, marginBottom: 12, color: '#ff9999', fontSize: 13 }}>
                ⚠️ {erro}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                value={manual} onChange={e => setManual(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && manual.trim() && confirmar(manual.trim())}
                placeholder="Ou digite o brinco..."
                style={{ flex: 1, padding: '12px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#1a1a1a', color: '#fff', fontSize: 15 }}
              />
              <button onClick={() => manual.trim() && confirmar(manual.trim())} style={{ padding: '12px 20px', borderRadius: 8, border: 'none', background: C.verdeVivo, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>OK</button>
            </div>
          </>
        )}

        <button onClick={fechar} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid #666', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 14 }}>Cancelar</button>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}
