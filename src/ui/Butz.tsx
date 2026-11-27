/* Butz (בּוּץ, with shuruk) the owl: the guide character. Pure SVG so it scales and works offline; bobs gently unless motion is reduced. */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { useSettings } from './theme';
import type { Trick } from '../engine/phrases';

const nd = Platform.OS !== 'web';
const TRICK_MS: Record<Trick, number> = { spin: 1000, shake: 800, fly: 2200 };

export type Mood = 'happy' | 'cheer' | 'think' | 'talk';

export function Butz({ size = 140, mood: moodIn = 'happy', trick }: { size?: number; mood?: Mood; trick?: { kind: Trick; n: number } }) {
  const bob = useRef(new Animated.Value(0)).current;
  const reduced = useSettings().reducedMotion;
  // a funny move (Home): starts together with the line he says
  const t = useRef(new Animated.Value(0)).current;
  const flap = useRef(new Animated.Value(0)).current;
  const [busy, setBusy] = useState<Trick | null>(null);
  useEffect(() => {
    if (!trick || reduced) return;
    setBusy(trick.kind);
    t.setValue(0);
    const run = Animated.parallel([
      Animated.timing(t, { toValue: 1, duration: TRICK_MS[trick.kind], easing: Easing.linear, useNativeDriver: nd }),
      Animated.loop(Animated.sequence([
        Animated.timing(flap, { toValue: 1, duration: 110, useNativeDriver: false }),
        Animated.timing(flap, { toValue: 0, duration: 110, useNativeDriver: false }),
      ]), { iterations: Math.round(TRICK_MS[trick.kind] / 220) }),
    ]);
    run.start(() => setBusy(null));
    return () => { run.stop(); setBusy(null); };
  }, [trick?.n, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  const mood: Mood = busy === 'fly' || busy === 'spin' ? 'cheer' : moodIn;
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
  const up = busy === 'fly'
    ? t.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], outputRange: [0, -size * 0.6, -size * 0.45, -size * 0.65, -size * 0.3, 0] })
    : busy === 'spin' ? t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -size * 0.25, 0] }) : 0;
  const side = busy === 'shake'
    ? t.interpolate({ inputRange: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1], outputRange: [0, -1, 1, -1, 1, -1, 1, -1, 1, -0.5, 0].map((v) => v * size * 0.06) })
    : busy === 'fly' ? t.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: [0, size * 0.15, -size * 0.15, 0] }) : 0;
  const turn = busy === 'spin'
    ? t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
    : busy === 'shake'
      ? t.interpolate({ inputRange: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1], outputRange: ['0deg', '-14deg', '14deg', '-14deg', '14deg', '-14deg', '14deg', '-14deg', '14deg', '-6deg', '0deg'] })
      : busy === 'fly' ? t.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: ['0deg', '10deg', '-10deg', '0deg'] }) : '0deg';
  const grow = busy === 'spin' ? t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.2, 1] }) : 1;
  // wings flap while he flies (up and down between the raised and the resting pose)
  const wingUp = busy === 'fly' ? flap : null;
  const [wingPose, setWingPose] = useState(0);
  useEffect(() => {
    if (!wingUp) return;
    const id = wingUp.addListener(({ value }) => setWingPose(value > 0.5 ? 1 : 0));
    return () => wingUp.removeListener(id);
  }, [wingUp]);
  const raised = busy === 'fly' ? wingPose === 1 : mood === 'cheer';
  const wingL = raised ? 'rotate(-55 52 125)' : 'rotate(0)';
  const wingR = raised ? 'rotate(55 148 125)' : 'rotate(0)';
  const look = mood === 'think' ? -6 : 0;
  return (
    <Animated.View style={{ width: size, height: size, zIndex: busy ? 5 : 0, transform: [{ translateY: ty }, { translateY: up }, { translateX: side }, { rotate: turn }, { scale: grow }] }}
      accessibilityLabel="Butz" testID={busy ? 'butz-' + busy : 'butz'}>
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
