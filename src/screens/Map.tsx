/* Games list (SPEC §5, R-N3; was the adventure map): every game, in learning order, one below the other. Every game is open from the
   start; a game the child's letters are not enough for borrows the next units of the spine (planner.openPlaySpec).
   The map is the only place to choose a game. Nothing is spoken. */
import { Pressable, ScrollView, Text, View } from 'react-native';
import { GAME, GOLDEN_GAMES, MAP_ORDER } from '../engine/curriculum';
import { nfc } from '../engine/hebrew';
import { back, go, useProfile } from '../state/store';
import { Card, Screen, TopBar, Txt } from '../ui/kit';
import { ROW, useLayout, usePalette } from '../ui/theme';

export function MapScreen() {
  const p = useProfile()!;
  const pal = usePalette();
  const { s } = useLayout();
  return (
    <Screen testID="map" bg="#D7F0FF">
      <TopBar onClose={back} closeEmoji="🏠" stars={p.wallet.stars}><Txt size={26} font="read">{nfc('מִשְׂחָקִים')}</Txt></TopBar>
      <ScrollView contentContainerStyle={{ padding: s(16), paddingTop: s(22), gap: s(18), alignItems: 'center' }}>
        {MAP_ORDER.map((id) => {
          const def = GAME[id];
          const gold = GOLDEN_GAMES.has(id);
          const bubble = s(76);
          return (
            <Pressable key={id} testID={'game-' + id} accessibilityLabel={def.name} onPress={() => go({ name: 'play', game: id })} style={{ width: '100%', maxWidth: s(560) }}>
              <Card color={def.color} style={[{ flexDirection: ROW, alignItems: 'center', gap: s(14), paddingVertical: s(10) }, gold ? { borderColor: pal.gold, borderWidth: s(6), shadowColor: pal.gold } : null]}>
                <View style={{ width: bubble, height: bubble }}>
                  {/* special (starred) games: a big star sitting behind the icon bubble, sticking out at its top corner */}
                  {gold ? <Text testID={'golden-' + id} style={{ position: 'absolute', top: -s(34), right: -s(32), fontSize: s(66), lineHeight: s(78) }}>⭐</Text> : null}
                  <View style={{ width: bubble, height: bubble, borderRadius: bubble / 2, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: s(3), borderColor: gold ? pal.gold : 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: s(44) }}>{def.icon}</Text>
                  </View>
                </View>
                <Txt size={24} font="read" color={gold ? pal.ink : '#FFFFFF'} center={false} style={{ flex: 1 }}>{def.name}</Txt>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
