/* Parents area (owner request, 27 Nov 2026): ⚙️ on Home → a multiplication question (both numbers 6–9) → one simple
   screen: time played today, the week at a glance, and per game a colour (doing well / practising / finding it hard),
   the hidden level, and "צפה בדוגמה" (an example at the child's current level, nothing is recorded).
   Grown-up text is plain Hebrew (no nikud); symbols and colours carry the meaning. */
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { DEFAULT_SPINE, GAME, type GameId } from '../engine/curriculum';
import { generate, type Item } from '../engine/generators';
import { LETTER } from '../engine/hebrew';
import { openPlaySpec } from '../engine/planner';
import { parentSummary, type GameStatus } from '../engine/report';
import { gameLevel, maxLevel } from '../engine/learner';
import { makeRng } from '../engine/rng';
import { back, go, knownFor, replace, useProfile } from '../state/store';
import { Big, Card, Screen, TopBar, Txt } from '../ui/kit';
import { ROW, useLayout, usePalette } from '../ui/theme';
import { stopSpeech } from '../services/speech';
import { flatten } from '../games/GameHost';
import { Mechanic, type HostItem } from '../games/mechanics';
import type { Gender } from '../engine/phrases';

/* ------------------------------------------------------------------ gate */

const newQuestion = (): [number, number] => {
  const a = 6 + Math.floor(Math.random() * 4);
  let b = 6 + Math.floor(Math.random() * 4);
  while (b === a) b = 6 + Math.floor(Math.random() * 4);
  return [a, b];
};

export function Gate() {
  const pal = usePalette();
  const { s } = useLayout();
  const [q, setQ] = useState(newQuestion);
  const [ans, setAns] = useState('');
  const [bad, setBad] = useState(false);
  const check = () => {
    if (!ans) return;
    if (Number(ans) === q[0] * q[1]) { replace({ name: 'parent' }); return; }
    setBad(true);
    setAns('');
    setQ(newQuestion());
  };
  const press = (k: string) => {
    if (k === '⌫') setAns((x) => x.slice(0, -1));
    else if (k === '✓') check();
    else { setBad(false); setAns((x) => (x.length < 3 ? x + k : x)); }
  };
  const key = s(64);
  return (
    <Screen testID="gate">
      <TopBar onClose={back} closeEmoji="🏠" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: s(16), padding: s(12) }}>
        <Txt size={26} font="uiHeavy">{'🔒 בקרת הורים'}</Txt>
        <Txt size={18} font="uiMed" color={pal.soft}>{'כדי להיכנס, פתרו את התרגיל'}</Txt>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: s(12), paddingHorizontal: s(24) }}>
          <Text testID="gate-q" style={{ fontSize: s(40), fontWeight: '800', color: pal.ink }}>{`${q[0]} × ${q[1]} =`}</Text>
          <Text testID="gate-answer" style={{ fontSize: s(40), fontWeight: '800', minWidth: s(70), textAlign: 'center', color: bad ? pal.bad : pal.blue }}>{ans || (bad ? '✗' : '?')}</Text>
        </Card>
        <View style={{ gap: s(10) }}>
          {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['⌫', '0', '✓']].map((row) => (
            <View key={row.join('')} style={{ flexDirection: 'row', gap: s(10) }}>
              {row.map((k) => (
                <Pressable key={k} testID={'key-' + k} accessibilityRole="button" accessibilityLabel={k} onPress={() => press(k)}
                  style={{ width: key, height: key, borderRadius: s(16), alignItems: 'center', justifyContent: 'center', borderWidth: s(3), borderColor: pal.line,
                    backgroundColor: k === '✓' ? pal.green : pal.card }}>
                  <Text style={{ fontSize: s(28), fontWeight: '800', color: k === '✓' ? '#FFFFFF' : pal.ink }}>{k}</Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

/* ------------------------------------------------------------------ the parents screen */

const STATUS: Record<GameStatus, { dot: string; boy: string; girl: string }> = {
  good: { dot: '🟢', boy: 'מצליח', girl: 'מצליחה' },
  ok: { dot: '🟡', boy: 'מתרגל', girl: 'מתרגלת' },
  hard: { dot: '🔴', boy: 'מתקשה', girl: 'מתקשה' },
  new: { dot: '🔵', boy: 'רק התחיל', girl: 'רק התחילה' },
  none: { dot: '⚪', boy: 'עוד לא שיחק', girl: 'עוד לא שיחקה' },
};
const word = (st: GameStatus, g: Gender) => STATUS[st][g === 'girl' ? 'girl' : 'boy'];
const DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

function LevelDots({ level, max, size = 12 }: { level: number; max: number; size?: number }) {
  const pal = usePalette();
  const { s } = useLayout();
  return (
    <View accessibilityLabel={`רמה ${level} מתוך ${max}`} style={{ flexDirection: ROW, gap: s(3) }}>
      {Array.from({ length: max }, (_, i) => (
        <View key={i} style={{ width: s(size), height: s(size), borderRadius: s(size / 2), backgroundColor: i < level ? pal.blue : 'transparent', borderWidth: s(2), borderColor: i < level ? pal.blue : pal.line }} />
      ))}
    </View>
  );
}

export function ParentArea() {
  const p = useProfile()!;
  const pal = usePalette();
  const { s } = useLayout();
  const sum = useMemo(() => parentSummary(p.learner, p.playMs, p.sessions, Date.now()), [p]);
  const good = sum.games.filter((g) => g.status === 'good').length;
  const hard = sum.games.filter((g) => g.status === 'hard').length;
  const peak = Math.max(10, ...sum.week.map((d) => d.minutes));
  const barH = s(80);
  return (
    <Screen testID="parent">
      <TopBar onClose={back} closeEmoji="🏠">
        <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(8) }}>
          <Text style={{ fontSize: s(26) }}>{p.avatar}</Text>
          <Txt size={22} font="uiHeavy">{`בקרת הורים · ${p.name}`}</Txt>
        </View>
      </TopBar>
      <ScrollView contentContainerStyle={{ padding: s(12), gap: s(12), alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: s(640), gap: s(12) }}>
          {/* today + the one-glance line */}
          <Card style={{ flexDirection: ROW, alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: s(10) }}>
            <View testID="today" style={{ alignItems: 'center' }}>
              <Txt size={16} font="uiMed" color={pal.soft}>{'היום'}</Txt>
              <Txt size={34} font="uiHeavy">{`⏱️ ${sum.todayMin} דק׳`}</Txt>
            </View>
            <View style={{ alignItems: 'center', gap: s(4) }}>
              <Txt size={18} font="uiMed">{`🟢 ${word('good', p.gender)} ב־${good}`}</Txt>
              <Txt size={18} font="uiMed">{`🔴 ${word('hard', p.gender)} ב־${hard}`}</Txt>
            </View>
          </Card>

          {/* the week: one bar per day (minutes), today in blue */}
          <Card style={{ gap: s(8) }}>
            <View testID="week" />
            <Txt size={18} font="uiHeavy" center={false}>{'השבוע'}</Txt>
            <View style={{ flexDirection: ROW, justifyContent: 'space-between', alignItems: 'flex-end' }}>
              {sum.week.map((d, i) => (
                <View key={d.day} style={{ alignItems: 'center', gap: s(3), flex: 1 }}>
                  <Txt size={13} font="uiMed" color={pal.soft}>{d.minutes ? String(d.minutes) : ''}</Txt>
                  <View style={{ height: barH, justifyContent: 'flex-end' }}>
                    <View style={{ width: s(22), height: Math.max(s(4), (d.minutes / peak) * barH), borderRadius: s(8), backgroundColor: d.minutes ? (i === 6 ? pal.blue : pal.green) : pal.line }} />
                  </View>
                  <Txt size={14} font={i === 6 ? 'uiHeavy' : 'uiMed'}>{DAYS[d.weekday]}</Txt>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: ROW, justifyContent: 'center', gap: s(16), flexWrap: 'wrap' }}>
              <Txt size={16} font="uiMed">{`⏱️ ${sum.weekMin} דק׳`}</Txt>
              <Txt size={16} font="uiMed">{`⭐ ${sum.weekStars}`}</Txt>
              {sum.weekRate !== null ? <Txt size={16} font="uiMed">{`✅ ${Math.round(sum.weekRate * 100)}%`}</Txt> : null}
            </View>
          </Card>

          {/* per game */}
          {sum.games.map((g) => {
            const def = GAME[g.game];
            return (
              <Card key={g.game} style={{ flexDirection: ROW, alignItems: 'center', gap: s(10), flexWrap: 'wrap', paddingVertical: s(10) }}>
                <View testID={'pg-' + g.game} accessibilityLabel={g.status} style={{ flexDirection: ROW, alignItems: 'center', gap: s(10), flex: 1, minWidth: s(200) }}>
                  <Text style={{ fontSize: s(34) }}>{def.icon}</Text>
                  <View style={{ flex: 1, gap: s(4) }}>
                    <Txt size={18} font="read" center={false}>{def.name}</Txt>
                    <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(10), flexWrap: 'wrap' }}>
                      <Txt size={16} font="uiMed" center={false}>{`${STATUS[g.status].dot} ${word(g.status, p.gender)}`}</Txt>
                      {g.status !== 'none' ? <LevelDots level={g.level} max={g.max} /> : null}
                    </View>
                  </View>
                </View>
                <Big label="צפה בדוגמה" emoji="👀" size="s" color={pal.purple} onPress={() => go({ name: 'preview', game: g.game })} testID={'example-' + g.game} />
              </Card>
            );
          })}
          <Txt size={14} font="uiMed" color={pal.soft}>{'🟢 מצליח · 🟡 מתרגל · 🔴 מתקשה · 🔵 רק התחיל · ●●○ הרמה במשחק'}</Txt>
        </View>
      </ScrollView>
    </Screen>
  );
}

/* ------------------------------------------------------------------ an example at the child's current level */

export function Preview({ game }: { game: string }) {
  const p = useProfile()!;
  const pal = usePalette();
  const { s } = useLayout();
  const def = GAME[game as GameId];
  const rng = useMemo(() => makeRng(), []);
  // a copy of the learner: making an example never changes the child's data
  const learner = useMemo(() => JSON.parse(JSON.stringify(p.learner)), []); // eslint-disable-line react-hooks/exhaustive-deps
  const known = useMemo(() => knownFor(p), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [round, setRound] = useState(0);
  const items = useMemo<HostItem[]>(() => {
    if (!def) return [];
    const spec = openPlaySpec(def.id, learner, known, rng, p.spine?.length ? p.spine : DEFAULT_SPINE);
    const picks = spec.pick ? (learner.picks?.[def.id] ?? []).filter((id: string) => LETTER[id]) : [];
    const its: Item[] = generate({ ...spec, mode: 'independent', ...(picks.length ? { letters: picks } : {}) },
      { learner, known: new Set([...known, ...(spec.known ?? [])]), rng, fewerChoices: false, audioBad: new Set(p.audioBad) });
    return flatten(its).map((it) => ({ ...it, demo: undefined }));
  }, [round]); // eslint-disable-line react-hooks/exhaustive-deps
  const [ii, setIi] = useState(0);
  const [right, setRight] = useState(false);
  const busy = useRef(false);
  const item = items[ii];
  const level = gameLevel(learner, game);
  const next = () => {
    stopSpeech();
    setRight(false);
    busy.current = false;
    if (ii + 1 < items.length) setIi(ii + 1);
    else { setIi(0); setRound((r) => r + 1); }
  };
  if (!def) return null;
  return (
    <Screen testID="preview">
      <TopBar onClose={() => { stopSpeech(); back(); }} closeEmoji="↩️" closeLabel="חזרה">
        <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(8), flexWrap: 'wrap', justifyContent: 'center' }}>
          <Text style={{ fontSize: s(26) }}>{def.icon}</Text>
          <Txt size={20} font="read">{def.name}</Txt>
          <View testID="preview-level" accessibilityLabel={String(level)}><LevelDots level={level} max={maxLevel(game)} size={10} /></View>
        </View>
      </TopBar>
      <View style={{ paddingHorizontal: s(14), alignItems: 'center', gap: s(4) }}>
        <Txt size={15} font="uiMed" color={pal.soft}>{'👀 דוגמה ברמה הנוכחית. אפשר לנסות; שום דבר לא נשמר.'}</Txt>
        <Txt size={17} font="read" color={pal.soft} lines={3}>{def.mission[p.gender === 'girl' ? 1 : 0]}</Txt>
      </View>
      <View style={{ flex: 1, padding: s(10) }}>
        {item ? (
          <Mechanic key={round + ':' + ii} item={item} help={0} easy={false} highlight={null} known={known} auto={false}
            onRight={async (o) => { if (o?.stay) return; if (busy.current) return; busy.current = true; setRight(true); }}
            onWrong={() => undefined} onNext={next} replay={() => undefined} />
        ) : <Txt size={20} font="uiMed">{'אין דוגמה כרגע'}</Txt>}
      </View>
      <View style={{ flexDirection: ROW, justifyContent: 'center', alignItems: 'center', gap: s(14), padding: s(10) }}>
        {right ? <Txt size={28} font="uiHeavy" color={pal.good}>{'✓'}</Txt> : null}
        <Big label="דוגמה נוספת" emoji="🔄" size="s" color={pal.blue} onPress={next} testID="preview-next" />
      </View>
    </Screen>
  );
}
