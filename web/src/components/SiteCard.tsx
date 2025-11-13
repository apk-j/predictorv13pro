import React, { useState } from 'react'
import type { Site } from '../data/sites'
import { logoUrlFor } from '../data/siteLogos'

type Props = {
  site: Site
  selected?: boolean
  onClick?: () => void
}

export const SiteCard: React.FC<Props> = ({ site, selected, onClick }) => {
  const logo = logoUrlFor(site.id)
  const [imgOk, setImgOk] = useState(true)
  const [bgColor, setBgColor] = useState<string | undefined>(undefined)
  const WHITE_BG_IDS = new Set([
    'wezabet',
    'betfalme',
    'hakibets',
    'bangbet',
    '4rabet',
    'sportpesa',
    // Requested sites to force white backgrounds (base IDs)
    'betnaija',
    'bet9ja',
    '10bet',
    'stake',
    'roobet'
  ])
  // Explicit card background overrides (useful for white logo variants)
  const BG_OVERRIDES: Record<string, string> = {
    // Brand colors
    'betnaija-white': '#0b8f2a',
    'bet9ja-white': '#0b8f2a',
    'premierbet-white': '#008a3b',
    // Requested override: Premier Bet grey background
    'premierbet': '#cccccc',
    '10bet-white': '#111111',
    '10bets-white': '#111111',
    'stake-white': '#0b1026',
    'stake.com-white': '#0b1026',
    'roobet-white': '#c19a3d'
  }
  const bgOverride = BG_OVERRIDES[site.id]
  return (
    <div
      onClick={onClick}
      className={`site-card ${(site.dark && !WHITE_BG_IDS.has(site.id) && !BG_OVERRIDES[site.id]) ? 'site-card--dark' : ''} ${
        selected ? 'site-card--selected' : ''
      }`}
      style={{ backgroundColor: bgOverride || (WHITE_BG_IDS.has(site.id) ? '#ffffff' : bgColor) }}
      role="button"
    >
      <span className="site-name">{site.name}</span>
      {site.label && selected && (
        <span className="badge">{site.label}</span>
      )}
      <div className="site-logo">
        {logo && imgOk ? (
          <img
            className="site-logo-img"
            src={logo}
            alt={site.name}
            crossOrigin="anonymous"
            onError={() => setImgOk(false)}
            onLoad={(e) => {
              try {
                const img = e.currentTarget
                const W = 64, H = 64
                const canvas = document.createElement('canvas')
                canvas.width = W; canvas.height = H
                const ctx = canvas.getContext('2d')
                if (!ctx) return
                ctx.drawImage(img, 0, 0, W, H)
                const data = ctx.getImageData(0, 0, W, H).data

                // Sample the edges (border) to capture the image background color
                const border = Math.max(3, Math.floor(Math.min(W, H) * 0.08))
                const hist = new Map<string, { r: number; g: number; b: number; c: number }>()
                const quant = (r: number, g: number, b: number) => `${Math.round(r / 12)}-${Math.round(g / 12)}-${Math.round(b / 12)}`

                for (let y = 0; y < H; y++) {
                  for (let x = 0; x < W; x++) {
                    if (x < border || x >= W - border || y < border || y >= H - border) {
                      const i = 4 * (y * W + x)
                      const a = data[i + 3]
                      if (a < 128) continue
                      const r = data[i], g = data[i + 1], b = data[i + 2]
                      const key = quant(r, g, b)
                      const e = hist.get(key) || { r: 0, g: 0, b: 0, c: 0 }
                      e.r += r; e.g += g; e.b += b; e.c++
                      hist.set(key, e)
                    }
                  }
                }

                let bg: { r: number; g: number; b: number } | null = null
                if (hist.size > 0) {
                  let bestKey = ''
                  let bestCount = -1
                  for (const [k, v] of hist) {
                    if (v.c > bestCount) { bestCount = v.c; bestKey = k }
                  }
                  const v = hist.get(bestKey)!
                  bg = { r: Math.round(v.r / v.c), g: Math.round(v.g / v.c), b: Math.round(v.b / v.c) }
                }

                // Fallback: global majority color (quantized) if edges didn’t yield a color
                if (!bg) {
                  const hist2 = new Map<string, { r: number; g: number; b: number; c: number }>()
                  for (let i = 0; i < data.length; i += 4) {
                    const a = data[i + 3]
                    if (a < 128) continue
                    const r = data[i], g = data[i + 1], b = data[i + 2]
                    const key = quant(r, g, b)
                    const e = hist2.get(key) || { r: 0, g: 0, b: 0, c: 0 }
                    e.r += r; e.g += g; e.b += b; e.c++
                    hist2.set(key, e)
                  }
                  if (hist2.size > 0) {
                    let bestKey = ''
                    let bestCount = -1
                    for (const [k, v] of hist2) {
                      if (v.c > bestCount) { bestCount = v.c; bestKey = k }
                    }
                    const v = hist2.get(bestKey)!
                    bg = { r: Math.round(v.r / v.c), g: Math.round(v.g / v.c), b: Math.round(v.b / v.c) }
                  }
                }

                if (bg) setBgColor(`rgb(${bg.r}, ${bg.g}, ${bg.b})`)
              } catch {}
            }}
          />
        ) : (
          site.name
        )}
      </div>
    </div>
  )
}