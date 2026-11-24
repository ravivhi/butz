/* A sticker that is alive (SPEC §10.2): every sticker has its own idle motion; a tap makes it jump and spin with a sound.
   Shiny stickers glow and sparkle. Motion stops when the grown-up turns on "less motion". */
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, View } from 'react-native';
import { isShiny, stickerEmoji, stickerIndex } from '../engine/content/stickers';
import { sfx } from '../services/sfx';
import { useLayout, usePalette, useSettings } from './theme';

const native = Platform.OS !== 'web';
type Motion = 'float' | 'wiggle' | 'pulse' | 'swing' | 'hop' | 'flip';
const MOTIONS: Motion[] = ['float', 'wiggle', 'pulse', 'swing', 'hop', 'flip'];

export function LiveSticker({ id, size, testID, fresh = false }: { id: string; size: number; testID?: string; fresh?: boolean }) {
  const pal = usePalette();
  const { s } = useLayout();
  const reduced = useSettings().reducedMotion;
  const idx = Number.isFinite(stickerIndex(id)) ? stickerIndex(id) : 0;
  const motion = MOTIONS[(idx * 7 + id.length) % MOTIONS.length];
  const shiny = isShiny(id);
  const idle = useRef(new Animated.Value(0)).current;
  const tap = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return;
    const dur = 800 + (idx % 5) * 170;
    const ease = motion === 'hop' ? Easing.out(Easing.quad) : Easing.inOut(Easing.sin);
    const loop = Animated.loop(Animated.sequence([
      Animated.delay((idx % 4) * 160),
      Animated.timing(idle, { toValue: 1, duration: dur, easing: ease, useNativeDriver: native }),
      Animated.timing(idle, { toValue: 0, duration: dur, easing: motion === 'hop' ? Easing.bounce : ease, useNativeDriver: native }),
      Animated.delay(motion === 'hop' || motion === 'flip' ? 900 : 0),
    ]));
    loop.start();
    const sparkle = shiny ? Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 650, useNativeDriver: native }),
      Animated.timing(glow, { toValue: 0.15, duration: 650, useNativeDriver: native }),
    ])) : undefined;
    sparkle?.start();
    return () => { loop.stop(); sparkle?.stop(); };
  }, [reduced, idle, glow, idx, motion, shiny]);

  useEffect(() => { if (fresh) play(); }, [fresh]); // eslint-disable-line react-hooks/exhaustive-deps

  const play = () => {
    tap.setValue(0);
    Animated.sequence([
      Animated.timing(tap, { toValue: 1, duration: reduced ? 1 : 260, easing: Easing.out(Easing.quad), useNativeDriver: native }),
      Animated.timing(tap, { toValue: 0, duration: reduced ? 1 : 520, easing: Easing.bounce, useNativeDriver: native }),
    ]).start();
  };
  const onTap = () => { sfx(shiny ? 'twinkle' : 'boing'); play(); };

  const r = (a: string, b: string) => idle.interpolate({ inputRange: [0, 1], outputRange: [a, b] });
  const n = (a: number, b: number) => idle.interpolate({ inputRange: [0, 1], outputRange: [a, b] });
  const idleT =
    motion === 'float' ? [{ translateY: n(0, -size * 0.09) }]
      : motion === 'wiggle' ? [{ rotate: r('-9deg', '9deg') }]
        : motion === 'pulse' ? [{ scale: n(0.94, 1.1) }]
          : motion === 'swing' ? [{ rotate: r('-16deg', '16deg') }, { translateX: n(-size * 0.03, size * 0.03) }]
            : motion === 'hop' ? [{ translateY: n(0, -size * 0.16) }]
              : [{ scaleX: n(1, -1) }];
  const tapT = [
    { translateY: tap.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.38] }) },
    { rotate: tap.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
    { scale: tap.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) },
  ];
  return (
    <Pressable onPress={onTap} testID={testID} accessibilityRole="button" accessibilityLabel="מדבקה">
      <Animated.View style={{ transform: tapT }}>
        <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: shiny ? '#FFF8D6' : '#FFFFFF',
          borderWidth: s(shiny ? 4 : 3), borderColor: shiny ? '#FFC928' : fresh ? pal.glow : pal.line }}>
          <Animated.Text style={{ fontSize: size * 0.56, transform: reduced ? [] : idleT }}>{stickerEmoji(id)}</Animated.Text>
          {shiny ? <Animated.Text style={{ position: 'absolute', top: -size * 0.08, right: -size * 0.04, fontSize: size * 0.3, opacity: reduced ? 1 : glow }}>✨</Animated.Text> : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}
