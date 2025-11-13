import React, { useEffect, useMemo, useRef, useState } from 'react'

type Prediction = {
  multiplier: number
  confidence: number // percentage 0-100
  timeToEruptSec: number
  generatedAt: number
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

// Generate a realistic Aviator-like prediction: mostly low values, occasional medium, rare high.
function generateAviatorPrediction(prev?: Prediction | null): Prediction {
  const r = Math.random()
  let m: number
  if (r < 0.75) {
    // Common case: 1.05x – 2.2x
    m = 1.05 + Math.random() * 1.15
  } else if (r < 0.95) {
    // Less common: 2.2x – 5x
    m = 2.2 + Math.random() * 2.8
  } else if (r < 0.995) {
    // Rare: 5x – 9x
    m = 5 + Math.random() * 4
  } else {
    // Very rare: 9x – 15x (cap to keep "not so high")
    m = 9 + Math.random() * 6
  }

  // Slight inertia: avoid huge jumps from immediately previous
  if (prev) {
    const diff = m - prev.multiplier
    m = prev.multiplier + clamp(diff, -4, 4)
  }
  // Cap final multiplier to reasonable values
  m = clamp(m, 1.02, 15)

  // Confidence inversely correlated with multiplier plus some noise
  const baseConf = clamp(92 - (m - 1) * 6, 40, 95)
  const noise = (Math.random() - 0.5) * 6
  const confidence = clamp(Math.round(baseConf + noise), 35, 96)

  // Time to erupt: grows sublinearly with multiplier, keep sensible window
  const timeToEruptSec = clamp(1.8 + Math.sqrt(m) * 1.2 + Math.random() * 0.8, 2.2, 8.5)

  return {
    multiplier: Number(m.toFixed(m < 2 ? 2 : m < 10 ? 2 : 1)),
    confidence,
    timeToEruptSec: Number(timeToEruptSec.toFixed(1)),
    generatedAt: Date.now(),
  }
}

export const PredictionsPanel: React.FC<{
  open: boolean
  onClose: () => void
  siteName?: string
}> = ({ open, onClose, siteName }) => {
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [remaining, setRemaining] = useState<number>(0)
  const timerRef = useRef<number | null>(null)

  // Choose image path based on environment; show gracefully if missing
  const imgSrc = useMemo(() => {
    const p = '/assets/predictions.jpg'
    return p
  }, [])

  const startCountdown = (p: Prediction) => {
    const endTs = p.generatedAt + p.timeToEruptSec * 1000
    const tick = () => {
      const s = Math.max(0, Math.round((endTs - Date.now()) / 100) / 10)
      setRemaining(Number(s.toFixed(1)))
      if (s <= 0 && timerRef.current) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    tick()
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(tick, 100)
  }

  const nextPrediction = () => {
    const next = generateAviatorPrediction(prediction)
    setPrediction(next)
    startCountdown(next)
  }

  useEffect(() => {
    if (!open) return
    nextPrediction()
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        width: 'min(900px, 92vw)', background: '#0c0f13', color: '#fff',
        borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.35)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: '#131822', borderBottom: '1px solid #1f2633' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Aviator Predictions</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 13, opacity: 0.85 }}>{siteName ? `Connected: ${siteName}` : 'Connected'}</div>
          <button onClick={onClose} style={{ marginLeft: 12, background: '#2a3344', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>Close</button>
        </div>

        {/* Hero */}
        <div style={{ position: 'relative', height: 240, background: '#0d121b' }}>
          <img src={imgSrc} alt="Predictions" onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display='none' }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.15), rgba(0,0,0,0.55))' }} />
          <div style={{ position: 'absolute', left: 16, bottom: 16 }}>
            <div style={{ fontSize: 14, opacity: 0.85 }}>Current Prediction</div>
            <div style={{ fontSize: 36, fontWeight: 800 }}>{prediction ? `${prediction.multiplier.toFixed(2)}x` : '—'}</div>
          </div>
          <div style={{ position: 'absolute', right: 16, bottom: 16, textAlign: 'right' }}>
            <div style={{ fontSize: 14, opacity: 0.85 }}>Confidence</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{prediction ? `${prediction.confidence}%` : '—'}</div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>Time to eruption</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{remaining ? `${remaining.toFixed(1)}s` : prediction ? `${prediction.timeToEruptSec.toFixed(1)}s` : '—'}</div>
                <div style={{ flex: 1, height: 10, background: '#1b2230', borderRadius: 999, overflow: 'hidden' }}>
                  {prediction && (
                    <div style={{
                      width: `${Math.max(0, Math.min(100, (1 - remaining / prediction.timeToEruptSec) * 100))}%`,
                      height: '100%', background: 'linear-gradient(90deg, #7c3aed, #22d3ee)', transition: 'width 100ms linear'
                    }} />
                  )}
                </div>
              </div>
            </div>

            <button onClick={nextPrediction} style={{
              background: 'linear-gradient(90deg, #7c3aed, #22d3ee)', color: '#fff',
              border: 'none', borderRadius: 10, padding: '12px 18px', fontWeight: 700, cursor: 'pointer'
            }}>
              Next
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
            <div style={{ background: '#121825', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Pattern</div>
              <div style={{ fontSize: 16 }}>
                {prediction ? (prediction.multiplier < 2.2 ? 'Calm' : prediction.multiplier < 5 ? 'Climb' : prediction.multiplier < 9 ? 'Surge' : 'Spike') : '—'}
              </div>
            </div>
            <div style={{ background: '#121825', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Confidence</div>
              <div style={{ fontSize: 16 }}>{prediction ? `${prediction.confidence}%` : '—'}</div>
            </div>
            <div style={{ background: '#121825', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Multiplier</div>
              <div style={{ fontSize: 16 }}>{prediction ? `${prediction.multiplier.toFixed(2)}x` : '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}