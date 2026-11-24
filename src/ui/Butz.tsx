/* Butz (בּוּץ, with shuruk) the owl: the guide character. Pure SVG so it scales and works offline; bobs gently unless motion is reduced. */
import { useEffect, useRef, type ReactNode } from 'react';
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

/** Lighthouse for the Sound Lighthouse game; the lamp lights up when the child answers. */
export function Lighthouse({ size = 120, lit = false }: { size?: number; lit?: boolean }) {
  return (
    <Svg width={size * 0.8} height={size} viewBox="0 0 160 200">
      {lit && <Path d="M80 40 L0 10 L0 70 Z M80 40 L160 10 L160 70 Z" fill="rgba(255,213,79,0.55)" />}
      <Path d="M60 60 L100 60 L112 186 L48 186 Z" fill="#FFFFFF" stroke="#24304A" strokeWidth="5" />
      <Path d="M57 90 L103 90 L106 115 L54 115 Z M51 140 L109 140 L111 165 L49 165 Z" fill="#F25C54" />
      <Path d="M56 24 L104 24 L104 60 L56 60 Z" fill={lit ? '#FFD54F' : '#B0BEC5'} stroke="#24304A" strokeWidth="5" />
      <Path d="M50 24 L80 4 L110 24 Z" fill="#F25C54" stroke="#24304A" strokeWidth="5" />
      <Path d="M30 186 L130 186" stroke="#24304A" strokeWidth="6" strokeLinecap="round" />
    </Svg>
  );
}

/** Magic door for the Secret Password game. */
export function Door({ size = 160, open = false, children }: { size?: number; open?: boolean; children?: ReactNode }) {
  return (
    <Svg width={size * 0.78} height={size} viewBox="0 0 156 200">
      <Path d="M8 196 L8 70 Q8 8 78 8 Q148 8 148 70 L148 196 Z" fill={open ? '#2B2140' : '#8D5A3B'} stroke="#24304A" strokeWidth="6" />
      {!open && <Path d="M24 190 L24 74 Q24 24 78 24 Q132 24 132 74 L132 190 Z" fill="#A0673F" />}
      {!open && <Circle cx="118" cy="130" r="8" fill="#FFC928" stroke="#24304A" strokeWidth="3" />}
      {children}
    </Svg>
  );
}
