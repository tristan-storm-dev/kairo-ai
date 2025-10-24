type KickPrediction = {
  label: 'smooth' | 'hard'
  probs: [number, number]
}

import { HUGGINGFACE_API_KEY } from '@env'

export const AI_ENDPOINT = 'https://api-inference.huggingface.co/models/facebook/bart-large-mnli'

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

function featuresToText(f: number[]) {
  const speed = f[0] || 0
  const angleVar = f[1] || 0
  const avgLen = f[2] || 0
  const jagged = f[6] || 0
  const axis = f[7] || 0
  const speedTag = speed > 0.6 ? 'fast' : speed > 0.3 ? 'medium' : 'slow'
  let shapeTag = 'rounded wave-like'
  if (axis > 0.55) shapeTag = 'square and blocky, axis-aligned'
  else if (jagged > 0.6 && angleVar > 0.6) shapeTag = 'sharp with saw-like edges'
  const lengthTag = avgLen > 0.4 ? 'long' : avgLen > 0.2 ? 'medium' : 'short'
  return `the drawing looks ${shapeTag}, ${lengthTag}, and ${speedTag}. choose one: smooth kick or hard kick.`
}

function computePriors(f: number[]) {
  const speed = f[0] || 0
  const angleVar = f[1] || 0
  const dist = f[4] || 0
  const jagged = f[6] || 0
  const axis = f[7] || 0
  const smoothPrior = clamp01((1 - jagged) * (1 - axis) * (1 - 0.6 * angleVar) * (1 - 0.3 * speed))
  const hardPrior = clamp01(axis * (0.4 + 0.6 * dist) + 0.5 * jagged * angleVar)
  const sum = smoothPrior + hardPrior || 1
  return {
    smooth: smoothPrior / sum,
    hard: hardPrior / sum,
  }
}

export async function analyzeKickRemote(features: number[]): Promise<KickPrediction> {
  const text = featuresToText(features)
  const priors = computePriors(features)
  const response = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: text,
      parameters: {
        candidate_labels: ['smooth kick', 'hard kick'],
        multi_label: false,
      },
    }),
  })
  const raw = await response.text()
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${raw}`)
  let data: any
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error(`Invalid JSON: ${raw.slice(0, 160)}`)
  }
  const labels: string[] = data?.labels || []
  const scores: number[] = data?.scores || []
  if (!Array.isArray(labels) || !Array.isArray(scores) || labels.length !== scores.length || labels.length === 0)
    throw new Error('Unexpected HF response shape')
  const idxSmooth = labels.findIndex((l) => l.toLowerCase().includes('smooth'))
  const idxHard = labels.findIndex((l) => l.toLowerCase().includes('hard'))
  const smoothHF = idxSmooth >= 0 ? clamp01(scores[idxSmooth]) : 0.5
  const hardHF = idxHard >= 0 ? clamp01(scores[idxHard]) : 0.5
  let smooth = smoothHF * (0.2 + 0.8 * priors.smooth)
  let hard = hardHF * (0.2 + 0.8 * priors.hard)
  const sum = smooth + hard || 1
  const probs: [number, number] = [smooth / sum, hard / sum]
  const maxIdx = probs.indexOf(Math.max(...probs))
  const label: 'smooth' | 'hard' = maxIdx === 0 ? 'smooth' : 'hard'
  return { label, probs }
}
