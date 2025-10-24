type Point = { x: number; y: number; t: number }
type Stroke = Point[]

function clamp(min: number, max: number, v: number) {
  return Math.max(min, Math.min(max, v))
}

export function extractFeatures(strokes: Stroke[]): number[] {
  const allPts = strokes.flat()
  if (allPts.length < 2) return [0, 0, 0, 0, 0, 0, 0, 0]
  let distSum = 0
  let timeSum = 0
  const angles: number[] = []
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.length; i++) {
      const a = stroke[i - 1]
      const b = stroke[i]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dt = Math.max(1, b.t - a.t)
      const d = Math.sqrt(dx * dx + dy * dy)
      distSum += d
      timeSum += dt
      const ang = Math.atan2(dy, dx)
      angles.push(ang)
    }
  }
  const avgSpeed = distSum / Math.max(1, timeSum)
  const meanAng = angles.reduce((s, v) => s + v, 0) / Math.max(1, angles.length)
  const variance = angles.reduce((s, v) => s + Math.pow(v - meanAng, 2), 0) / Math.max(1, angles.length)
  const angleVarNorm = Math.min(1, variance / 1.0)

  let largeTurns = 0
  let turnCount = 0
  for (let i = 1; i < angles.length; i++) {
    const prev = angles[i - 1]
    const curr = angles[i]
    let dAng = curr - prev
    while (dAng > Math.PI) dAng -= 2 * Math.PI
    while (dAng < -Math.PI) dAng += 2 * Math.PI
    if (Math.abs(dAng) > 0.8) largeTurns++
    turnCount++
  }
  const jaggedFreq = turnCount > 0 ? clamp(0, 1, largeTurns / turnCount) : 0

  const axes = [0, Math.PI / 2, -Math.PI / 2, Math.PI, -Math.PI]
  let aligned = 0
  for (const ang of angles) {
    const minDelta = Math.min(
      ...axes.map((ax) => {
        let d = ang - ax
        while (d > Math.PI) d -= 2 * Math.PI
        while (d < -Math.PI) d += 2 * Math.PI
        return Math.abs(d)
      })
    )
    if (minDelta < 0.25) aligned++
  }
  const axisAlign = angles.length > 0 ? clamp(0, 1, aligned / angles.length) : 0

  const strokeLens = strokes.map((s) => s.length)
  const avgLen = strokeLens.reduce((s, v) => s + v, 0) / Math.max(1, strokeLens.length)
  const strokeCount = strokes.length

  const f_speed = clamp(0, 1, avgSpeed * 0.02)
  const f_angle = clamp(0, 1, angleVarNorm)
  const f_len = clamp(0, 1, avgLen / 100)
  const f_count = clamp(0, 1, strokeCount / 8)
  const f_dist = clamp(0, 1, distSum / 2000)
  const f_time = clamp(0, 1, timeSum / 4000)
  const f_jagged = clamp(0, 1, jaggedFreq)
  const f_axis = clamp(0, 1, axisAlign)
  return [f_speed, f_angle, f_len, f_count, f_dist, f_time, f_jagged, f_axis]
}