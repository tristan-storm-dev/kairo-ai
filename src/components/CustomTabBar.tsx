import React, { useEffect, useRef, useState } from 'react';
import { Text, View, StyleSheet, Platform, Animated, Easing, Pressable } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, fontFamilyBody, tabIndicatorColors } from '../theme';

const styles = StyleSheet.create({
  tabText: {
    color: theme.fg,
    textTransform: 'lowercase',
    fontFamily: fontFamilyBody,
    letterSpacing: 0.8,
    fontSize: Platform.OS === 'web' ? 12 : 15,
  },
});

function handleHaptic() {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync().catch(() => {});
  }
}

export default function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [containerWidth, setContainerWidth] = useState(0);
  const tabCount = state.routes.length;
  const tabWidth = containerWidth > 0 ? containerWidth / tabCount : 0;

  const baseWidth = 28;
  const half = baseWidth / 2;
  const indicatorHeight = Platform.OS === 'web' ? 2 : 3;
  const indicatorBottom = Platform.OS === 'web' ? 8 : Math.max(insets.bottom, 12) - 6;
  const indicatorBottomResolved = Math.max(indicatorBottom, 4);
  const indicatorRadius = indicatorHeight;

  const leftX = useRef(new Animated.Value(0)).current;
  const rightX = useRef(new Animated.Value(0)).current;
  const gradientOpacity = useRef(new Animated.Value(0)).current;
  const prevIndexRef = useRef(state.index);

  useEffect(() => {
    if (tabWidth === 0) return;
    const center = state.index * tabWidth + tabWidth / 2;
    leftX.setValue(center - half);
    rightX.setValue(center + half);
  }, [tabWidth]);

  useEffect(() => {
    if (tabWidth === 0) return;
    const prevIndex = prevIndexRef.current;
    const nextIndex = state.index;
    if (prevIndex === nextIndex) return;

    const prevCenter = prevIndex * tabWidth + tabWidth / 2;
    const nextCenter = nextIndex * tabWidth + tabWidth / 2;

    leftX.setValue(prevCenter - half);
    rightX.setValue(prevCenter + half);

    const stretchDuration = 180;
    const snapDuration = 140;

    Animated.sequence([
      Animated.timing(gradientOpacity, {
        toValue: 1,
        duration: stretchDuration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(gradientOpacity, {
        toValue: 0,
        duration: snapDuration,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    if (nextCenter > prevCenter) {
      Animated.sequence([
        Animated.timing(rightX, {
          toValue: nextCenter + half,
          duration: stretchDuration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(leftX, {
          toValue: nextCenter - half,
          duration: snapDuration,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.sequence([
        Animated.timing(leftX, {
          toValue: nextCenter - half,
          duration: stretchDuration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(rightX, {
          toValue: nextCenter + half,
          duration: snapDuration,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    }

    prevIndexRef.current = nextIndex;
  }, [state.index, tabWidth]);

  return (
    <SafeAreaView style={{ backgroundColor: theme.bg }} edges={['bottom']}>
      <View
        style={{
          position: 'relative',
          borderTopColor: theme.border,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 12),
          backgroundColor: theme.bg,
        }}
      >
        <View
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
          style={{ flexDirection: 'row' }}
        >
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            const { options } = descriptors[route.key];
            const label =
              options.tabBarLabel !== undefined
                ? options.tabBarLabel
                : options.title !== undefined
                ? options.title
                : route.name;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              handleHaptic();
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={{ flex: 1, alignItems: 'center', paddingVertical: Platform.OS === 'web' ? 10 : 12 }}
              >
                <Text style={styles.tabText}>{String(label).toLowerCase()}</Text>
              </Pressable>
            );
          })}
        </View>
        {tabWidth > 0 && (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: indicatorBottomResolved }}>
            <Animated.View
              style={{
                position: 'absolute',
                left: leftX,
                width: Animated.subtract(rightX, leftX),
                height: indicatorHeight,
                borderRadius: indicatorRadius,
                overflow: 'hidden',
              }}
            >
              <Animated.View style={{ opacity: gradientOpacity }}>
                <LinearGradient
                  colors={tabIndicatorColors as unknown as readonly [string, string, ...string[]]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{ width: '100%', height: '100%' }}
                />
              </Animated.View>
              <Animated.View
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  backgroundColor: theme.fg,
                  opacity: Animated.subtract(1, gradientOpacity),
                }}
              />
            </Animated.View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}