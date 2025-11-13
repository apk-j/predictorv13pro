import React, { useEffect, useRef, useState } from 'react'

type Prediction = {
  multiplier: number
  timeToEruptSec: number
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

function generatePrediction(prev?: Prediction | null): Prediction {
  const r = Math.random()
  let m: number
  if (r < 0.75) m = 1.05 + Math.random() * 1.15
  else if (r < 0.95) m = 2.2 + Math.random() * 2.8
  else if (r < 0.995) m = 5 + Math.random() * 4
  else m = 9 + Math.random() * 6
  if (prev) m = clamp(prev.multiplier + clamp(m - prev.multiplier, -4, 4), 1.02, 15)
  // Eruption duration scales with multiplier: bigger multiplier = longer before eruption
  const timeToEruptSec = clamp(1.9 + Math.sqrt(m) * 1.3, 2.2, 9.0)
  return { multiplier: Number(m.toFixed(2)), timeToEruptSec: Number(timeToEruptSec.toFixed(1)) }
}

export const PredictionsPage: React.FC<{
}> = () => {
  const [siteName, setSiteName] = useState<string | null>(null)
  const [current, setCurrent] = useState<Prediction>({ multiplier: 0, timeToEruptSec: 0 })
  const [previous, setPrevious] = useState<Prediction>({ multiplier: 0, timeToEruptSec: 0 })
  const [auto, setAuto] = useState(false)
  const [banner, setBanner] = useState<string>('Prediction generated successfully!')
  const endRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)

  // Persist and restore state across refresh
  const saveState = (
    endTs?: number,
    snapshot?: { current?: Prediction; previous?: Prediction; auto?: boolean; banner?: string }
  ) => {
    try {
      const curr = snapshot?.current ?? current
      const prev = snapshot?.previous ?? previous
      const hasMeaningfulState = (curr.multiplier > 0) || (prev.multiplier > 0) || !!(endTs ?? endRef.current)
      if (!hasMeaningfulState) return
      const payload = {
        current: curr,
        previous: prev,
        auto: typeof snapshot?.auto === 'boolean' ? snapshot!.auto! : auto,
        banner: typeof snapshot?.banner === 'string' ? snapshot!.banner! : banner,
        endTs: endTs ?? endRef.current ?? null,
      }
      localStorage.setItem('predictions.state', JSON.stringify(payload))
    } catch {}
  }


  const startCountdown = (p: Prediction, endTsOverride?: number) => {
    endRef.current = endTsOverride ?? (Date.now() + p.timeToEruptSec * 1000)
    const tick = () => {
      if (!endRef.current) return
      const s = Math.max(0, Math.round((endRef.current - Date.now()) / 100) / 10)
      if (s <= 0 && timerRef.current) {
        window.clearInterval(timerRef.current); timerRef.current = null
        setBanner('Erupted!')
        // In auto mode, move to the next prediction immediately after eruption
        if (auto) {
          window.setTimeout(() => next(), 600)
        }
      }
    }
    tick()
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(tick, 100)
  }

  const next = () => {
    const p = generatePrediction(current.multiplier ? current : null)
    setPrevious(current)
    setCurrent(p)
    setBanner('Prediction generated successfully!')
    const endTs = Date.now() + p.timeToEruptSec * 1000
    startCountdown(p, endTs)
    saveState(endTs, { current: p, previous: current, auto, banner: 'Prediction generated successfully!' })
  }

  useEffect(() => {
    // On reload, restore previous state so ongoing activity remains unchanged
    let restored = false
    try {
      const connectedSite = localStorage.getItem('connected.site')
      if (connectedSite) setSiteName(connectedSite)
      const raw = localStorage.getItem('predictions.state')
      if (raw) {
        const data = JSON.parse(raw)
        if (data?.current && typeof data.current.multiplier === 'number') {
          restored = true
          setCurrent(data.current)
          if (data?.previous) setPrevious(data.previous)
          if (typeof data?.auto === 'boolean') setAuto(!!data.auto)
          if (typeof data?.banner === 'string') setBanner(data.banner)
          const endTs: number | null = typeof data?.endTs === 'number' ? data.endTs : null
          // Continue countdown only if it hasn't finished yet
          if (endTs && endTs > Date.now()) {
            startCountdown(data.current as Prediction, endTs)
          } else {
            endRef.current = null
          }
        }
      }
    } catch {}
    // If nothing to restore, initialize a first prediction
    if (!restored) next()
    return () => { if (timerRef.current) window.clearInterval(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist auto toggle changes
  useEffect(() => { saveState() }, [auto, banner, current, previous])

  // Auto mode now advances only when the current prediction erupts (handled in tick)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      // Fit between fixed header (140px top padding in .content) and footer (80px)
      minHeight: 'calc(100vh - 220px)',
      padding: '8px 12px',
      overflowX: 'hidden',
      overflowY: 'auto',
      justifyContent: 'space-between',
      alignItems: 'stretch'
    }}>
      {/* Connected site (left) + centered banner using grid; no overlap */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 8, width: '100%', maxWidth: 760, margin: '0 auto' }}>
        {siteName && (
          <div style={{
            background: '#e0f2fe', border: '2px solid #60a5fa', color: '#1e3a8a',
            borderRadius: 14, padding: '4px 8px', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap'
          }}>
            Connected: {siteName}
          </div>
        )}
        <div style={{
          justifySelf: 'center',
          background: '#d1fae5', border: '2px solid #10b981', color: '#065f46',
          borderRadius: 14, padding: '4px 8px', fontWeight: 700, textAlign: 'center', fontSize: 11, whiteSpace: 'nowrap'
        }}>
          {banner}
        </div>
        {siteName ? (
          <div style={{
            visibility: 'hidden',
            background: '#e0f2fe', border: '2px solid #60a5fa', color: '#1e3a8a',
            borderRadius: 14, padding: '4px 8px', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap'
          }}>
            Connected: {siteName}
          </div>
        ) : <div />}
      </div>

      {/* Top cards */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'stretch', gap: 8, width: '100%', flexWrap: 'wrap' }}>
        <div style={{ background: '#fee2e2', border: '2px solid #fca5a5', borderRadius: 16, padding: '10px', flex: '1 1 260px', maxWidth: 280 }}>
          <div style={{ color: '#7f1d1d', fontSize: 13, textAlign: 'center' }}>Current Prediction</div>
          <div style={{ color: '#be123c', fontSize: 24, fontWeight: 800, textAlign: 'center', marginTop: 6 }}>{current.multiplier.toFixed(2)}x</div>
        </div>
        <div style={{ background: '#fee2e2', border: '2px solid #fca5a5', borderRadius: 16, padding: '10px', flex: '1 1 260px', maxWidth: 280 }}>
          <div style={{ color: '#7f1d1d', fontSize: 13, textAlign: 'center' }}>Previous Prediction</div>
          <div style={{ color: '#be123c', fontSize: 24, fontWeight: 800, textAlign: 'center', marginTop: 6 }}>{previous.multiplier.toFixed(2)}x</div>
        </div>
      </div>

      {/* Center section (ring) */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 0, gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 'clamp(150px, 20vh, 190px)', borderRadius: '50%', aspectRatio: '1 / 1',
          background: 'conic-gradient(from 0deg, #fb7185, #f43f5e, #fb7185)',
          padding: 8
        }}>
          <div style={{ background: '#fff', width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 'clamp(22px, 4.8vh, 34px)', fontWeight: 800, color: '#111827' }}>{current.multiplier.toFixed(2)}x</div>
          </div>
        </div>
      </div>

      {/* Bottom section: Next + Auto toggle inline */}
      <div style={{ marginTop: 'auto', margin: '0 auto 8px', maxWidth: 760, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={next} style={{
          background: '#dc2626', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 18px', fontWeight: 800, fontSize: 18,
          width: 'min(300px, 70vw)', cursor: 'pointer'
        }}>
          Next
        </button>
        <div style={{ background: '#fee2e2', border: '2px solid #fca5a5', borderRadius: 12, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#7f1d1d', fontSize: 12 }}>Auto Prediction:</span>
          <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)} style={{ display: 'none' }} />
            <span style={{ width: 44, height: 26, background: auto? '#9ca3af':'#d1d5db', borderRadius: 13, position: 'relative', transition: 'all 150ms ease' }}>
              <span style={{ position: 'absolute', top: 3, left: auto? 24: 3, width: 20, height: 20, background: '#fff', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 150ms ease' }} />
            </span>
          </label>
        </div>
      </div>

      {/* Reference image removed per request */}
    </div>
  )
}