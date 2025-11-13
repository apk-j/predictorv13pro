import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

const svgPath = path.resolve('public/bettingsites/logo.svg')
const outDir = path.resolve('public/icons')
const brand = '#ff0033'
const marginRatio = 0.10 // 10% safe margin

async function ensureDir(p) { await fs.promises.mkdir(p, { recursive: true }) }

async function renderIcon(size, name) {
  const margin = Math.round(size * marginRatio)
  const target = size - 2 * margin
  const canvas = await sharp({ create: { width: size, height: size, channels: 4, background: brand } })
    .png()
    .toBuffer()

  const logoBuf = await sharp(svgPath)
    .resize({ width: target, height: target, fit: 'inside' })
    .png()
    .toBuffer()

  const x = margin
  const y = margin
  const outPath = path.join(outDir, name)
  await sharp(canvas)
    .composite([{ input: logoBuf, left: x, top: y }])
    .png()
    .toFile(outPath)
  console.log('Rendered', outPath)
}

async function main() {
  if (!fs.existsSync(svgPath)) { throw new Error('SVG logo not found at ' + svgPath) }
  await ensureDir(outDir)
  await renderIcon(16, 'icon-16.png')
  await renderIcon(32, 'icon-32.png')
  await renderIcon(180, 'apple-touch-icon.png')
  await renderIcon(192, 'icon-192.png')
  await renderIcon(512, 'icon-512.png')
  await renderIcon(192, 'icon-192-maskable.png')
  await renderIcon(512, 'icon-512-maskable.png')
}

main().catch(err => { console.error(err); process.exit(1) })