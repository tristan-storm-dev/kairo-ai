import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import HomeScreen from './src/screens/HomeScreen'
import LabScreen from './src/screens/LabScreen'
import PlaylistScreen from './src/screens/PlaylistScreen'
import CustomTabBar from './src/components/CustomTabBar'
import { StatusBar } from 'expo-status-bar'

const Tab = createBottomTabNavigator()

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator tabBar={(props) => <CustomTabBar {...props} /> } screenOptions={{ headerShown: false }}>
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Lab" component={LabScreen} />
        <Tab.Screen name="Playlist" component={PlaylistScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  )
}
