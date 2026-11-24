/* Adventure map (SPEC §5, R-N3) and a world's games. v1.1: every world and game is open from the start; a game the
   child's letters are not enough for borrows the next units of the spine (planner.openPlaySpec). Nothing is spoken. */
import { Pressable, ScrollView, Text, View } from 'react-native';
import { GAME, WORLDS, type WorldDef } from '../engine/curriculum';
import { nfc } from '../engine/hebrew';
import { back, go, useProfile } from '../state/store';
import { Card, Screen, TopBar, Txt } from '../ui/kit';
import { ROW, useLayout, usePalette } from '../ui/theme';
import { sfx } from '../services/sfx';

const STORY_WORLD: WorldDef = { id: 'storytime', name: nfc('שְׁעַת סִפּוּר'), emoji: '📚', color: '#F9A825', games: ['storyTime', 'storyPuzzle'] };

export function MapScreen() {
  const p = useProfile()!;
  const pal = usePalette();
  const { s } = useLayout();
  const worlds = [STORY_WORLD, ...WORLDS];
  return (
    <Screen testID="map" bg="#D7F0FF">
      <TopBar onClose={back} closeEmoji="🏠" stars={p.wallet.stars}><Txt size={26} font="read">{nfc('הַמַּפָּה')}</Txt></TopBar>
      <ScrollView contentContainerStyle={{ padding: s(16), gap: s(14), alignItems: 'center' }}>
        {worlds.map((w, i) => (
          <View key={w.id} style={{ width: '100%', maxWidth: s(560), alignItems: i % 2 ? 'flex-start' : 'flex-end' }}>
            <Pressable testID={'world-' + w.id} accessibilityLabel={w.name} onPress={() => { sfx('tap'); go({ name: 'world', world: w.id }); }}>
              <Card color={w.color} style={{ flexDirection: ROW, alignItems: 'center', gap: s(12), minWidth: s(250) }}>
                <Text style={{ fontSize: s(52) }}>{w.emoji}</Text>
                <View>
                  <Txt size={24} font="read" color="#FFFFFF" center={false}>{w.name}</Txt>
                  <Text style={{ fontSize: s(16) }}>{w.games.map((g) => GAME[g].icon).join(' ')}</Text>
                </View>
              </Card>
            </Pressable>
            {i < worlds.length - 1 ? <Text style={{ fontSize: s(18), color: pal.soft, alignSelf: 'center' }}>• • •</Text> : null}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

export function WorldScreen({ world }: { world: string }) {
  const p = useProfile()!;
  const { s } = useLayout();
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
          const def = GAME[g];
          return (
            <Pressable key={g} testID={'game-' + g} accessibilityLabel={def.name} onPress={() => { sfx('tap'); go({ name: 'play', source: 'free', game: g }); }}>
              <Card style={{ width: s(160), height: s(170), alignItems: 'center', justifyContent: 'center', gap: s(8) }}>
                <Text style={{ fontSize: s(64) }}>{def.icon}</Text>
                <Txt size={19} font="read">{def.name}</Txt>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
