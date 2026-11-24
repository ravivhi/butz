/* Adventure map (SPEC §5, R-N3) and a world's games. Locked worlds explain themselves out loud (R-J3). */
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { GAME, WORLDS, type GameId, type WorldDef } from '../engine/curriculum';
import { freePlaySpec } from '../engine/planner';
import { makeRng } from '../engine/rng';
import { nfc } from '../engine/hebrew';
import { SAY, g } from '../engine/phrases';
import { back, go, knownFor, useProfile } from '../state/store';
import { Card, Screen, TopBar, Txt } from '../ui/kit';
import { ROW, useLayout, usePalette } from '../ui/theme';
import { RATE, say } from '../services/speech';
import { sfx } from '../services/sfx';

const STORY_WORLD: WorldDef = { id: 'storytime', name: nfc('שְׁעַת סִפּוּר'), emoji: '📚', color: '#F9A825', games: ['storyTime', 'storyPuzzle'] };
const LOCKED = g(SAY.locked, undefined);

function useOpenGames(): Set<GameId> {
  const p = useProfile()!;
  return useMemo(() => {
    const known = knownFor(p);
    const rng = makeRng(1);
    return new Set(Object.keys(GAME).filter((g) => freePlaySpec(g as GameId, p.learner, known, rng)) as GameId[]);
  }, [p, p.learner.recent.length, p.school.length]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function MapScreen() {
  const p = useProfile()!;
  const pal = usePalette();
  const { s } = useLayout();
  const open = useOpenGames();
  const worlds = [STORY_WORLD, ...WORLDS];
  return (
    <Screen testID="map" bg="#D7F0FF">
      <TopBar onClose={back} closeEmoji="🏠" stars={p.wallet.stars}><Txt size={26} font="read">{nfc('הַמַּפָּה')}</Txt></TopBar>
      <ScrollView contentContainerStyle={{ padding: s(16), gap: s(14), alignItems: 'center' }}>
        {worlds.map((w, i) => {
          const unlocked = w.games.some((g) => open.has(g));
          return (
            <View key={w.id} style={{ width: '100%', maxWidth: s(560), alignItems: i % 2 ? 'flex-start' : 'flex-end' }}>
              <Pressable testID={'world-' + w.id} accessibilityLabel={w.name}
                onPress={() => { sfx('tap'); if (unlocked) { say(w.name, { rate: RATE.talk }); go({ name: 'world', world: w.id }); } else say([w.name, LOCKED], { rate: RATE.talk }); }}>
                <Card color={unlocked ? w.color : '#CFD8DC'} style={{ flexDirection: ROW, alignItems: 'center', gap: s(12), minWidth: s(250), opacity: unlocked ? 1 : 0.75 }}>
                  <Text style={{ fontSize: s(52) }}>{unlocked ? w.emoji : '🔒'}</Text>
                  <View>
                    <Txt size={24} font="read" color="#FFFFFF" center={false}>{w.name}</Txt>
                    <Text style={{ fontSize: s(16) }}>{w.games.map((g) => GAME[g].icon).join(' ')}</Text>
                  </View>
                </Card>
              </Pressable>
              {i < worlds.length - 1 ? <Text style={{ fontSize: s(18), color: pal.soft, alignSelf: 'center' }}>• • •</Text> : null}
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

export function WorldScreen({ world }: { world: string }) {
  const p = useProfile()!;
  const { s } = useLayout();
  const open = useOpenGames();
  const w = world === 'storytime' ? STORY_WORLD : WORLDS.find((x) => x.id === world)!;
  return (
    <Screen testID={'world-screen-' + w.id} bg={w.color + '33'}>
      <TopBar onClose={back} closeEmoji="↩️" stars={p.wallet.stars}>
        <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(8) }}>
          <Text style={{ fontSize: s(30) }}>{w.emoji}</Text>
          <Txt size={24} font="read">{w.name}</Txt>
        </View>
      </TopBar>
      <ScrollView contentContainerStyle={{ flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', gap: s(16), padding: s(16) }}>
        {w.games.map((g) => {
          const ok = open.has(g);
          const def = GAME[g];
          return (
            <Pressable key={g} testID={'game-' + g} accessibilityLabel={def.name}
              onPress={() => { sfx('tap'); if (ok) { say(def.name, { rate: RATE.talk }); go({ name: 'play', source: 'free', game: g }); } else say([def.name, LOCKED], { rate: RATE.talk }); }}>
              <Card style={{ width: s(160), height: s(170), alignItems: 'center', justifyContent: 'center', gap: s(8), opacity: ok ? 1 : 0.5 }}>
                <Text style={{ fontSize: s(64) }}>{ok ? def.icon : '🔒'}</Text>
                <Txt size={19} font="read">{def.name}</Txt>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
