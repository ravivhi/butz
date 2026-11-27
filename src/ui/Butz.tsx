/* Butz (בּוּץ, with shuruk) the owl: the guide character. Pure SVG so it scales and works offline; bobs gently unless motion is reduced. */
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { useSettings } from './theme';

export type Mood = 'happy' | 'cheer' | 'think' | 'talk';

export function Butz({ size = 140, mood = 'happy' }: { size?: number; mood?: Mood }) {
  const bob = useRef(new Animated.Value(0)).current;
  const reduced = useSettings().reducedMotion;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: mood === 'cheer' ? 260 : 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(bob, { toValue: 0, duration: mood === 'cheer' ? 260 : 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bob, mood, reduced]);
  const ty = bob.interpolate({ inputRange: [0, 1], outputRange: [0, mood === 'cheer' ? -size * 0.08 : -size * 0.03] });
  const wingL = mood === 'cheer' ? 'rotate(-55 52 125)' : 'rotate(0)';
  const wingR = mood === 'cheer' ? 'rotate(55 148 125)' : 'rotate(0)';
  const look = mood === 'think' ? -6 : 0;
  return (
    <Animated.View style={{ width: size, height: size, transform: [{ translateY: ty }] }} accessibilityLabel="Butz" testID="butz">
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Ellipse cx="100" cy="190" rx="52" ry="7" fill="rgba(0,0,0,0.12)" />
        <G transform={wingL}><Ellipse cx="45" cy="128" rx="18" ry="40" fill="#7A4A2E" /></G>
        <G transform={wingR}><Ellipse cx="155" cy="128" rx="18" ry="40" fill="#7A4A2E" /></G>
        <Path d="M52 58 L44 20 L80 46 Z" fill="#8D5A3B" />
        <Path d="M148 58 L156 20 L120 46 Z" fill="#8D5A3B" />
        <Ellipse cx="100" cy="115" rx="62" ry="72" fill="#A0673F" />
        <Ellipse cx="100" cy="148" rx="40" ry="36" fill="#F6D9A9" />
        <Path d="M84 140 q6 6 12 0 M104 140 q6 6 12 0 M94 156 q6 6 12 0" stroke="#D9B27A" strokeWidth="3" fill="none" />
        <Circle cx="74" cy="88" r="30" fill="#FFE9C7" />
        <Circle cx="126" cy="88" r="30" fill="#FFE9C7" />
        {mood === 'cheer' ? (
          <G>
            <Path d="M60 92 q14 -16 28 0" stroke="#24304A" strokeWidth="6" fill="none" strokeLinecap="round" />
            <Path d="M112 92 q14 -16 28 0" stroke="#24304A" strokeWidth="6" fill="none" strokeLinecap="round" />
          </G>
        ) : (
          <G>
            <Circle cx="74" cy="88" r="19" fill="#FFFFFF" />
            <Circle cx="126" cy="88" r="19" fill="#FFFFFF" />
            <Circle cx="76" cy={90 + look} r="10" fill="#24304A" />
            <Circle cx="124" cy={90 + look} r="10" fill="#24304A" />
            <Circle cx="80" cy={86 + look} r="3.5" fill="#FFFFFF" />
            <Circle cx="128" cy={86 + look} r="3.5" fill="#FFFFFF" />
          </G>
        )}
        <Path d={mood === 'talk' ? 'M90 108 L110 108 L100 126 Z' : 'M90 106 L110 106 L100 122 Z'} fill="#FFB300" />
        <Path d="M78 186 l6 -12 l6 12 M110 186 l6 -12 l6 12" stroke="#FF9800" strokeWidth="6" strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}
