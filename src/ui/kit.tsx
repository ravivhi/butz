/* Shared child-facing components: big buttons, answer tiles, top bar, progress dots, star counter, celebration burst. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT, ROW, useLayout, usePalette, useSettings } from './theme';
import { say } from '../services/speech';

const native = Platform.OS !== 'web';

export function Txt({ children, size = 20, font = 'ui', color, style, center = true, lines }: { children: ReactNode; size?: number; font?: keyof typeof FONT; color?: string; style?: StyleProp<TextStyle>; center?: boolean; lines?: number }) {
  const { t } = useLayout();
  const pal = usePalette();
  return (
    <Text numberOfLines={lines} style={[{ fontFamily: FONT[font], fontSize: t(size), color: color ?? pal.ink, textAlign: center ? 'center' : 'right', writingDirection: 'rtl', lineHeight: t(size) * (font.startsWith('read') || font === 'serif' ? 1.6 : 1.25) }, style]}>
      {children}
    </Text>
  );
}

/** Press animation shared by buttons and tiles. */
function usePress() {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: native, speed: 40, bounciness: 8 }).start();
  return { scale, onPressIn: () => to(0.94), onPressOut: () => to(1) };
}

export function Big({ label, emoji, color, onPress, speak, size = 'l', testID, disabled, style, glow }: {
  label?: string; emoji?: string; color?: string; onPress: () => void; speak?: string; size?: 's' | 'm' | 'l' | 'xl'; testID?: string; disabled?: boolean; style?: StyleProp<ViewStyle>; glow?: boolean;
}) {
  const pal = usePalette();
  const { s } = useLayout();
  const p = usePress();
  const pad = { s: 10, m: 14, l: 18, xl: 24 }[size];
  const fs = { s: 18, m: 22, l: 28, xl: 36 }[size];
  const bg = color ?? pal.orange;
  return (
    <Animated.View style={[{ transform: [{ scale: p.scale }] }, style]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label ?? speak}
        disabled={disabled}
        onPressIn={p.onPressIn}
        onPressOut={p.onPressOut}
        onPress={() => { if (speak) say(speak); onPress(); }}
        style={{
          flexDirection: ROW, alignItems: 'center', justifyContent: 'center', gap: s(10), backgroundColor: bg, opacity: disabled ? 0.45 : 1,
          paddingVertical: s(pad), paddingHorizontal: s(pad * 1.4), borderRadius: s(pad * 1.6), borderWidth: s(3), borderColor: pal.line,
          shadowColor: pal.line, shadowOffset: { width: 0, height: s(5) }, shadowOpacity: 1, shadowRadius: 0, elevation: 6,
          ...(glow ? { borderColor: pal.glow, borderWidth: s(5) } : null),
        }}>
        {emoji ? <Text style={{ fontSize: s(fs * 1.25) }}>{emoji}</Text> : null}
        {label ? <Txt size={fs} font="uiHeavy" color="#FFFFFF">{label}</Txt> : null}
      </Pressable>
    </Animated.View>
  );
}

export function Round({ emoji, onPress, testID, label, color, size = 56 }: { emoji: string; onPress: () => void; testID?: string; label: string; color?: string; size?: number }) {
  const pal = usePalette();
  const { s } = useLayout();
  const p = usePress();
  return (
    <Animated.View style={{ transform: [{ scale: p.scale }] }}>
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPressIn={p.onPressIn} onPressOut={p.onPressOut} onPress={onPress}
        style={{ width: s(size), height: s(size), borderRadius: s(size), backgroundColor: color ?? pal.card, borderWidth: s(3), borderColor: pal.line, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: s(size * 0.48) }}>{emoji}</Text>
      </Pressable>
    </Animated.View>
  );
}

export type TileState = 'idle' | 'right' | 'wrong' | 'hint' | 'dim' | 'selected' | 'off';

/** Round button that wiggles until it is first pressed (👂 explain, 🔊 listen). */
export function WiggleRound({ emoji, label, onPress, attention = false, size = 56, testID, color }: { emoji: string; label: string; onPress: () => void; attention?: boolean; size?: number; testID?: string; color?: string }) {
  const pal = usePalette();
  const reduced = useSettings().reducedMotion;
  const wig = useRef(new Animated.Value(0)).current;
  const [asked, setAsked] = useState(false);
  useEffect(() => {
    if (!attention || asked || reduced) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(wig, { toValue: 1, duration: 140, useNativeDriver: native }),
      Animated.timing(wig, { toValue: -1, duration: 140, useNativeDriver: native }),
      Animated.timing(wig, { toValue: 0, duration: 140, useNativeDriver: native }),
      Animated.delay(1400),
    ]));
    loop.start();
    return () => loop.stop();
  }, [attention, asked, reduced, wig]);
  return (
    <Animated.View style={{ transform: [{ rotate: wig.interpolate({ inputRange: [-1, 1], outputRange: ['-14deg', '14deg'] }) }] }}>
      <Round emoji={emoji} label={label} size={size} color={attention && !asked ? pal.yellow : color ?? pal.card} testID={testID} onPress={() => { setAsked(true); onPress(); }} />
    </Animated.View>
  );
}

/** 👂 "explain" button: instructions are spoken only when the child asks (never automatically). */
export function HelpButton({ text, attention = false, size = 56, testID = 'help' }: { text: string | string[]; attention?: boolean; size?: number; testID?: string }) {
  return <WiggleRound emoji="👂" label="הסבר" size={size} attention={attention} color="#E3F2FD" testID={testID} onPress={() => say(text)} />;
}

/** 🔊 "listen" button: the stimulus is played only when the child taps it. Wiggles until the first tap. */
export function ListenButton({ onPress, attention = true, size = 56, testID = 'replay' }: { onPress: () => void; attention?: boolean; size?: number; testID?: string }) {
  return <WiggleRound emoji="🔊" label="הקשבה" size={size} attention={attention} testID={testID} onPress={onPress} />;
}

export function Tile({ text, emoji, label, state = 'idle', onPress, size = 110, font = 'read', color, testID, wide, emojiScale = 0.5 }: {
  text?: string; emoji?: string; label?: string; state?: TileState; onPress?: () => void; size?: number; font?: keyof typeof FONT; color?: string; testID?: string; wide?: boolean; emojiScale?: number;
}) {
  const pal = usePalette();
  const { s, t } = useLayout();
  const p = usePress();
  const shake = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const reduced = useSettings().reducedMotion;
  useEffect(() => {
    if (state === 'wrong' && !reduced) {
      Animated.sequence([-1, 1, -0.6, 0.6, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 70, useNativeDriver: native }))).start();
    }
    if (state === 'hint' && !reduced) {
      const loop = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 450, useNativeDriver: native }), Animated.timing(pulse, { toValue: 0, duration: 450, useNativeDriver: native })]));
      loop.start();
      return () => loop.stop();
    }
    if (state === 'right' && !reduced) {
      Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 160, useNativeDriver: native }), Animated.timing(pulse, { toValue: 0, duration: 220, useNativeDriver: native })]).start();
    }
    return undefined;
  }, [state, shake, pulse, reduced]);
  const S = s(size);
  const bg = state === 'right' ? pal.good : state === 'selected' ? pal.yellow : pal.card;
  const border = state === 'hint' ? pal.glow : state === 'right' ? pal.good : state === 'wrong' ? pal.bad : pal.line;
  const fg = state === 'right' ? '#FFFFFF' : color ?? pal.ink;
  const scale = Animated.multiply(p.scale, pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }));
  return (
    <Animated.View style={{ opacity: state === 'dim' || state === 'off' ? pal.dim : 1, transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] }) }, { scale }] }}>
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label ?? text ?? emoji} disabled={!onPress || state === 'off' || state === 'dim'}
        onPressIn={p.onPressIn} onPressOut={p.onPressOut} onPress={onPress}
        style={{ minWidth: S * (wide ? 1.5 : 1), height: S, paddingHorizontal: s(10), borderRadius: s(22), backgroundColor: bg, borderWidth: s(state === 'hint' ? 6 : 3), borderColor: border, alignItems: 'center', justifyContent: 'center',
          shadowColor: pal.line, shadowOffset: { width: 0, height: s(4) }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 }}>
        {emoji ? <Text style={{ fontSize: S * emojiScale }}>{emoji}</Text> : null}
        {text ? <Text style={{ fontFamily: FONT[font], fontSize: t(size * (text.replace(/[\u0591-\u05C7\u25CC]/g, '').length > 3 ? 0.32 : 0.46)), color: fg, writingDirection: 'rtl', textAlign: 'center' }}>{text}</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

export function Screen({ children, bg, testID }: { children: ReactNode; bg?: string; testID?: string }) {
  const pal = usePalette();
  const ins = useSafeAreaInsets();
  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: bg ?? pal.bg, paddingTop: ins.top, paddingBottom: ins.bottom, paddingLeft: ins.left, paddingRight: ins.right }}>
      {children}
    </View>
  );
}

/** Top bar: close/back on the right (RTL start), stars on the left, optional middle content. */
export function TopBar({ onClose, closeEmoji = '✖️', stars, children, closeLabel = 'סגירה' }: { onClose?: () => void; closeEmoji?: string; stars?: number; children?: ReactNode; closeLabel?: string }) {
  const { s } = useLayout();
  return (
    <View style={{ flexDirection: ROW, alignItems: 'center', paddingHorizontal: s(12), paddingVertical: s(8), gap: s(10) }}>
      {onClose ? <Round emoji={closeEmoji} onPress={onClose} label={closeLabel} testID="close" size={50} /> : <View style={{ width: s(50) }} />}
      <View style={{ flex: 1, alignItems: 'center' }}>{children}</View>
      {stars !== undefined ? <StarPill n={stars} /> : <View style={{ width: s(50) }} />}
    </View>
  );
}

export function StarPill({ n }: { n: number }) {
  const pal = usePalette();
  const { s } = useLayout();
  const bump = useRef(new Animated.Value(1)).current;
  const prev = useRef(n);
  useEffect(() => {
    if (n > prev.current) Animated.sequence([Animated.timing(bump, { toValue: 1.35, duration: 160, useNativeDriver: native }), Animated.spring(bump, { toValue: 1, useNativeDriver: native })]).start();
    prev.current = n;
  }, [n, bump]);
  return (
    <Animated.View testID="stars" style={{ transform: [{ scale: bump }], flexDirection: ROW, alignItems: 'center', gap: s(4), backgroundColor: pal.yellow, borderRadius: s(30), borderWidth: s(3), borderColor: pal.line, paddingHorizontal: s(12), paddingVertical: s(4) }}>
      <Text style={{ fontSize: s(22) }}>⭐</Text>
      <Txt size={22} font="uiHeavy">{n}</Txt>
    </Animated.View>
  );
}

export function Dots({ n, i }: { n: number; i: number }) {
  const pal = usePalette();
  const { s } = useLayout();
  return (
    <View style={{ flexDirection: ROW, gap: s(6), alignItems: 'center' }} testID="dots">
      {Array.from({ length: n }, (_, k) => (
        <View key={k} style={{ width: s(k === i ? 18 : 12), height: s(k === i ? 18 : 12), borderRadius: s(10), backgroundColor: k < i ? pal.green : k === i ? pal.yellow : pal.card, borderWidth: s(2), borderColor: pal.line }} />
      ))}
    </View>
  );
}

/** Emoji confetti for celebrations. */
export function Burst({ run, emojis = ['⭐', '✨', '🎉', '🌟'] }: { run: number; emojis?: string[] }) {
  const { w, h } = useLayout();
  const reduced = useSettings().reducedMotion;
  const [parts, setParts] = useState<{ id: number; x: number; e: string; v: Animated.Value; dx: number }[]>([]);
  useEffect(() => {
    if (!run || reduced) return;
    const ps = Array.from({ length: 18 }, (_, i) => ({ id: run * 100 + i, x: w * (0.2 + Math.random() * 0.6), e: emojis[i % emojis.length], v: new Animated.Value(0), dx: (Math.random() - 0.5) * w * 0.6 }));
    setParts(ps);
    Animated.parallel(ps.map((p) => Animated.timing(p.v, { toValue: 1, duration: 1100 + Math.random() * 500, easing: Easing.out(Easing.quad), useNativeDriver: native }))).start(() => setParts([]));
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
      {parts.map((p) => (
        <Animated.Text key={p.id} style={{ position: 'absolute', left: p.x, top: h * 0.55, fontSize: 34, opacity: p.v.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
          transform: [{ translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, -h * 0.5] }) }, { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) }] }}>
          {p.e}
        </Animated.Text>
      ))}
    </View>
  );
}

export function Card({ children, style, color }: { children: ReactNode; style?: StyleProp<ViewStyle>; color?: string }) {
  const pal = usePalette();
  const { s } = useLayout();
  return <View style={[{ backgroundColor: color ?? pal.card, borderRadius: s(24), borderWidth: s(3), borderColor: pal.line, padding: s(14), shadowColor: pal.line, shadowOffset: { width: 0, height: s(5) }, shadowOpacity: 1, shadowRadius: 0, elevation: 5 }, style]}>{children}</View>;
}

const POP = ['🌟', '👏', '🎉', '💪', '⭐', '😍', '🤩', '👍'];

/** Silent praise after a right answer: a big emoji pops up for a moment (nothing is spoken). */
export function Pop({ run }: { run: number }) {
  const { s, h } = useLayout();
  const reduced = useSettings().reducedMotion;
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!run) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 800, useNativeDriver: native }).start();
  }, [run, v]);
  if (!run) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: h * 0.12, left: 0, right: 0, alignItems: 'center' }}>
      <Animated.Text testID="praise" style={{ fontSize: s(96), opacity: v.interpolate({ inputRange: [0, 0.12, 0.7, 1], outputRange: [0, 1, 1, 0] }),
        transform: [{ scale: reduced ? 1 : v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.3, 1.2, 1] }) }] }}>
        {POP[run % POP.length]}
      </Animated.Text>
    </View>
  );
}
