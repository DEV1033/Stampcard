// Mechanical key sounds synthesised with Web Audio (no audio files).
// Browsers only allow audio after a user gesture, so call unlockSound() from one.

let ctx
let master
let noise

const BIG = new Set(['del', 'enter', 'shiftL', 'shiftR', 'tab', 'caps', 'ctrl', 'ctrlR', 'alt', 'altR', 'fn', 'fnR', '\\'])

export function unlockSound() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return false
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.55
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 4
    master.connect(comp).connect(ctx.destination)
    // Half a second of white noise, reused at random offsets.
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') ctx.resume()
  return true
}

export const soundReady = () => !!ctx && ctx.state === 'running'

function burst(t, type, freq, q, gain, decay) {
  const src = ctx.createBufferSource()
  src.buffer = noise
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.0015)
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  src.connect(f).connect(g).connect(master)
  src.start(t, Math.random() * 0.4)
  src.stop(t + decay + 0.02)
}

function body(t, freq, gain, decay) {
  const o = ctx.createOscillator()
  o.type = 'triangle'
  o.frequency.setValueAtTime(freq, t)
  o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + decay)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + decay + 0.02)
}

// One key stroke: bright click + low thock on the way down, a softer click on release.
export function playKey(id) {
  if (!soundReady()) return
  const t = ctx.currentTime + 0.005
  const r = 0.92 + Math.random() * 0.16
  const space = id === 'space'
  const big = space || BIG.has(id)

  burst(t, 'bandpass', (big ? 2600 : 3600) * r, 1.4, big ? 0.5 : 0.6, 0.018)
  burst(t, 'lowpass', (big ? 700 : 1100) * r, 0.8, big ? 0.75 : 0.55, big ? 0.07 : 0.045)
  body(t, (space ? 120 : big ? 170 : 240) * r, big ? 0.32 : 0.22, space ? 0.11 : 0.06)
  if (space) burst(t + 0.009, 'bandpass', 1800 * r, 2, 0.25, 0.03) // stabiliser rattle

  const up = t + 0.13 + Math.random() * 0.02
  burst(up, 'bandpass', (big ? 2200 : 3000) * r, 1.6, 0.18, 0.015)
  burst(up, 'lowpass', 900 * r, 0.8, 0.16, 0.03)
}
