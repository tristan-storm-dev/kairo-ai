import React, { useRef, useState } from 'react'
import { View, Text, StyleSheet, Pressable, Dimensions, Animated, Easing, Platform } from 'react-native'
import { theme, fontFamilyBody, fontFamilyHeadline, tabIndicatorColors } from '../theme'
import DotGrid from '../components/DotGrid'
import { useNavigation } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { Feather } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

export default function HomeScreen() {
  const navigation = useNavigation<any>()

  const [showInfo, setShowInfo] = useState(false)
  const [gridW, setGridW] = useState(0)
  const [gridH, setGridH] = useState(0)

  const screenH = Dimensions.get('window').height

  const [ghostMinTextW, setGhostMinTextW] = useState<number | null>(null)
  const BTN_INNER_PAD = 16
  const onGhostTextLayout = (e: any) => {
    const w = e?.nativeEvent?.layout?.width ?? 0
    if (w > 0) setGhostMinTextW((prev) => (prev == null ? w : Math.max(prev, w)))
  }

  const handleHaptic = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {})
    }
  }

  const mainY = useRef(new Animated.Value(0)).current
  const panelY = useRef(new Animated.Value(screenH)).current

  const handleExplorePress = React.useCallback(() => {
    handleHaptic()
    navigation.navigate('Lab')
  }, [navigation])


  const openInfo = () => {
    setShowInfo(true)
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

  const closeInfo = () => {
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
      if (finished) setShowInfo(false)
    })
  }

  const dot = 12
  const gap = 12
  const cells = gridW > 0 && gridH > 0 ? Math.max(4, Math.floor(Math.min(gridW, gridH) / (dot + gap))) : 6
  const rows = cells
  const cols = cells

  return (
    <View style={styles.container}>
      <Animated.View style={[{ flex: 1, backgroundColor: theme.bg }, { transform: [{ translateY: mainY }] }]}>        
        <View style={styles.sectionTop} />
        <View style={styles.sectionHero}>
          <Text style={styles.headline}>kairo</Text>
          <Text style={styles.tagline}>turn chaos to sound</Text>
        </View>
        <View style={styles.sectionGrid}>
          <View
            style={styles.gridBox}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout
              setGridW(width)
              setGridH(height)
            }}
          >
            <DotGrid rows={rows} cols={cols} dotSize={dot} gap={gap} color={'#ffffff'} radius={4} amplitude={0.35} freq={0.35} fps={24} />
          </View>
        </View>
        <View style={styles.sectionButtons}>
          <View style={styles.buttonsRow}>
            <Pressable
              style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
              onPress={handleExplorePress}
            >
              <Text style={styles.btnPrimaryText}>Explore Lab</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.btnGhostWrap, pressed && styles.btnPressed]}
              onPress={() => { handleHaptic(); if (!showInfo) openInfo() }}
            >
              <View style={styles.strokeGradientWrap}>
                <LinearGradient colors={tabIndicatorColors as unknown as readonly [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.strokeGradientFill} />
              </View>
              <View style={[styles.btnGhostInner, ghostMinTextW != null ? { minWidth: ghostMinTextW + BTN_INNER_PAD * 2 } : null]}>
                <Text style={styles.btnGhostText} onLayout={onGhostTextLayout}>how it works</Text>
              </View>
            </Pressable>
          </View>
        </View>
        <View style={styles.sectionBottom} />
      </Animated.View>
      {showInfo && (
        <Animated.View style={[styles.infoPanel, { transform: [{ translateY: panelY }] }]}>          
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.infoTop}>
              <Pressable
                style={styles.chevronWrap}
                onPress={() => { handleHaptic(); closeInfo(); }}
                hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
              >
                <Feather name="chevron-down" size={28} color={theme.fg} />
              </Pressable>
            </View>
            <View style={styles.infoCenter} />
            <View style={styles.infoBottom} />
          </SafeAreaView>
        </Animated.View>
      )}

    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  sectionTop: { flex: 10 },
  sectionHero: { flex: 20, alignItems: 'center', justifyContent: 'center' },
  headline: { color: theme.fg, fontSize: 42, fontFamily: fontFamilyHeadline, letterSpacing: 1.2, textTransform: 'lowercase' },
  tagline: { color: theme.fg, fontSize: 14, fontFamily: fontFamilyBody, opacity: 0.8, marginTop: 6, letterSpacing: 0.8, textTransform: 'lowercase' },
  sectionGrid: { flex: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  gridBox: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  sectionButtons: { flex: 15, alignItems: 'center', justifyContent: 'center' },
  buttonsRow: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: theme.fg, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 999 },
  btnPrimaryText: { color: theme.bg, fontFamily: fontFamilyBody, textTransform: 'lowercase', letterSpacing: 0.8, fontSize: 14 },
  btnGhostWrap: { borderRadius: 999, overflow: 'hidden', position: 'relative', padding: 2 },
  strokeGradientWrap: { ...StyleSheet.absoluteFillObject, borderRadius: 999, overflow: 'hidden' },
  strokeGradientFill: { ...StyleSheet.absoluteFillObject, borderRadius: 999 },
  btnGhostInner: { borderRadius: 999, backgroundColor: theme.bg, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  btnGhostText: { color: theme.fg, fontFamily: fontFamilyBody, textTransform: 'lowercase', letterSpacing: 0.8, fontSize: 14 },
  btnPressed: { opacity: 0.85 },
  sectionBottom: { flex: 7 },
  infoPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, backgroundColor: theme.bg, borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: 'hidden' },
  infoTop: { height: 64, alignItems: 'center', justifyContent: 'center' },
  chevronWrap: { width: 42, height: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  infoCenter: { flex: 1 },
  infoBottom: { height: 64 },
})