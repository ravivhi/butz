/* Adventure map (SPEC §5, R-N3): every game, in learning order, is a stop on one path. Every game is open from the
   start; a game the child's letters are not enough for borrows the next units of the spine (planner.openPlaySpec).
   The map is the only place to choose a game. Nothing is spoken. */
import { Pressable, ScrollView, Text, View } from 'react-native';
import { GAME, GOLDEN_GAMES, MAP_ORDER } from '../engine/curriculum';
import { nfc } from '../engine/hebrew';
import { back, go, useProfile } from '../state/store';
import { Card, Screen, TopBar, Txt } from '../ui/kit';
import { ROW, useLayout, usePalette } from '../ui/theme';
import { sfx } from '../services/sfx';

export function MapScreen() {
  const p = useProfile()!;
  const pal = usePalette();
  const { s } = useLayout();
  return (
    <Screen testID="map" bg="#D7F0FF">
      <TopBar onClose={back} closeEmoji="🏠" stars={p.wallet.stars}><Txt size={26} font="read">{nfc('הַמַּפָּה')}</Txt></TopBar>
      <ScrollView contentContainerStyle={{ padding: s(16), gap: s(14), alignItems: 'center' }}>
        {MAP_ORDER.map((id, i) => {
          const def = GAME[id];
          const gold = GOLDEN_GAMES.has(id);
          return (
            <View key={id} style={{ width: '100%', maxWidth: s(560), alignItems: i % 2 ? 'flex-start' : 'flex-end' }}>
              <Pressable testID={'game-' + id} accessibilityLabel={def.name} onPress={() => { sfx('tap'); go({ name: 'play', game: id }); }}>
                <Card color={def.color} style={[{ flexDirection: ROW, alignItems: 'center', gap: s(12), minWidth: s(250) }, gold ? { borderColor: pal.gold, borderWidth: s(6), shadowColor: pal.gold } : null]}>
                  <Text style={{ fontSize: s(52) }}>{def.icon}</Text>
                  <View>
                    <Txt size={24} font="read" color={gold ? pal.ink : '#FFFFFF'} center={false}>{def.name}</Txt>
                    {gold ? <Text testID={'golden-' + id} style={{ fontSize: s(20) }}>{'🏆 ✨ ⭐'}</Text> : null}
                  </View>
                </Card>
              </Pressable>
              {i < MAP_ORDER.length - 1 ? <Text style={{ fontSize: s(18), color: pal.soft, alignSelf: 'center' }}>• • •</Text> : null}
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
