import React from 'react'
import { View, Text, StyleSheet, Platform } from 'react-native'
import { theme, fontFamilyBody } from '../theme'

export default function LabScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>lab</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: theme.fg,
    fontSize: Platform.OS === 'web' ? 24 : 26,
    textTransform: 'lowercase',
    fontFamily: fontFamilyBody,
    letterSpacing: 1,
  },
})