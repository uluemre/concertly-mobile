import React from 'react';
import { View } from 'react-native';

// Web fallback for react-native-maps. It keeps event-detail screens renderable
// in a browser without pulling in native code; the dedicated MapScreen.web
// provides the useful event list for this platform.
export default function MapView({ children, style }) {
  return <View style={style}>{children}</View>;
}

export function Marker({ children }) {
  return <View>{children}</View>;
}

export function Circle() {
  return null;
}
