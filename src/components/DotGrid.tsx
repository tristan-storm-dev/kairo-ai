import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { tabIndicatorColors } from '../theme';

interface DotGridProps {
  rows?: number;
  cols?: number;
  dotSize?: number;
  gap?: number;
  color?: string;
  fps?: number;
  radius?: number;
  amplitude?: number;
  freq?: number;
}

export default function DotGrid({
  rows = 6,
  cols = 6,
  dotSize = 10,
  gap = 10,
  color = '#ffffff',
  fps = 60,
  radius = 2,
  amplitude = 0.35,
  freq = 0.35,
}: DotGridProps) {
  const count = rows * cols;
  const baseColor = color;

  const phaseRef = useRef(0);
  const runningRef = useRef(true);
  const rafIdRef = useRef<number | null>(null);

  const width = cols * dotSize + (cols - 1) * gap;
  const height = rows * dotSize + (rows - 1) * gap;

  const indexAt = (r: number, c: number) => r * cols + c;
  const nowTime = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

  function hexToRgb(hex: string) {
    const h = hex.replace('#', '');
    const bigint = parseInt(h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return { r, g, b };
  }
  function rgbToHex(r: number, g: number, b: number) {
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(Math.round(r))}${toHex(Math.round(g))}${toHex(Math.round(b))}`;
  }

  const stopsRgb = useMemo(() => tabIndicatorColors.map(hexToRgb), []);
  const columnColorsRgb = useMemo(() => {
    if (cols <= 1) return [stopsRgb[0] ?? hexToRgb(baseColor)];
    const out: { r: number; g: number; b: number }[] = new Array(cols);
    for (let c = 0; c < cols; c++) {
      const t = c / (cols - 1);
      const seg = (stopsRgb.length - 1) * Math.max(0, Math.min(1, t));
      const i = Math.floor(seg);
      const frac = seg - i;
      const a = stopsRgb[i];
      const b = stopsRgb[Math.min(i + 1, stopsRgb.length - 1)];
      out[c] = {
        r: a.r + (b.r - a.r) * frac,
        g: a.g + (b.g - a.g) * frac,
        b: a.b + (b.b - a.b) * frac,
      };
    }
    return out;
  }, [cols, stopsRgb, baseColor]);
  const baseRgb = useMemo(() => hexToRgb(baseColor), [baseColor]);

  const [colors, setColors] = useState<string[]>(() => Array.from({ length: count }, () => baseColor));
  const [scales, setScales] = useState<number[]>(() => Array.from({ length: count }, () => 1));
  const colorsBufRef = useRef<string[]>(colors.slice());
  const scalesBufRef = useRef<number[]>(scales.slice());

  useEffect(() => {
    const len = rows * cols;
    setColors(Array.from({ length: len }, () => baseColor));
    setScales(Array.from({ length: len }, () => 1));
    colorsBufRef.current = Array.from({ length: len }, () => baseColor);
    scalesBufRef.current = Array.from({ length: len }, () => 1);
    phaseRef.current = 0;
  }, [rows, cols, baseColor]);

  useEffect(() => {
    runningRef.current = true;
    let last = nowTime();
    let accum = 0;
    const frameInterval = 1 / Math.max(24, Math.min(60, fps));

    const loop = () => {
      if (!runningRef.current) return;
      const now = nowTime();
      const dt = (now - last) / 1000;
      last = now;
      accum += dt;

      phaseRef.current += freq * 2 * Math.PI * dt;

      if (accum >= frameInterval) {
        accum -= frameInterval;
        const mid = (rows - 1) / 2;
        const waveCycles = 1;
        const k = (2 * Math.PI * waveCycles) / (cols > 1 ? cols : 1);

        const maxAmp = ((rows - 1) / 2) - 1;
        const ampBase = Math.min(maxAmp, Math.max(1, amplitude * rows * 0.5));
        const ampNow = ampBase * (1 + 0.25 * Math.sin((now / 1000) * freq * 0.7 * 2 * Math.PI));

        const thickness = Math.max(0.25, radius * 0.35);

        const yCurveCol = new Array(cols);
        for (let c = 0; c < cols; c++) {
          yCurveCol[c] = mid + ampNow * Math.sin(phaseRef.current + c * k);
        }

        const breath = 1 + 0.12 * Math.sin((now / 1000) * freq * 2 * Math.PI);
        const colorsBuf = colorsBufRef.current;
        const scalesBuf = scalesBufRef.current;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const idx = indexAt(r, c);
            const yCurve = yCurveCol[c];
            const distRow = Math.abs(r - yCurve);
            const sigma = thickness * 0.6;
            const tBlend = Math.exp(-(distRow * distRow) / (2 * sigma * sigma));
            const col = columnColorsRgb[c] || baseRgb;
            const rCol = baseRgb.r + (col.r - baseRgb.r) * tBlend;
            const gCol = baseRgb.g + (col.g - baseRgb.g) * tBlend;
            const bCol = baseRgb.b + (col.b - baseRgb.b) * tBlend;
            colorsBuf[idx] = rgbToHex(rCol, gCol, bCol);
            scalesBuf[idx] = 0.98 + 0.18 * tBlend * breath;
          }
        }

        setColors(colorsBuf.slice());
        setScales(scalesBuf.slice());
      }
      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);
    return () => {
      runningRef.current = false;
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
    };
  }, [rows, cols, fps, radius, freq, baseColor, amplitude, columnColorsRgb]);

  const dots: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const left = c * (dotSize + gap);
      const top = r * (dotSize + gap);
      const idx = indexAt(r, c);
      dots.push(
        <View
          key={`${r}-${c}`}
          style={[
            styles.dot,
            {
              left,
              top,
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: colors[idx] || baseColor,
              transform: [{ scale: scales[idx] || 1 }],
            },
          ]}
        />
      );
    }
  }

  return (
    <View style={{ width, height }}>
      {dots}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
  },
});