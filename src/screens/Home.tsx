/* Home (SPEC R-N1): one huge Map button (the only way to a game), notebooks, shop. First-run setup starts with the child's gender (R-PA2). */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { createProfile, go, switchProfile, useProfile, useStore } from '../state/store';
import { Big, Card, Screen, StarPill, Txt } from '../ui/kit';
import { Butz } from '../ui/Butz';
import { LiveSticker } from '../ui/LiveSticker';
import { FONT, ROW, useLayout, usePalette } from '../ui/theme';
import { onSpeechInfo, say, speechInfo } from '../services/speech';
import { envelopePrice } from '../engine/economy';
import { APP_NAME, BUTZ, SAY, g, type Gender } from '../engine/phrases';

export const AVATARS = ['🦊', '🐻', '🐼', '🐯', '🐰', '🐸', '🦄', '🐧', '🐶', '🐱', '🦁', '🐨'];

function NoVoiceBanner() {
  const { s } = useLayout();
  const [info, setInfo] = useState(speechInfo());
  useEffect(() => onSpeechInfo(() => setInfo(speechInfo())), []);
  if (!info.checked || info.hebrew) return null;
  return (
    <Card color="#FFF3C4" style={{ marginHorizontal: s(14), marginTop: s(6) }}>
      <Txt size={15} font="uiMed" center={false}>
        {`🔈 להורים: לא נמצא במכשיר קול עברי, ולכן ${BUTZ} לא יכול לדבר. ` +
          'iPhone/iPad: הגדרות ← נגישות ← תוכן מוקרא ← קולות ← עברית. ' +
          'Android: הגדרות ← טקסט לדיבור ← Google ← התקנת קול עברית. במחשב: פתחו ב-Edge.'}
      </Txt>
    </Card>
  );
}

/** The newest stickers, alive, next to Butz: a reminder of what practice buys. */
function LatestStickers() {
  const p = useProfile()!;
  const { s } = useLayout();
  const latest = Object.values(p.wallet.stickers).flat().filter((x) => !x.endsWith(':gold'));
  const show = latest.slice(-3);
  if (!show.length) return null;
  return (
    <View style={{ flexDirection: ROW, gap: s(10) }} testID="latest-stickers">
      {show.map((id) => <LiveSticker key={id} id={id} size={s(58)} testID={'live-' + id} />)}
    </View>
  );
}

export function Home() {
  const p = useProfile()!;
  const pal = usePalette();
  const { s, short, landscape } = useLayout();
  const surprise = p.wallet.stars >= envelopePrice(p.wallet) || !!p.wallet.golden;
  return (
    <Screen testID="home">
      <View style={{ flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between', padding: s(12) }}>
        <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(8) }}>
          <View testID="avatar" accessibilityLabel={p.name} style={{ width: s(50), height: s(50), borderRadius: s(25), backgroundColor: pal.card, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: s(28) }}>{p.avatar}</Text>
          </View>
          <Txt size={24} font="uiHeavy">{p.name}</Txt>
        </View>
        <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(10) }}>
          <StarPill n={p.wallet.stars} />
        </View>
      </View>
      <NoVoiceBanner />
      <View style={{ flex: 1, flexDirection: landscape ? ROW : 'column', alignItems: 'center', justifyContent: 'space-evenly', padding: s(12) }}>
        <View style={{ alignItems: 'center', gap: s(14) }}>
          <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(12) }}>
            {/* tapping Butz explains the app (no separate 👂 button on Home) */}
            <Pressable testID="help" accessibilityRole="button" accessibilityLabel="הסבר" onPress={() => say(g(SAY.homeHelp, p.gender))}>
              <Butz size={Math.min(s(170), short * 0.34)} mood="happy" />
            </Pressable>
          </View>
          <LatestStickers />
          <Big label="מִשְׂחָק" emoji="🎮" size="xl" color={pal.green} onPress={() => go({ name: 'map' })} testID="nav-map" glow />
        </View>
        <View style={{ flexDirection: landscape ? 'column' : ROW, gap: s(14), flexWrap: 'wrap', justifyContent: 'center' }}>
          <Big label="מַחְבָּרוֹת" emoji={surprise ? '✉️' : '📒'} size="m" color={pal.purple} onPress={() => go({ name: 'notebooks' })} testID="nav-notebooks" glow={surprise} />
          <Big label="חֲנוּת" emoji="🛍️" size="m" color={pal.pink} onPress={() => go({ name: 'shop' })} testID="nav-shop" />
        </View>
      </View>
    </Screen>
  );
}

/** First run (for the grown-up, or a child with help): 1. boy or girl, 2. name and a friend. */
export function Setup() {
  const pal = usePalette();
  const { s, t } = useLayout();
  const [gender, setGender] = useState<Gender | null>(null);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const profiles = useStore((st) => st.profiles);
  const cancel = profiles.length ? <Big label="ביטול" size="s" color={pal.soft} onPress={() => switchProfile(profiles[0].id)} testID="cancel-setup" /> : null;

  if (!gender) {
    return (
      <Screen testID="setup">
        <ScrollView contentContainerStyle={{ padding: s(18), gap: s(16), alignItems: 'center' }}>
          <Butz size={s(120)} />
          <Txt size={28} font="uiHeavy">{`ברוכים הבאים ל${APP_NAME}`}</Txt>
          <Txt size={16} font="uiMed" color={pal.soft}>
            {`מסע קריאה בעברית מנוקדת, מהצלילים ועד סיפורים. הילד/ה משחקים לבד: ${BUTZ} מסביר כשלוחצים על 👂 ומתאים את התרגול. כל המידע נשמר רק במכשיר הזה.`}
          </Txt>
          <Txt size={24} font="uiHeavy">מי ישחק?</Txt>
          <View style={{ flexDirection: ROW, gap: s(18), flexWrap: 'wrap', justifyContent: 'center' }}>
            {([['boy', '👦', 'בֵּן', pal.blue], ['girl', '👧', 'בַּת', pal.pink]] as const).map(([gd, emoji, label, color]) => (
              <Pressable key={gd} onPress={() => setGender(gd)} testID={'gender-' + gd} accessibilityLabel={label}>
                <Card color={color} style={{ width: s(150), height: s(170), alignItems: 'center', justifyContent: 'center', gap: s(6) }}>
                  <Text style={{ fontSize: s(76) }}>{emoji}</Text>
                  <Txt size={30} font="read" color="#FFFFFF">{label}</Txt>
                </Card>
              </Pressable>
            ))}
          </View>
          <Txt size={14} font="uiMed" color={pal.soft}>{`הבחירה קובעת איך ${BUTZ} פונה לילד/ה ואילו מחברות מדבקות יוצעו בחנות.`}</Txt>
          {cancel}
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen testID="setup-details">
      <ScrollView contentContainerStyle={{ padding: s(18), gap: s(16), alignItems: 'center' }}>
        <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(12) }}>
          <Butz size={s(100)} />
          <Text style={{ fontSize: s(56) }}>{gender === 'girl' ? '👧' : '👦'}</Text>
        </View>
        <Card style={{ width: '100%', maxWidth: s(520), gap: s(12) }}>
          <Txt size={18} font="ui" center={false}>{gender === 'girl' ? 'השם שלה (לא חובה)' : 'השם שלו (לא חובה)'}</Txt>
          <TextInput testID="name" value={name} onChangeText={setName} maxLength={24} placeholder={gender === 'girl' ? 'למשל: נועה' : 'למשל: יונתן'}
            style={{ fontFamily: FONT.ui, fontSize: t(22), borderWidth: s(2), borderColor: pal.line, borderRadius: s(14), padding: s(10), textAlign: 'right', writingDirection: 'rtl', color: pal.ink, backgroundColor: '#FFFFFF' }} />
          <Txt size={18} font="ui" center={false}>בחרו חבר/ה</Txt>
          <View style={{ flexDirection: ROW, flexWrap: 'wrap', gap: s(8), justifyContent: 'center' }}>
            {AVATARS.map((a) => (
              <Pressable key={a} onPress={() => setAvatar(a)} testID={'avatar-' + a}
                style={{ width: s(58), height: s(58), borderRadius: s(30), alignItems: 'center', justifyContent: 'center', borderWidth: s(avatar === a ? 4 : 2), borderColor: avatar === a ? pal.orange : pal.line, backgroundColor: avatar === a ? '#FFE7B8' : '#FFFFFF' }}>
                <Text style={{ fontSize: s(32) }}>{a}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
        <Big label="מתחילים!" emoji="🚀" color={pal.green} onPress={() => { createProfile(name, avatar, gender); go({ name: 'placement' }); }} testID="start" />
        <View style={{ flexDirection: ROW, gap: s(12) }}>
          <Big label="חזרה" emoji="↩️" size="s" color={pal.blue} onPress={() => setGender(null)} testID="setup-back" />
          {cancel}
        </View>
        <Txt size={13} font="uiMed" color={pal.soft}>
          {'אין פרסומות, אין רכישות ואין איסוף מידע. ההתקדמות היא תצפית למידה ולא אבחון.'}
        </Txt>
      </ScrollView>
    </Screen>
  );
}
