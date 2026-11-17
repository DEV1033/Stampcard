import { getFontEmbedCSS, toCanvas } from 'html-to-image'
import { getTurnRegion } from './PageTurn.jsx'

let fontCSS = null // web fonts inlined once, then reused for every snapshot

// Snapshot of what's on screen in the turn region, as a canvas, to print on
// the turning page: white paper, the pixel background, then the page content.
// Videos come from another site that doesn't allow reading their frames, so
// they're drawn as a solid panel in their `data-tone` colour instead.
export async function captureRegion(contentEl) {
  const region = getTurnRegion()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const out = document.createElement('canvas')
  out.width = Math.round(region.width * dpr)
  out.height = Math.round(region.height * dpr)
  const ctx = out.getContext('2d')
  ctx.scale(dpr, dpr)
  ctx.translate(-region.left, -region.top) // draw in viewport coordinates
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(region.left, region.top, region.width, region.height)

  drawPixelField(ctx)

  if (fontCSS === null) {
    try {
      fontCSS = await getFontEmbedCSS(contentEl)
    } catch {
      fontCSS = ''
    }
  }
  const rect = contentEl.getBoundingClientRect()
  const content = await toCanvas(contentEl, {
    pixelRatio: dpr,
    fontEmbedCSS: fontCSS || undefined,
    skipAutoScale: true,
    filter: (node) => node.tagName !== 'VIDEO',
  })
  ctx.drawImage(content, rect.left, rect.top, rect.width, content.height / dpr)

  for (const video of contentEl.querySelectorAll('video')) {
    const r = video.getBoundingClientRect()
    ctx.fillStyle = video.dataset.tone || '#e5e7eb'
    ctx.beginPath()
    ctx.roundRect(r.left, r.top, r.width, r.height, 10)
    ctx.fill()
  }
  return out
}

// The fixed pixel background, faded out towards the top like on the page.
function drawPixelField(ctx) {
  const field = document.querySelector('[data-pixel-field] canvas')
  if (!field) return
  const r = field.getBoundingClientRect()
  if (!r.width || !r.height) return
  const tmp = document.createElement('canvas')
  tmp.width = field.width
  tmp.height = field.height
  const t = tmp.getContext('2d')
  t.drawImage(field, 0, 0)
  t.globalCompositeOperation = 'destination-in'
  const g = t.createLinearGradient(0, tmp.height, 0, 0)
  g.addColorStop(0, 'rgba(0,0,0,1)')
  g.addColorStop(0.6, 'rgba(0,0,0,1)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  t.fillStyle = g
  t.fillRect(0, 0, tmp.width, tmp.height)
  ctx.drawImage(tmp, r.left, r.top, r.width, r.height)
}
