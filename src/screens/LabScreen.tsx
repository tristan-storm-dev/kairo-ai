import React, { useMemo, useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Platform, PanResponder, Pressable, Animated, Easing, Dimensions, ScrollView } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { theme, fontFamilyBody, tabIndicatorColors } from '../theme'
import { extractFeatures } from '../ai/features'
import { analyzeKickRemote, AI_ENDPOINT } from '../ai/client'
import InstrumentBlock, { BlockState } from '../components/InstrumentBlock'

import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'

export default function LabScreen() {
  const [strokes, setStrokes] = useState<Array<Array<{ x: number; y: number; t: number }>>>([])
  const [currentStroke, setCurrentStroke] = useState<Array<{ x: number; y: number; t: number }>>([])

  const [loading, setLoading] = useState<boolean>(false)
  const [pendingLabel, setPendingLabel] = useState<'smooth' | 'hard' | null>(null)
  const [slots, setSlots] = useState<Array<{ state: BlockState; label?: 'smooth' | 'hard' | null }>>(
    Array.from({ length: 6 }, (_, i) => ({ state: i === 0 ? 'ready' : 'empty', label: null }))
  )
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [gridW, setGridW] = useState(0)

  const [columnW, setColumnW] = useState(0)
  const [bpm] = useState(120)
  const [beatToggle, setBeatToggle] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recBlink, setRecBlink] = useState(false)
  const [showRecordingUI, setShowRecordingUI] = useState(false)
  const recAnimOpacity = useRef(new Animated.Value(0)).current
  const recAnimY = useRef(new Animated.Value(-6)).current
  const thinkPulse = useRef(new Animated.Value(0)).current
  const insets = useSafeAreaInsets()
  const [showPad, setShowPad] = useState(false)
  const screenH = Dimensions.get('window').height
  const mainY = useRef(new Animated.Value(0)).current
  const panelY = useRef(new Animated.Value(screenH)).current

  const instruments = ['kick', 'hat', 'synth', 'bass', 'pad']
  const [selectedInstrument, setSelectedInstrument] = useState<string>(instruments[0])

  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; id: number }>>([])
  const [aiTypingText, setAiTypingText] = useState('')
  const [aiTargetText, setAiTargetText] = useState('')
  const [aiTyping, setAiTyping] = useState(false)
  const chatScrollRef = useRef<ScrollView>(null)
  const CONTENT_PAD = 16


  useEffect(() => {
    if (chatScrollRef.current) {
      setTimeout(() => {
        chatScrollRef.current?.scrollTo({ y: 999999, animated: true })
      }, 150)
    }
  }, [messages, loading, aiTyping, aiTypingText])

  useEffect(() => {
    setMessages([])
    setAiTyping(false)
    setAiTypingText('')
    setAiTargetText('')
  }, [selectedInstrument])

  const handleHaptic = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {})
    }
  }

  useEffect(() => {
    const ms = Math.max(150, Math.round(60000 / Math.max(40, Math.min(240, bpm))))
    const id = setInterval(() => setBeatToggle((t) => !t), ms)
    return () => clearInterval(id)
  }, [bpm])

  useEffect(() => {
    if (!aiTyping || !aiTargetText) return
    let i = 0
    const interval = setInterval(() => {
      i += 1
      setAiTypingText(aiTargetText.slice(0, i))
      if (i >= aiTargetText.length) {
        clearInterval(interval)
        setAiTyping(false)
        setMessages((prev) => [...prev, { sender: 'ai', text: aiTargetText, id: Date.now() }])
      }
    }, 30)
    return () => clearInterval(interval)
  }, [aiTyping, aiTargetText])
  useEffect(() => {
    let id: any
    if (recording) {
      setShowRecordingUI(true)
      id = setInterval(() => setRecBlink((t) => !t), 600)
      recAnimOpacity.setValue(0)
      recAnimY.setValue(-6)
      Animated.parallel([
        Animated.timing(recAnimOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(recAnimY, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start()
    } else {
      setRecBlink(false)
      Animated.parallel([
        Animated.timing(recAnimOpacity, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(recAnimY, { toValue: -6, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setShowRecordingUI(false)
      })
    }
    return () => { if (id) clearInterval(id) }
  }, [recording])

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null
    if (loading) {
      thinkPulse.setValue(0)
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(thinkPulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
          Animated.timing(thinkPulse, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        ])
      )
      loop.start()
    }
    return () => { loop?.stop?.() }
  }, [loading])
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent as any
          const t = Date.now()
          setCurrentStroke([{ x: locationX, y: locationY, t }])
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent as any
          const t = Date.now()
          setCurrentStroke((prev) => [...prev, { x: locationX, y: locationY, t }])
        },
        onPanResponderRelease: () => {
          setStrokes((prev) => (currentStroke.length > 0 ? [...prev, currentStroke] : prev))
          setCurrentStroke([])
        },
        onPanResponderTerminate: () => {
          setStrokes((prev) => (currentStroke.length > 0 ? [...prev, currentStroke] : prev))
          setCurrentStroke([])
        },
      }),
    [currentStroke]
  )

  const clearPad = () => {
    setStrokes([])
    setCurrentStroke([])
  }


  const openPad = () => {
    setShowPad(true)
    panelY.setValue(screenH)
    Animated.parallel([
      Animated.timing(mainY, {
        toValue: -screenH,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(panelY, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()
  }
  const closePad = () => {
    Animated.parallel([
      Animated.timing(mainY, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(panelY, {
        toValue: screenH,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setShowPad(false)
        setEditingIndex(null)
      }
    })
  }

  const analyzeKick = async () => {
    const feats = extractFeatures(strokes)
    const userMsg = `analyze ${selectedInstrument}`
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg, id: Date.now() }])
    if (feats.every((v) => v === 0)) {
      setLoading(false)
      setPendingLabel(null)
      setMessages((prev) => [...prev, { sender: 'ai', text: 'draw a bit more to analyze', id: Date.now() }])
      return
    }
    setLoading(true)
    setPendingLabel(null)
    try {
      const pred = await analyzeKickRemote(feats)
      const label = pred.label === 'smooth' ? 'smooth' : 'hard'
      setPendingLabel(label)
      const reply = `it seems like you're going for a ${label} ${selectedInstrument}`
      setAiTypingText('')
      setAiTargetText(reply)
      setAiTyping(true)
    } catch (e: any) {
      const msg = AI_ENDPOINT ? (e?.message || 'AI error') : 'configure AI endpoint in src/ai/client.ts'
      setMessages((prev) => [...prev, { sender: 'ai', text: msg, id: Date.now() }])
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = () => {
    if (editingIndex != null && pendingLabel) {
      setSlots((prev) => {
        const next = [...prev]
        next[editingIndex] = { state: 'active', label: pendingLabel }
        const nextEmpty = next.findIndex((s, idx) => s.state === 'empty' && idx > editingIndex!)
        if (nextEmpty >= 0) next[nextEmpty] = { ...next[nextEmpty], state: 'ready' }
        return next
      })
      clearPad()
      setPendingLabel(null)
      closePad()
    }
  }

  const handleRedraw = () => {
    clearPad()
    setPendingLabel(null)
    setMessages((prev) => [...prev, { sender: 'ai', text: "okay, let's try that again", id: Date.now() }])
  }

  const onBlockPress = (i: number) => {
    handleHaptic()
    const slot = slots[i]
    if (slot.state === 'ready') {
      setEditingIndex(i)
      clearPad()
      openPad()
      return
    }
    setSlots((prev) => {
      const next = [...prev]
      if (prev[i].state === 'active') {
        next[i] = { ...prev[i], state: 'paused' }
      } else if (prev[i].state === 'paused') {
        next[i] = { ...prev[i], state: 'active' }
      }
      return next
    })
  }

  const onBlockLongPress = (i: number) => {
    handleHaptic()
    setSlots((prev) => {
      const next = [...prev]
      next[i] = { state: 'empty', label: null }
      if (!next.some((s) => s.state === 'ready')) {
        const idx = next.findIndex((s) => s.state === 'empty')
        if (idx >= 0) next[idx] = { state: 'ready', label: null }
      }
      return next
    })
  }

  const resetGrid = () => {
    setSlots(Array.from({ length: 6 }, (_, i) => ({ state: i === 0 ? 'ready' : 'empty', label: null })))
  }

  
  const handleReset = () => { handleHaptic(); resetGrid() }
  const handleRecord = () => {
    handleHaptic()
    setRecording((prev) => !prev)
  }


  const GAP_RATIO = 0.6
const GRID_PAD_RATIO = 0.03
  const candidateCols = [7, 6, 5, 4]
  const candidateRows = [7, 6, 5, 4]

function chooseGrid() {
  const pad = Math.max(0, ((columnW || gridW) * GRID_PAD_RATIO))
  const colW = Math.max(0, (columnW || gridW) - 2 * pad)
     if (colW <= 0) {
       const cols = 7, rows = 7
       const A = cols + (cols - 1) * GAP_RATIO
       const blockW = 160
       const dotSize = blockW / A
       const outerGap = dotSize * GAP_RATIO
       return { cols, rows, A, blockW_w: blockW, blockW_h: blockW, blockW, dotSize, outerGap }
     }
     
     for (const cols of candidateCols) {
       const A = cols + (cols - 1) * GAP_RATIO
      const usableW = Math.max(0, colW)
       const blockW_w = (usableW / (2 * A + 1 * GAP_RATIO)) * A
       const rows = candidateRows[0]
       const blockW = blockW_w
       const dotSize = blockW / A
       const outerGap = dotSize * GAP_RATIO
       return { cols, rows, A, blockW_w, blockW_h: blockW_w, blockW, dotSize, outerGap }
     }
     
     const cols = candidateCols[candidateCols.length - 1]
     const rows = candidateRows[candidateRows.length - 1]
     const A = cols + (cols - 1) * GAP_RATIO
    const blockW = Math.max(1, (Math.max(0, colW) / (2 * A + GAP_RATIO)) * A)
     const dotSize = Math.max(1, blockW / A)
     const outerGap = dotSize * GAP_RATIO
     return { cols, rows, A, blockW_w: blockW, blockW_h: blockW, blockW, dotSize, outerGap }
   }

  const gridChoice = chooseGrid()
  const COLS = gridChoice.cols
  const rowsChoice = gridChoice.rows
  
  const blockW = gridChoice.blockW
  const outerGap = gridChoice.outerGap

  const allStrokes = [...strokes, currentStroke] as Array<Array<{ x: number; y: number }>>

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: insets.bottom + 8 }]} edges={['top', 'bottom']}>
      <Animated.View style={[styles.screenWrap, { transform: [{ translateY: mainY }] }]}>
        <View style={[styles.topContainer, { paddingHorizontal: CONTENT_PAD }]}>          
          <View style={styles.controlStrokeWrap} onLayout={(e) => setColumnW(e.nativeEvent.layout.width)}>
            <View style={styles.strokeGradientWrap}>
              <LinearGradient
                colors={tabIndicatorColors as unknown as readonly [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.strokeGradientFill}
              />
            </View>
            <View style={styles.controlPanel}>
              <View style={styles.controlRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={styles.title}>lab</Text>
                  {showRecordingUI && (
                    <Animated.View style={[styles.recordingWrap, { opacity: recAnimOpacity, transform: [{ translateY: recAnimY }] }]}>
                      <View style={[styles.recordDot, { opacity: recBlink ? 1 : 0.35 }]} />
                      <Text style={styles.recordingText}>recording</Text>
                    </Animated.View>
                  )}
                </View>
                <View style={styles.controlRight}>
                  <Pressable style={({ pressed }) => [styles.ctrlBtn, pressed && styles.ctrlBtnPressed]} onPress={handleReset}>
                    <Feather name="rotate-ccw" size={20} color={theme.fg} />
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.ctrlBtn, recording && styles.ctrlBtnRecordActive, pressed && styles.ctrlBtnPressed]}
                    onPress={handleRecord}
                  >
                    <Svg width={22} height={22} viewBox="0 0 40 40">
                      <Path
                        d="M20 6 A14 14 0 1 1 19.999 6"
                        stroke={recording ? '#ffffff' : '#E53935'}
                        strokeWidth={3}
                        fill={recording ? 'rgba(174,21,33,0.35)' : 'none'}
                      />
                    </Svg>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View
          style={[styles.gridContainer, { paddingHorizontal: Math.max(0, ((columnW || gridW) * GRID_PAD_RATIO)) }]}
          onLayout={(e) => {
            const { width } = e.nativeEvent.layout
            setGridW(width)
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: outerGap }}>
            {[0,1].map((i, idx) => (
              <View key={i} style={{ width: blockW, marginRight: idx === 0 ? outerGap : 0 }}>
                <InstrumentBlock
                  state={slots[i].state}
                  size={blockW}
                  flashOn={beatToggle}
                  rows={rowsChoice}
                  cols={COLS}
                  onPress={() => onBlockPress(i)}
                  onLongPress={() => onBlockLongPress(i)}
                />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: outerGap }}>
            {[2,3].map((i, idx) => (
              <View key={i} style={{ width: blockW, marginRight: idx === 0 ? outerGap : 0 }}>
                <InstrumentBlock
                  state={slots[i].state}
                  size={blockW}
                  flashOn={beatToggle}
                  rows={rowsChoice}
                  cols={COLS}
                  onPress={() => onBlockPress(i)}
                  onLongPress={() => onBlockLongPress(i)}
                />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
            {[4,5].map((i, idx) => (
              <View key={i} style={{ width: blockW, marginRight: idx === 0 ? outerGap : 0 }}>
                <InstrumentBlock
                  state={slots[i].state}
                  size={blockW}
                  flashOn={beatToggle}
                  rows={rowsChoice}
                  cols={COLS}
                  onPress={() => onBlockPress(i)}
                  onLongPress={() => onBlockLongPress(i)}
                />
              </View>
            ))}
          </View>
        </View>

        
      </Animated.View>
      
      {showPad && (
        <Animated.View style={[styles.padPanel, { transform: [{ translateY: panelY }] }]}>          
          <SafeAreaView style={{ flex: 1 }}>
            <View style={[styles.topContainer, { paddingHorizontal: CONTENT_PAD }]}>          
              <View style={styles.controlPanel}>
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <Pressable
                    style={styles.chevronWrap}
                    onPress={closePad}
                    hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
                  >
                    <Feather name="chevron-down" size={28} color={theme.fg} />
                  </Pressable>
                </View>
              </View>
            </View>
            <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <View style={styles.instrumentRow}>
                {instruments.map((inst) => (
                  selectedInstrument === inst ? (
                    <Pressable key={inst} style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]} onPress={() => setSelectedInstrument(inst)}>
                      <Text style={styles.btnPrimaryText}>{inst}</Text>
                    </Pressable>
                  ) : (
                    <Pressable key={inst} style={({ pressed }) => [styles.btnGrey, pressed && styles.btnPressed]} onPress={() => setSelectedInstrument(inst)}>
                      <Text style={styles.btnGreyText}>{inst}</Text>
                    </Pressable>
                  )
                ))}
              </View>
              <View style={styles.padStrokeWrap}>
                <View style={[styles.strokeGradientWrap, { borderRadius: 12 }]}> 
                  <LinearGradient
                    colors={tabIndicatorColors as unknown as readonly [string, string, ...string[]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.strokeGradientFill, { borderRadius: 12 }]}
                  />
                </View>
                <View style={styles.padWrap}>              
                  <View style={styles.pad} {...panResponder.panHandlers}>
                    <Svg style={{ flex: 1 }}>
                      {allStrokes.map((s, idx) => (
                        <Path key={idx} d={renderPath(s)} stroke="#fff" strokeWidth={2} fill="none" />
                      ))}
                    </Svg>
                  </View>
                </View>
              </View>
                <View style={styles.chatWrap}>
                  <ScrollView ref={chatScrollRef} style={styles.chatScrollView} showsVerticalScrollIndicator={false}>
                    <View style={styles.chatContent}>
                      {messages.map((m) => (
                        m.sender === 'user' ? (
                          <View key={m.id} style={styles.bubbleUser}>
                            <Text style={styles.bubbleUserText}>{m.text}</Text>
                          </View>
                        ) : (
                          <View key={m.id} style={styles.bubbleAI}>
                            <Text style={styles.bubbleAIText}>{m.text}</Text>
                          </View>
                        )
                      ))}
                      {loading ? (
                        <View style={styles.bubbleAI}>
                          <Text style={styles.bubbleAIText}>thinking…</Text>
                          <Animated.View style={[styles.thinkDot, { opacity: thinkPulse, transform: [{ scale: thinkPulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.08] }) }] }]} />
                        </View>
                      ) : null}
                      {aiTyping ? (
                        <View style={styles.bubbleAI}>
                          <Text style={styles.bubbleAIText}>{aiTypingText}</Text>
                        </View>
                      ) : null}
                    </View>
                  </ScrollView>
                </View>
                <View style={styles.chatComposer}>
                  <Pressable style={({ pressed }) => [styles.btnGhostWrap, pressed && styles.btnPressed]} onPress={analyzeKick} disabled={loading}>
                    <View style={[styles.strokeGradientWrap, { borderRadius: 999 }]}> 
                      <LinearGradient
                        colors={tabIndicatorColors as unknown as readonly [string, string, ...string[]]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.strokeGradientFill, { borderRadius: 999 }]}
                      />
                    </View>
                    <View style={styles.btnGhostInner}>
                      <Text style={styles.btnGhostText}>{loading ? 'analyzing' : 'analyze'}</Text>
                    </View>
                  </Pressable>
                  {pendingLabel ? (
                    <Pressable style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]} onPress={handleAccept}>
                      <Text style={styles.btnPrimaryText}>accept</Text>
                    </Pressable>
                  ) : null}
                  {pendingLabel ? (
                    <Pressable style={({ pressed }) => [styles.btnGhostWrap, pressed && styles.btnPressed]} onPress={handleRedraw}>
                      <View style={[styles.strokeGradientWrap, { borderRadius: 999 }]}> 
                        <LinearGradient
                          colors={tabIndicatorColors as unknown as readonly [string, string, ...string[]]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[styles.strokeGradientFill, { borderRadius: 999 }]}
                        />
                      </View>
                      <View style={styles.btnGhostInner}>
                        <Text style={styles.btnGhostText}>redraw</Text>
                      </View>
                    </Pressable>
                  ) : null}
                </View>
            </View>
          </SafeAreaView>
        </Animated.View>
      )}
    </SafeAreaView>
  )
}

const renderPath = (stroke: Array<{ x: number; y: number }>) => {
  if (stroke.length < 2) return ''
  let d = `M ${stroke[0].x} ${stroke[0].y}`
  for (let i = 1; i < stroke.length; i++) {
    d += ` L ${stroke[i].x} ${stroke[i].y}`
  }
  return d
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 0,
    gap: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: Platform.OS === 'web' ? 18 : 20,
    textTransform: 'lowercase',
    fontFamily: fontFamilyBody,
    letterSpacing: 1,
  },
  gridWrap: { width: '100%' },
  screenWrap: { width: '100%', flex: 1, alignItems: 'center' },
  topContainer: { width: '100%', maxWidth: 720, paddingBottom: 12 },
  gridContainer: { width: '100%', maxWidth: 720 },
  tempoContainer: { alignItems: 'center', width: '100%', maxWidth: 720, paddingTop: 12, paddingBottom: 18 },
  controlStrokeWrap: { borderRadius: 999, overflow: 'hidden', position: 'relative', padding: 2, marginBottom: 12 },
  strokeGradientWrap: { ...StyleSheet.absoluteFillObject, borderRadius: 999, overflow: 'hidden' },
  strokeGradientFill: { ...StyleSheet.absoluteFillObject, borderRadius: 999 },
  controlPanel: {
    backgroundColor: theme.bg,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    width: '100%',
    alignSelf: 'center',
  },
  controlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  controlRight: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  recordingWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recordingText: { color: '#E53935', fontFamily: fontFamilyBody, fontSize: 12, textTransform: 'lowercase', letterSpacing: 0.8 },
  recordDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#E53935' },
  ctrlBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.border,
  },
  ctrlBtnRecordActive: {
    backgroundColor: '#E53935',
    borderColor: 'rgba(229,57,53,0.6)',
  },
  ctrlBtnPressed: { opacity: 0.75 },
  ctrlText: { color: '#111', fontFamily: fontFamilyBody, textTransform: 'lowercase', letterSpacing: 0.8, fontSize: 14 },
  tempoBtn: { backgroundColor: theme.fg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  tempoText: { color: theme.bg, fontFamily: fontFamilyBody, textTransform: 'lowercase', letterSpacing: 0.8 },

  
  chevronWrap: { width: 42, height: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  instrumentRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap',
    gap: 8, 
    marginTop: 10,
    width: '92%',
    maxWidth: 640,
    alignSelf: 'center',
    justifyContent: 'center'
  },
  chatWrap: { 
    width: '92%', 
    maxWidth: 640, 
    alignSelf: 'center', 
    marginTop: 16,
    backgroundColor: theme.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    maxHeight: 200,
    minHeight: 120
  },
  chatScrollView: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  chatContent: {
    gap: 8
  },
  bubbleAI: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-start' },
  bubbleAIText: { color: theme.fg, fontFamily: fontFamilyBody, textTransform: 'lowercase', letterSpacing: 0.8 },
  bubbleUser: { backgroundColor: theme.fg, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, alignSelf: 'flex-end' },
  bubbleUserText: { color: theme.bg, fontFamily: fontFamilyBody, textTransform: 'lowercase', letterSpacing: 0.8 },
  btnGrey: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#1a1a1d', borderWidth: 1, borderColor: theme.border },
  btnGreyText: { color: '#b9b9bf', fontFamily: fontFamilyBody, textTransform: 'lowercase', letterSpacing: 0.8 },
  chatComposer: { width: '92%', maxWidth: 640, alignSelf: 'center', flexDirection: 'row', gap: 12, marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border },
  padStrokeWrap: { width: '92%', maxWidth: 640, aspectRatio: 1, borderRadius: 12, overflow: 'hidden', position: 'relative', padding: 2 },
  padWrap: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  pad: { flex: 1, backgroundColor: '#000000' },
  btnGhostWrap: { borderRadius: 999, overflow: 'hidden', position: 'relative', padding: 2 },
  btnGhostInner: { borderRadius: 999, backgroundColor: theme.bg, paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  btnGhostText: { color: theme.fg, fontFamily: fontFamilyBody, textTransform: 'lowercase', letterSpacing: 0.8 },
  btnPressed: { opacity: 0.85 },
  thinkDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: theme.fg, alignSelf: 'center' },
  btnPrimary: { backgroundColor: theme.fg, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  btnPrimaryText: { color: theme.bg, fontFamily: fontFamilyBody, textTransform: 'lowercase', letterSpacing: 0.8 },
  btn: { backgroundColor: theme.fg, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: theme.bg, fontFamily: fontFamilyBody, textTransform: 'lowercase', letterSpacing: 0.8 },
  result: { color: theme.fg, fontFamily: fontFamilyBody, fontSize: 14 },
  padOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.2)' },
  padSheet: { backgroundColor: theme.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  padPanel: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: theme.bg },
})
