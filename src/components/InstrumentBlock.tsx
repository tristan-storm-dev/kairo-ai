import React from 'react'
import { View, StyleSheet, Pressable } from 'react-native'
import { tabIndicatorColors } from '../theme'

export type BlockState = 'empty' | 'ready' | 'active' | 'paused'

interface InstrumentBlockProps {
  state: BlockState
  size: number
  rows?: number
  cols?: number
  flashOn?: boolean
  onPress?: () => void
  onLongPress?: () => void
}

export default function InstrumentBlock({ state, size, rows = 7, cols = 7, flashOn = false, onPress, onLongPress }: InstrumentBlockProps) {
  const GAP_RATIO = 0.6
  const A = cols + (cols - 1) * GAP_RATIO
  const dotSize = size / A
  const gap = dotSize * GAP_RATIO
  const width = size
  const height = rows * dotSize + (rows - 1) * gap
  const centerR = Math.floor(rows / 2)
  const centerC = Math.floor(cols / 2)

  const isActive = state === 'active'
  const isReady = state === 'ready'
  const isPaused = state === 'paused'

  const baseColor = isActive ? (flashOn ? '#ffffff' : tabIndicatorColors[1]) : isReady ? '#ffffff' : '#dcdcdc'

  const dots: React.ReactNode[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const left = c * (dotSize + gap)
      const top = r * (dotSize + gap)

      let bg = baseColor
      let scale = 1

      if (isActive) {
        if (!flashOn) {
          const t = c / (cols - 1)
          const color = blend(tabIndicatorColors[0], tabIndicatorColors[1], t)
          bg = color
          scale = 1 + 0.08 * Math.sin((r + c) * 0.7)
        }
      } else if (isReady) {
        const inVerticalArm = c === centerC && Math.abs(r - centerR) <= 1
        const inHorizontalArm = r === centerR && Math.abs(c - centerC) <= 1
        const inPlus = inVerticalArm || inHorizontalArm
        if (inPlus) {
          const t = inVerticalArm ? r / (rows - 1) : c / (cols - 1)
          bg = blend(tabIndicatorColors[0], tabIndicatorColors[1], t)
          scale = 1.2
        } else {
          bg = '#eeeeee'
        }
      } else if (isPaused) {
        bg = '#e5e5e5'
      }

      dots.push(
        <View
          key={`${r}-${c}`}
          style={[styles.dot, { left, top, width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: bg, transform: [{ scale }] }]} />
      )
    }
  }

  const opacity = isActive ? 1 : isReady ? 0.95 : 0.18

  return (
    <Pressable style={[styles.wrap, { width, height, opacity }]} onPress={onPress} onLongPress={onLongPress} android_ripple={{ color: '#ccc' }}>
      {dots}
    </Pressable>
  )
}

function blend(a: string, b: string, t: number) {
  const ar = parseInt(a.slice(1, 3), 16)
  const ag = parseInt(a.slice(3, 5), 16)
  const ab = parseInt(a.slice(5, 7), 16)
  const br = parseInt(b.slice(1, 3), 16)
  const bg = parseInt(b.slice(3, 5), 16)
  const bb = parseInt(b.slice(5, 7), 16)
  const rr = Math.round(ar + (br - ar) * t)
  const rg = Math.round(ag + (bg - ag) * t)
  const rb = Math.round(ab + (bb - ab) * t)
  return `#${hex2(rr)}${hex2(rg)}${hex2(rb)}`
}

function hex2(n: number) {
  return (n < 16 ? '0' : '') + n.toString(16)
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', borderWidth: 0, borderRadius: 0, overflow: 'hidden', backgroundColor: 'transparent' },
  dot: { position: 'absolute' },
})