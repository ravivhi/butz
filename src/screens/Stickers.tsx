/* Sticker notebooks, surprise envelopes and the shop (SPEC §10). Tap-only; nothing is ever taken away.
   Stickers are alive (LiveSticker); the shop only offers notebooks for the child's gender; nothing is read aloud unasked
   (spoken lines only with the parent's autoSpeak setting; otherwise sound effects). */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { GOLD_STICKER, NOTEBOOK, isShiny, notebooksFor, stickerEmoji, stickerId } from '../engine/content/stickers';
import { buyNotebook, envelopePrice, notebookFull, notebookPrice, openEnvelope, progress } from '../engine/economy';
import { makeRng } from '../engine/rng';
import { SAY, g, needMore } from '../engine/phrases';
import { back, current, go, replace, updateProfile, useProfile } from '../state/store';
import { Big, Burst, Card, HelpButton, Round, Screen, TopBar, Txt } from '../ui/kit';
import { Butz } from '../ui/Butz';
import { LiveSticker } from '../ui/LiveSticker';
import { ROW, useLayout, usePalette, useSettings } from '../ui/theme';
import { RATE, say } from '../services/speech';
import { sfx } from '../services/sfx';

const native = Platform.OS !== 'web';
const PER_PAGE = 6;
/** Speak only when the parent turned on read-aloud. */
const talk = (text: string | string[]) => { if (current()?.settings.autoSpeak) say(text, { rate: RATE.talk }); };

export function Notebooks() {
  const p = useProfile()!;
  const pal = usePalette();
  const { s } = useLayout();
  const price = envelopePrice(p.wallet);
  const can = p.wallet.stars >= price;
  const shown = [...notebooksFor(p.gender), ...p.wallet.owned.map((id) => NOTEBOOK[id]).filter((n) => n && n.gender !== 'all' && n.gender !== p.gender)];
  return (
    <Screen testID="notebooks">
      <TopBar onClose={back} closeEmoji="🏠" stars={p.wallet.stars}>
        <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(10) }}>
          <Txt size={26} font="read">{g(SAY.notebooks, p.gender)}</Txt>
          <HelpButton text={g(SAY.notebooksHelp, p.gender)} size={46} />
        </View>
      </TopBar>
      <View style={{ flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: s(12), paddingBottom: s(6) }}>
        {p.wallet.golden ? <Big label="מַעֲטָפַת זָהָב!" emoji="🏆" color={pal.gold} glow onPress={() => go({ name: 'notebook', id: p.wallet.active })} testID="golden-surprise" /> : null}
        {can ? <Big label="הַפְתָּעָה!" emoji="✉️" color={pal.purple} glow onPress={() => go({ name: 'notebook', id: p.wallet.active, open: true })} testID="surprise" />
          : <Txt size={18} font="uiMed" color={pal.soft}>{`✉️ ${p.wallet.stars}/${price} ⭐`}</Txt>}
      </View>
      <ScrollView contentContainerStyle={{ flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', gap: s(14), padding: s(14) }}>
        {shown.map((n) => {
          const owned = p.wallet.owned.includes(n.id);
          const pr = progress(p.wallet, n.id);
          return (
            <Pressable key={n.id} testID={'nb-' + n.id} accessibilityLabel={n.name}
              onPress={() => { if (owned) go({ name: 'notebook', id: n.id }); else { talk([n.name, g(SAY.inShop, p.gender)]); go({ name: 'shop' }); } }}>
              <Card color={owned ? n.color : '#CFD8DC'} style={{ width: s(150), height: s(180), alignItems: 'center', justifyContent: 'center', gap: s(6), opacity: owned ? 1 : 0.6 }}>
                <Text style={{ fontSize: s(60) }}>{owned ? n.cover : '🔒'}</Text>
                <Txt size={16} font="read" color="#FFFFFF">{n.name}</Txt>
                {owned ? <Txt size={18} font="uiHeavy" color="#FFFFFF">{notebookFull(p.wallet, n.id) ? `${GOLD_STICKER} ${pr.have}/${pr.total}` : `${pr.have}/${pr.total}`}</Txt> : null}
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

export function NotebookView({ id, open }: { id: string; open?: boolean }) {
  const p = useProfile()!;
  const pal = usePalette();
  const { s, w, h } = useLayout();
  const reduced = useSettings().reducedMotion;
  const nb = NOTEBOOK[id];
  const pages = Math.ceil(nb.stickers.length / PER_PAGE);
  const [page, setPage] = useState(0);
  const [reveal, setReveal] = useState<{ sticker: string; completed: boolean; notebook: string } | null>(null);
  const shown = useRef<{ sticker: string; completed: boolean; notebook: string } | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const pop = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const have = new Set(p.wallet.stickers[id] ?? []);
  const price = envelopePrice(p.wallet);
  const canOpen = p.wallet.stars >= price && !notebookFull(p.wallet, id);
  const canGolden = !!p.wallet.golden && !notebookFull(p.wallet, id);

  useEffect(() => {
    if (p.wallet.active !== id) updateProfile((pp) => { pp.wallet.active = id; });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The envelope wiggles when it can be opened.
  useEffect(() => {
    if (!canOpen || reduced) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 120, useNativeDriver: native }),
      Animated.timing(shake, { toValue: -1, duration: 120, useNativeDriver: native }),
      Animated.timing(shake, { toValue: 0, duration: 120, useNativeDriver: native }),
      Animated.delay(1200),
    ]));
    loop.start();
    return () => loop.stop();
  }, [canOpen, reduced, shake]);

  const openIt = (golden = false) => {
    let res: ReturnType<typeof openEnvelope> | undefined;
    updateProfile((pp) => { pp.wallet.active = id; res = openEnvelope(pp.wallet, makeRng(), golden); });
    if (!res) return;
    if (!res.ok) { talk(res.reason === 'stars' ? needMore(price - p.wallet.stars, p.gender) : g(SAY.allFull, p.gender)); return; }
    sfx('reveal');
    setReveal({ sticker: res.sticker, completed: res.completed, notebook: res.notebook });
    shown.current = { sticker: res.sticker, completed: res.completed, notebook: res.notebook };
    pop.setValue(0);
    Animated.timing(pop, { toValue: 1, duration: reduced ? 1 : 800, easing: Easing.out(Easing.back(2)), useNativeDriver: native }).start();
    talk(g(isShiny(res.sticker) ? SAY.shinySticker : SAY.newSticker, p.gender));
  };
  const place = () => {
    const reveal = shown.current;
    if (!reveal) return;
    shown.current = null;
    const idx = Number(reveal.sticker.split(':')[1]);
    if (reveal.notebook !== id) { replace({ name: 'notebook', id: reveal.notebook }); return; }
    setPage(Math.floor(idx / PER_PAGE));
    setFresh(reveal.sticker);
    sfx(isShiny(reveal.sticker) ? 'twinkle' : 'star');
    setBurst((b) => b + 1);
    if (reveal.completed) { sfx('win'); talk(g(SAY.notebookDone, p.gender)); }
    setReveal(null);
  };
  const placeRef = useRef(place);
  placeRef.current = place;
  useEffect(() => {
    if (!reveal) return;
    const tm = setTimeout(() => placeRef.current(), reduced ? 900 : 1700);
    return () => clearTimeout(tm);
  }, [reveal, reduced]);

  const slot = Math.max(s(56), Math.min(s(110), (w - s(70)) / 3 - s(12), (h - s(330)) / 2 - s(12)));
  return (
    <Screen testID="notebook" bg={nb.color + '40'}>
      <TopBar onClose={back} closeEmoji="↩️" stars={p.wallet.stars}>
        <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(10) }}>
          <Txt size={22} font="read">{nb.name}</Txt>
          <HelpButton text={g(SAY.notebooksHelp, p.gender)} size={46} />
        </View>
      </TopBar>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
        <Card style={{ padding: s(16) }}>
          <View style={{ flexDirection: ROW, flexWrap: 'wrap', width: slot * 3 + s(24), gap: s(12), justifyContent: 'center' }}>
            {Array.from({ length: PER_PAGE }, (_, k) => {
              const i = page * PER_PAGE + k;
              if (i >= nb.stickers.length) return null;
              const sid = stickerId(id, i);
              return have.has(sid) ? (
                <LiveSticker key={sid} id={sid} size={slot} testID={'sticker-' + sid} fresh={fresh === sid} />
              ) : (
                <View key={sid} testID={'slot-' + i}
                  style={{ width: slot, height: slot, borderRadius: slot / 2, alignItems: 'center', justifyContent: 'center', borderWidth: s(3), borderStyle: 'dashed', borderColor: pal.line, backgroundColor: 'rgba(255,255,255,0.4)' }}>
                  <Text style={{ fontSize: slot * 0.5, opacity: 0.12 }}>{isShiny(sid) ? '✨' : '?'}</Text>
                </View>
              );
            })}
          </View>
          {have.has(stickerId(id, 'gold')) && page === pages - 1 ? <View style={{ alignItems: 'center', marginTop: s(8) }}><LiveSticker id={stickerId(id, 'gold')} size={s(70)} /></View> : null}
        </Card>
        <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(16) }}>
          <Round emoji="➡️" label="עמוד קודם" onPress={() => setPage((x) => Math.max(0, x - 1))} testID="page-prev" />
          <Txt size={20} font="uiHeavy">{`${page + 1}/${pages}`}</Txt>
          <Round emoji="⬅️" label="עמוד הבא" onPress={() => setPage((x) => Math.min(pages - 1, x + 1))} testID="page-next" />
        </View>
        {canGolden ? <Big label="מַעֲטָפַת זָהָב!" emoji="🏆" color={pal.gold} glow onPress={() => openIt(true)} testID="golden-envelope" /> : null}
        {canOpen ? (
          <Animated.View style={{ transform: [{ rotate: shake.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] }) }] }}>
            <Big label="הַפְתָּעָה!" emoji="✉️" color={pal.purple} glow onPress={() => openIt()} testID="envelope" />
          </Animated.View>
        ) : (
          <Txt size={18} font="uiMed" color={pal.soft}>{notebookFull(p.wallet, id) ? GOLD_STICKER : `✉️ ${p.wallet.stars}/${price} ⭐`}</Txt>
        )}
      </View>
      {reveal ? (
        // the new sticker spins in and then flies into the notebook by itself (a tap only makes it go sooner)
        <Pressable onPress={place} accessibilityLabel="מַדְבֵּקָה" testID="reveal" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(36,48,74,0.75)', alignItems: 'center', justifyContent: 'center', gap: s(20) }}>
          <Animated.View style={{ transform: [{ scale: pop }, { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-200deg', '0deg'] }) }] }}>
            <View style={{ width: s(220), height: s(220), borderRadius: s(110), backgroundColor: isShiny(reveal.sticker) ? '#FFC928' : NOTEBOOK[reveal.notebook].color, borderWidth: s(6), borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: s(130) }}>{stickerEmoji(reveal.sticker)}</Text>
            </View>
          </Animated.View>
          {isShiny(reveal.sticker) ? <Txt size={26} font="read" color="#FFE082">✨ ✨ ✨</Txt> : null}
        </Pressable>
      ) : null}
      <Burst run={burst} emojis={['⭐', '✨', '🎉', stickerEmoji(fresh ?? '')]} />
    </Screen>
  );
}

export function Shop() {
  const p = useProfile()!;
  const pal = usePalette();
  const { s } = useLayout();
  const price = envelopePrice(p.wallet);
  const nbPrice = notebookPrice(p.wallet);
  const forSale = notebooksFor(p.gender).filter((n) => !p.wallet.owned.includes(n.id));
  const buyEnvelope = () => {
    if (p.wallet.stars < price) { talk(needMore(price - p.wallet.stars, p.gender)); return; }
    go({ name: 'notebook', id: p.wallet.active, open: true });
  };
  const buy = (id: string) => {
    let ok = false;
    updateProfile((pp) => { ok = buyNotebook(pp.wallet, id).ok; });
    if (ok) { sfx('win'); talk(g(SAY.newNotebook, p.gender)); go({ name: 'notebook', id }); }
    else { talk(needMore(nbPrice - p.wallet.stars, p.gender)); }
  };
  return (
    <Screen testID="shop" bg="#FFE3F1">
      <TopBar onClose={back} closeEmoji="🏠" stars={p.wallet.stars}>
        <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(10) }}>
          <Txt size={26} font="read">{'חֲנוּת'}</Txt>
          <HelpButton text={g(SAY.shopHelp, p.gender)} size={46} />
        </View>
      </TopBar>
      <ScrollView contentContainerStyle={{ padding: s(14), gap: s(16), alignItems: 'center' }}>
        <Pressable onPress={buyEnvelope} testID="buy-envelope" accessibilityLabel="מעטפת הפתעה">
          <Card style={{ flexDirection: ROW, alignItems: 'center', gap: s(14), minWidth: s(280) }}>
            <Text style={{ fontSize: s(64) }}>✉️</Text>
            <View style={{ alignItems: 'center' }}>
              <Txt size={22} font="read">{'מַעֲטָפַת הַפְתָּעָה'}</Txt>
              <Txt size={24} font="uiHeavy">{`${price} ⭐`}</Txt>
            </View>
          </Card>
        </Pressable>
        <View style={{ flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', gap: s(14) }}>
          {forSale.map((n) => (
            <Pressable key={n.id} onPress={() => buy(n.id)} testID={'buy-' + n.id} accessibilityLabel={n.name}>
              <Card color={n.color} style={{ width: s(150), height: s(200), alignItems: 'center', justifyContent: 'center', gap: s(6) }}>
                <Text style={{ fontSize: s(56) }}>{n.cover}</Text>
                <Txt size={15} font="read" color="#FFFFFF">{n.name}</Txt>
                <Text style={{ fontSize: s(18) }}>{n.stickers.slice(1, 4).join(' ')}</Text>
                <Txt size={22} font="uiHeavy" color="#FFFFFF">{`${nbPrice} ⭐`}</Txt>
              </Card>
            </Pressable>
          ))}
        </View>
        {!forSale.length ? <Butz size={s(120)} mood="cheer" /> : null}
      </ScrollView>
    </Screen>
  );
}
