/* GameHost (SPEC §8.1-§8.2): runs planned activities — mission card, show-me, items with help levels, feedback, stars.
   Silent by default (v1.1): nothing is spoken unless the child taps 🔊 / 💡 or a speaking tile. Feedback is sound
   effects and animation. The parent setting "autoSpeak" restores read-aloud stimuli, praise and stories.
   v1.3: instructions are written (on the mission card and above the game), games with a letter picker start with it,
   and every scored answer moves the game's hidden level (adjustLevel). */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { GAME, GOLDEN_GAMES, type GameId } from '../engine/curriculum';
import { generate, PICK_LETTERS, type ActivitySpec, type Item } from '../engine/generators';
import { LETTER, nfc } from '../engine/hebrew';
import { adjustLevel, closeReview, gameLevel, introduce, markSeen, record, dayKey, type Attempt, type Level } from '../engine/learner';
import { activityStars, goldenPrize, itemCredit } from '../engine/economy';
import { makeRng } from '../engine/rng';
import { DONE, MODEL, PRAISE, SAY, TRY, g } from '../engine/phrases';
import { knownFor, updateProfile, useProfile, type Profile } from '../state/store';
import { Big, Burst, Card, Dots, ListenButton, Pop, Round, Screen, Tile, TopBar, Txt } from '../ui/kit';
import { Butz, type Mood } from '../ui/Butz';
import { ROW, useLayout, usePalette } from '../ui/theme';
import { RATE, say, stopSpeech } from '../services/speech';
import { sfx } from '../services/sfx';
import { Mechanic, type HostItem } from './mechanics';

/** Content keys shown by an item (for anti-repetition). Generated stories also mark their story plan. */
const seenKeys = (it: HostItem): string[] => [
  ...(it.word ? ['w:' + it.word.id] : []),
  ...(it.story && it.pages ? ['st:' + it.story.id, ...(it.story.id.startsWith('g:') ? ['sch:' + it.story.id.split(':')[1]] : [])] : []),
  ...(it.id.startsWith('sw:') ? [it.id] : []), ...(it.trace && it.show?.letter ? ['tr:' + it.show.letter] : []),
];

/** Games whose item is heard, not seen: their 🔊 button wiggles until tapped (nothing plays by itself). */
const LISTEN: GameId[] = ['syllableHop'];
/** Games of independent items: when the hidden level changes mid-activity, the remaining items follow it at once. */
const RELEVEL = new Set<GameId>(['syllableHop', 'balloonPop', 'wordBakery', 'missingLetter']);
const PICK_TEXT = ['בְּחַר אוֹתִיּוֹת, כַּמָּה שֶׁתִּרְצֶה. לֹא בָּחַרְתָּ? בּוּץ יִבְחַר.', 'בַּחֲרִי אוֹתִיּוֹת, כַּמָּה שֶׁתִּרְצִי. לֹא בָּחַרְתְּ? בּוּץ יִבְחַר.'].map(nfc);

/** The child's units plus units lent to a free-play activity (every game is open from the map). */
const knownWith = (p: Profile, spec?: ActivitySpec) => new Set([...knownFor(p), ...(spec?.known ?? [])]);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A story activity becomes its page (unscored) + questions + puzzle. */
export function flatten(items: Item[]): HostItem[] {
  const out: HostItem[] = [];
  for (const it of items) {
    if (it.story && it.id.startsWith('story:')) {
      out.push({ ...it, pages: true, unscored: true });
      out.push(...(it.questions ?? []));
      if (it.puzzle) out.push(it.puzzle);
    } else out.push(it);
  }
  return out;
}

/** Letter picker (balloons, writing): the child chooses as many letters as they want; none = Butz chooses. */
function LetterPicker({ picks, onToggle, girl }: { picks: string[]; onToggle: (id: string) => void; girl: boolean }) {
  const pal = usePalette();
  const { s, w } = useLayout();
  const cell = 52;
  const cols = Math.max(5, Math.min(10, Math.floor((w - s(40)) / s(cell + 10))));
  return (
    <View testID="picker" style={{ alignItems: 'center', gap: s(8) }}>
      <Txt size={20} font="read" color={pal.soft}>{PICK_TEXT[girl ? 1 : 0]}</Txt>
      <View style={{ flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', gap: s(8), maxWidth: cols * s(cell + 10) }}>
        {PICK_LETTERS.map((id) => (
          <Tile key={id} testID={'pick-' + id} text={LETTER[id].base} size={cell} state={picks.includes(id) ? 'selected' : 'idle'} onPress={() => onToggle(id)} />
        ))}
      </View>
    </View>
  );
}

/** `golden`: golden envelopes won (story games). */
export interface SessionResult { stars: number; acts: number; early: boolean; golden: number }

export function GameHost({ plan, onFinish, onExit }: { plan: ActivitySpec[]; onFinish: (r: SessionResult) => void; onExit: () => void }) {
  const profile = useProfile()!;
  const pal = usePalette();
  const { s, short } = useLayout();
  const [ai, setAi] = useState(0);
  const [items, setItems] = useState<HostItem[]>([]);
  const [ii, setIi] = useState(0);
  const [phase, setPhase] = useState<'mission' | 'demo' | 'play' | 'done'>('mission');
  const [help, setHelp] = useState<0 | 1 | 2>(0);
  const [easy, setEasy] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [mood, setMood] = useState<Mood>('talk');
  const [burst, setBurst] = useState(0);
  const [cheer, setCheer] = useState(0);
  const [earned, setEarned] = useState(0);
  const [wonGolden, setWonGolden] = useState(false);
  const [picks, setPicks] = useState<string[]>([]);
  const st = useRef({ wrongs: 0, first: undefined as string | undefined, t0: 0, log: [] as Attempt[], credit: [] as number[], mastered: 0, struggle: 0, total: 0, golden: 0, recentMiss: [] as boolean[], early: false, locked: false, token: 0 });
  const rng = useMemo(() => makeRng(), []);
  const spec = plan[ai];
  const item = items[ii];
  const gender = profile.gender;
  const auto = profile.settings.autoSpeak;
  const say1 = (list: readonly (string | readonly [string, string])[]) => g(rng.pick([...list]), gender);
  const mission = spec ? GAME[spec.game].mission[gender === 'girl' ? 1 : 0] : '';
  const ctxFor = (sp: ActivitySpec) => ({ learner: profile.learner, known: knownWith(profile, sp), rng, fewerChoices: profile.settings.fewerChoices, audioBad: new Set(profile.audioBad) });

  const finishSession = useCallback((early: boolean) => {
    stopSpeech();
    const total = st.current.total;
    updateProfile((p) => { p.sessions.push({ day: dayKey(Date.now()), acts: ai + 1, stars: total }); if (p.sessions.length > 120) p.sessions.splice(0, p.sessions.length - 120); });
    onFinish({ stars: total, acts: plan.length, early, golden: st.current.golden });
  }, [ai, onFinish, plan.length]);

  /* ---------- activity start */
  useEffect(() => {
    if (!spec) return;
    const now = Date.now();
    if (spec.mode === 'demo') updateProfile((p) => { introduce(p.learner, spec.skill, now, 'demo'); if (p.learner.pushNext) p.learner.pushNext--; });
    const last = spec.pick ? (profile.learner.picks?.[spec.game] ?? []).filter((id) => LETTER[id]) : [];
    setPicks(last);
    const its = flatten(generate(last.length ? { ...spec, letters: last } : spec, ctxFor(spec)));
    Object.assign(st.current, { log: [], credit: [], mastered: 0, struggle: 0 });
    setEasy(false);
    if (!its.length) { advanceActivity(); return; }
    setItems(its);
    setIi(0);
    setPhase('mission');
    setMood('talk');
    st.current.token++;
  }, [ai]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- show me: read aloud only with autoSpeak; otherwise the child taps 🔊 and then "נְנַסֶּה" */
  useEffect(() => {
    if (phase !== 'demo' || !item?.demo || !auto) return;
    const my = ++st.current.token;
    setMood('talk');
    say(item.demo.lines, { rate: RATE.talk, gap: 250 }).then(() => { if (my === st.current.token) setTimeout(() => my === st.current.token && setPhase('play'), 500); });
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- item start: speak the stimulus, then name picture options */
  const speakItem = useCallback(async (it: HostItem, slow = false) => {
    const my = ++st.current.token;
    if (it.pages) return;
    if (it.say?.length) await say(it.say, { rate: slow ? RATE.slow : RATE.stimulus, gap: 150 });
    if (it.nameOptions && my === st.current.token) {
      for (const o of it.options) {
        if (my !== st.current.token) break;
        setHighlight(o.id);
        await say(o.say ?? '', { rate: RATE.stimulus, queue: true });
      }
      if (my === st.current.token) setHighlight(null);
    }
  }, []);

  useEffect(() => {
    if (phase !== 'play' || !item) return;
    Object.assign(st.current, { wrongs: 0, first: undefined, t0: Date.now(), locked: false });
    setHelp(0);
    setHighlight(null);
    setMood('happy');
    const keys = seenKeys(item);
    if (keys.length) updateProfile((p) => markSeen(p.learner, keys, Date.now()));
    if (auto) speakItem(item);
  }, [phase, ii, items]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- results: `raw` = the help the child really needed (memory games are logged as supported, but their
     flips are not mistakes), which moves the game's hidden level */
  const log = (it: HostItem, ok: boolean, h: 0 | 1 | 2, raw: 0 | 1 | 2 = h) => {
    if (it.unscored) return;
    const a: Attempt = { t: Date.now(), skill: it.skill, game: it.game, item: it.id, ok, help: h, first: st.current.first, ms: Date.now() - st.current.t0, review: spec?.mode === 'review' };
    st.current.log.push(a);
    st.current.credit.push(itemCredit(it.answer !== undefined, h));
    const lv = { moved: 0 };
    updateProfile((p) => {
      if (record(p.learner, a).mastered) st.current.mastered++;
      if (spec?.mode === 'demo') return;
      const before = gameLevel(p.learner, it.game);
      const after = adjustLevel(p.learner, it.game, raw);
      if (after !== before) lv.moved = after;
    });
    if (lv.moved && spec?.mode === 'independent' && RELEVEL.has(it.game)) relevel(lv.moved as Level);
    const miss = h > 0;
    st.current.recentMiss = [...st.current.recentMiss, miss].slice(-6);
    st.current.struggle = miss ? st.current.struggle + 1 : 0;
    if (st.current.struggle >= 3) setEasy(true);
  };

  /** Rebuild the items after the current one at the new hidden level (keeping the letters the child picked). */
  const relevel = (level: Level) => {
    const rest = items.length - (ii + 1);
    if (rest <= 0 || !spec) return;
    const letters = spec.pick && picks.length ? items.slice(ii + 1).map((x) => x.skill.slice(2)) : undefined;
    const fresh = flatten(generate({ ...spec, n: rest, level, ...(letters ? { letters } : {}) }, ctxFor(spec)));
    if (fresh.length) setItems((cur) => [...cur.slice(0, ii + 1), ...fresh.slice(0, rest)]);
  };

  const nextItem = () => {
    if (st.current.struggle >= 5) { finishActivity(); return; }
    if (ii + 1 < items.length) setIi(ii + 1);
    else finishActivity();
  };

  const onRight = async (o?: { stay?: boolean; quiet?: boolean }) => {
    if (st.current.locked || !item) return;
    st.current.locked = true;
    const h = Math.max(help, item.supported ? 1 : 0) as 0 | 1 | 2;
    log(item, h < 2, h, help);
    sfx('correct');
    setMood('cheer');
    setCheer((c) => c + 1);
    const my = ++st.current.token;
    if (auto) await say([say1(PRAISE), ...(o?.quiet ? [] : item.reveal ?? [])], { rate: RATE.talk });
    else await wait(o?.stay ? 250 : 700);
    if (my !== st.current.token) return;
    if (!o?.stay) setTimeout(() => my === st.current.token && nextItem(), 350);
    else st.current.locked = false;
  };

  const onWrong = (choice?: string, lines?: string[]) => {
    if (!item) return;
    sfx('wrong');
    setMood('think');
    if (st.current.first === undefined) st.current.first = choice;
    st.current.wrongs++;
    const level = (st.current.wrongs >= 2 ? 2 : 1) as 1 | 2;
    setHelp((hp) => (Math.max(hp, level) as 0 | 1 | 2));
    const my = ++st.current.token;
    if (!auto) { setTimeout(() => my === st.current.token && setMood('happy'), 700); return; }
    const cue = lines ?? item.hint ?? item.say ?? [];
    say(level === 1 ? [say1(TRY), ...cue] : [g(MODEL, gender), ...(item.reveal ?? cue)], { rate: RATE.slow, gap: 150 }).then(() => { if (my === st.current.token) setMood('happy'); });
  };

  const onHint = () => {
    if (!item || item.unscored) return;
    const level = Math.min(2, help + 1) as 1 | 2;
    setHelp(level);
    const lines = level === 1 ? (item.hint ?? item.say ?? []) : [g(MODEL, gender), ...(item.reveal ?? item.hint ?? [])];
    if (lines.length) say(lines, { rate: RATE.slow });
  };

  const onNext = () => { if (item?.unscored) log(item, true, 0); nextItem(); };

  /* ---------- activity end */
  const finishActivity = () => {
    stopSpeech();
    const scored = st.current.log;
    const isStory = spec.game === 'storyDetective';
    const credit = st.current.credit;
    const outcome = {
      items: Math.max(scored.length, isStory ? 1 : 0), independentOk: scored.filter((a) => a.ok && a.help === 0).length,
      success: credit.length ? credit.reduce((x, c) => x + c, 0) / credit.length : 0,
      review: spec.mode === 'review', mastered: st.current.mastered, story: GOLDEN_GAMES.has(spec.game),
    };
    const stars = activityStars(outcome);
    const golden = goldenPrize(outcome);
    updateProfile((p) => {
      if (spec.mode === 'review') closeReview(p.learner, spec.skill, scored, Date.now());
      p.wallet.stars += stars;
      if (golden) p.wallet.golden = (p.wallet.golden ?? 0) + 1;
    });
    st.current.total += stars;
    if (golden) st.current.golden++;
    const fatigue = st.current.recentMiss.length >= 6 && st.current.recentMiss.filter(Boolean).length > 3;
    st.current.early = fatigue;
    setEarned(stars);
    setWonGolden(golden);
    setPhase('done');
    setMood(stars ? 'cheer' : 'happy');
    if (stars) { setBurst((b) => b + 1); sfx('star'); }
    const my = ++st.current.token;
    const after = () => { if (my === st.current.token) setTimeout(() => my === st.current.token && advanceActivity(), auto ? 900 : 1800); };
    if (auto) say([stars ? say1(DONE) : g(SAY.noPrize, gender)], { rate: RATE.talk }).then(after);
    else after();
  };

  const advanceActivity = () => {
    if (st.current.early || ai + 1 >= plan.length) finishSession(st.current.early);
    else setAi(ai + 1);
  };

  const exit = () => { st.current.token++; stopSpeech(); onExit(); };

  /* ---------- test hook (web e2e): exposes the expected answer of the current item */
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    (globalThis as any).__butzGame = { item, phase, game: spec?.game, ai, ii, n: items.length, acts: plan.length, skip: () => setPhase('play') };
  });

  const replay = () => { if (item && (item.say?.length || item.nameOptions)) speakItem(item); };

  const togglePick = (id: string) => setPicks((ps) => (ps.includes(id) ? ps.filter((x) => x !== id) : [...ps, id]));
  const start = () => {
    stopSpeech();
    st.current.token++;
    let its = items;
    if (spec.pick) {
      updateProfile((p) => { p.learner.picks = { ...(p.learner.picks ?? {}), [spec.game]: picks }; });
      const fresh = flatten(generate(picks.length ? { ...spec, letters: picks } : spec, ctxFor(spec)));
      if (fresh.length) { its = fresh; setItems(fresh); }
    }
    setIi(0);
    setPhase(its[0]?.demo ? 'demo' : 'play');
  };

  const game = GAME[spec?.game ?? 'storyDetective'];
  const oriSize = Math.min(s(110), short * 0.22);
  return (
    <Screen testID="play">
      <TopBar onClose={exit} stars={profile.wallet.stars}>
        {phase === 'play' && items.length > 1 ? <Dots n={items.length} i={ii} /> : <Dots n={plan.length} i={ai} />}
      </TopBar>
      {phase === 'play' && item ? (
        <View style={{ paddingHorizontal: s(14), gap: s(2) }}>
          <View style={{ flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(8) }}>
              <Text style={{ fontSize: s(26) }}>{game.icon}</Text>
              <Txt size={18} font="uiMed" color={pal.soft}>{game.name}</Txt>
            </View>
            <View style={{ flexDirection: ROW, gap: s(10) }}>
              {!item.pages && (item.say?.length || item.nameOptions) ? (
                <ListenButton key={'listen-' + ai + ':' + ii} onPress={replay} size={50} attention={!auto && !!item.say?.length && LISTEN.includes(item.game)} />
              ) : null}
              {!item.unscored ? <Round emoji="💡" label="רמז" onPress={onHint} testID="hint" size={50} color="#FFF3C4" /> : null}
            </View>
          </View>
          <View testID="instruction"><Txt size={16} font="read" color={pal.soft} lines={2}>{mission}</Txt></View>
        </View>
      ) : null}
      <View style={{ flex: 1, padding: s(10) }}>
        {phase === 'mission' ? (
          <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: s(14), paddingVertical: s(8) }} testID="mission">
            <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(12) }}>
              <Text style={{ fontSize: s(spec?.pick ? 56 : 90) }}>{game.icon}</Text>
              <Txt size={32} font="read">{game.name}</Txt>
            </View>
            <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(12), maxWidth: s(720), paddingHorizontal: s(8) }}>
              {spec?.pick ? null : <Butz size={oriSize} mood="talk" />}
              <Card style={{ flexShrink: 1 }}>
                <View testID="mission-text"><Txt size={24} font="read">{mission}</Txt></View>
              </Card>
            </View>
            {spec?.pick ? <LetterPicker picks={picks} onToggle={togglePick} girl={gender === 'girl'} /> : null}
            <Big label="יוֹצְאִים!" emoji="▶️" color={pal.green} onPress={start} testID="go" glow />
          </ScrollView>
        ) : null}
        {phase === 'demo' && item?.demo ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: s(18) }} testID="demo">
            <Card style={{ alignItems: 'center', minWidth: s(200) }}>
              {item.demo.big ? <Txt font="read" size={110}>{item.demo.big}</Txt> : null}
              {item.demo.emoji ? <Text style={{ fontSize: s(70) }}>{item.demo.emoji}</Text> : null}
            </Card>
            <Card style={{ maxWidth: s(640) }}><Txt font="read" size={24}>{item.demo.lines.join(' ')}</Txt></Card>
            <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(14) }}>
              <Butz size={oriSize} mood="talk" />
              <ListenButton onPress={() => item.demo && say(item.demo.lines, { rate: RATE.talk, gap: 250 })} testID="demo-again" attention={false} size={64} />
            </View>
            <Big label="נְנַסֶּה!" emoji="✋" color={pal.green} onPress={() => { stopSpeech(); st.current.token++; setPhase('play'); }} testID="try" />
          </View>
        ) : null}
        {phase === 'play' && item ? (
          <Mechanic key={item.id + ':' + ii} item={item} help={help} easy={easy} highlight={highlight} known={knownWith(profile, spec)} auto={auto} onRight={onRight} onWrong={onWrong} onNext={onNext} replay={replay} />
        ) : null}
        {phase === 'done' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: s(16) }} testID="activity-done">
            <Butz size={Math.min(s(170), short * 0.36)} mood={earned ? 'cheer' : 'happy'} />
            {earned ? <Txt size={46} font="uiHeavy">{`+${earned} ⭐${wonGolden ? ' 🏆' : ''}`}</Txt>
              : <View testID="no-prize" style={{ maxWidth: s(560), paddingHorizontal: s(12) }}><Txt size={24} font="read">{g(SAY.noPrize, gender)}</Txt></View>}
            <Big label="מַמְשִׁיכִים" emoji="➡️" color={pal.green} onPress={() => { st.current.token++; stopSpeech(); advanceActivity(); }} testID="next-activity" />
          </View>
        ) : null}
      </View>
      {phase === 'play' && item && !item.story ? (
        <View pointerEvents="none" style={{ position: 'absolute', bottom: s(6), left: s(6) }}>
          <Butz size={Math.min(s(70), short * 0.15)} mood={mood} />
        </View>
      ) : null}
      <Burst run={burst} />
      <Pop run={cheer} />
    </Screen>
  );
}
