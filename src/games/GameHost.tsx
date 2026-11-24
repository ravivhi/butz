/* GameHost (SPEC §8.1-§8.2): runs planned activities — mission card, show-me, items with help levels, feedback, stars.
   Instructions are never read automatically: the mission card is silent and 👂 speaks it on request. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { GAME } from '../engine/curriculum';
import { generate, type ActivitySpec, type Item } from '../engine/generators';
import { closeReview, introduce, markSeen, record, dayKey, type Attempt } from '../engine/learner';
import { activityStars } from '../engine/economy';
import { makeRng } from '../engine/rng';
import { DONE, MODEL, PRAISE, TRY, g } from '../engine/phrases';
import { knownFor, updateProfile, useProfile } from '../state/store';
import { Big, Burst, Card, Dots, HelpButton, Round, Screen, TopBar, Txt } from '../ui/kit';
import { Butz, type Mood } from '../ui/Butz';
import { ROW, useLayout, usePalette } from '../ui/theme';
import { RATE, say, stopSpeech } from '../services/speech';
import { sfx } from '../services/sfx';
import { Mechanic, type HostItem } from './mechanics';

/** Content keys shown by an item (for anti-repetition). */
const seenKeys = (it: HostItem): string[] => [
  ...(it.word ? ['w:' + it.word.id] : []), ...(it.sentence ? ['s:' + it.sentence.id] : []), ...(it.story ? ['st:' + it.story.id] : []),
  ...(it.id.startsWith('sw:') ? [it.id] : []),
];

/** Story activities become pages (unscored) + questions + puzzle. */
function flatten(items: Item[]): HostItem[] {
  const out: HostItem[] = [];
  for (const it of items) {
    if (it.story && it.id.startsWith('story:')) {
      out.push({ ...it, pages: true, unscored: true, listen: it.game === 'storyTime' });
      out.push(...(it.questions ?? []));
      if (it.puzzle) out.push(it.puzzle);
    } else if (it.story && it.game === 'storyPuzzle') {
      out.push({ ...it, id: 'pages:' + it.story.id, pages: true, unscored: true, listen: true, sequence: undefined });
      out.push(it);
    } else out.push(it);
  }
  return out;
}

export interface SessionResult { stars: number; acts: number; early: boolean }

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
  const [earned, setEarned] = useState(0);
  const st = useRef({ wrongs: 0, first: undefined as string | undefined, t0: 0, log: [] as Attempt[], mastered: 0, struggle: 0, total: 0, recentMiss: [] as boolean[], early: false, locked: false, token: 0 });
  const rng = useMemo(() => makeRng(), []);
  const spec = plan[ai];
  const item = items[ii];
  const gender = profile.gender;
  const say1 = (list: readonly (string | readonly [string, string])[]) => g(rng.pick([...list]), gender);
  const mission = spec ? GAME[spec.game].mission[gender === 'girl' ? 1 : 0] : '';
  const firstTime = spec ? !profile.learner.recent.some((a) => a.game === spec.game) : false;

  const finishSession = useCallback((early: boolean) => {
    stopSpeech();
    const total = st.current.total;
    updateProfile((p) => { p.sessions.push({ day: dayKey(Date.now()), acts: ai + 1, stars: total }); if (p.sessions.length > 120) p.sessions.splice(0, p.sessions.length - 120); });
    onFinish({ stars: total, acts: plan.length, early });
  }, [ai, onFinish, plan.length]);

  /* ---------- activity start */
  useEffect(() => {
    if (!spec) return;
    const now = Date.now();
    if (spec.mode === 'demo') updateProfile((p) => { introduce(p.learner, spec.skill, now, 'demo'); });
    const ctx = { learner: profile.learner, known: knownFor(profile), rng, fewerChoices: profile.settings.fewerChoices, audioBad: new Set(profile.audioBad) };
    const its = flatten(generate(spec, ctx));
    Object.assign(st.current, { log: [], mastered: 0, struggle: 0 });
    setEasy(false);
    if (!its.length) { advanceActivity(); return; }
    setItems(its);
    setIi(0);
    setPhase('mission');
    setMood('talk');
    st.current.token++;
  }, [ai]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- show me */
  useEffect(() => {
    if (phase !== 'demo' || !item?.demo) return;
    const my = ++st.current.token;
    setMood('talk');
    say(item.demo.lines, { rate: RATE.talk, gap: 250 }).then(() => { if (my === st.current.token) setTimeout(() => my === st.current.token && setPhase('play'), 500); });
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- item start: speak the stimulus, then name picture options */
  const speakItem = useCallback(async (it: HostItem, slow = false) => {
    const my = ++st.current.token;
    if (it.pages) return;
    if (it.say?.length) await say(it.say, { rate: slow ? RATE.slow : RATE.stimulus, gap: it.game === 'robotMixer' ? 350 : 150 });
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
    speakItem(item);
  }, [phase, ii, items]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- results */
  const log = (it: HostItem, ok: boolean, h: 0 | 1 | 2) => {
    if (it.unscored) return;
    const a: Attempt = { t: Date.now(), skill: it.skill, game: it.game, item: it.id, ok, help: h, first: st.current.first, ms: Date.now() - st.current.t0, review: spec?.mode === 'review' };
    st.current.log.push(a);
    updateProfile((p) => { if (record(p.learner, a).mastered) st.current.mastered++; });
    const miss = h > 0;
    st.current.recentMiss = [...st.current.recentMiss, miss].slice(-6);
    st.current.struggle = miss ? st.current.struggle + 1 : 0;
    if (st.current.struggle >= 3) setEasy(true);
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
    log(item, h < 2, h);
    sfx('correct');
    setMood('cheer');
    const my = ++st.current.token;
    await say([say1(PRAISE), ...(o?.quiet ? [] : item.reveal ?? [])], { rate: RATE.talk });
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
    const cue = lines ?? item.hint ?? item.say ?? [];
    say(level === 1 ? [say1(TRY), ...cue] : [g(MODEL, gender), ...(item.reveal ?? cue)], { rate: RATE.slow, gap: 150 }).then(() => { if (my === st.current.token) setMood('happy'); });
  };

  const onHint = () => {
    if (!item || item.unscored) return;
    const level = Math.min(2, help + 1) as 1 | 2;
    setHelp(level);
    say(level === 1 ? (item.hint ?? item.say ?? []) : [g(MODEL, gender), ...(item.reveal ?? item.hint ?? [])], { rate: RATE.slow });
  };

  const onNext = () => { if (item?.unscored) log(item, true, 0); nextItem(); };

  /* ---------- activity end */
  const finishActivity = () => {
    stopSpeech();
    const scored = st.current.log;
    const isStory = spec.game === 'storyTime' || spec.game === 'storyDetective';
    const stars = activityStars({ items: Math.max(scored.length, isStory ? 1 : 0), independentOk: scored.filter((a) => a.ok && a.help === 0).length, review: spec.mode === 'review', mastered: st.current.mastered });
    updateProfile((p) => {
      if (spec.mode === 'review') closeReview(p.learner, spec.skill, scored, Date.now());
      p.wallet.stars += stars;
    });
    st.current.total += stars;
    const fatigue = st.current.recentMiss.length >= 6 && st.current.recentMiss.filter(Boolean).length > 3;
    st.current.early = fatigue;
    setEarned(stars);
    setPhase('done');
    setMood('cheer');
    setBurst((b) => b + 1);
    sfx('star');
    const my = ++st.current.token;
    say([say1(DONE)], { rate: RATE.talk }).then(() => { if (my === st.current.token) setTimeout(() => my === st.current.token && advanceActivity(), 900); });
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

  const replay = () => {
    if (!item) return;
    if (item.say?.length || item.nameOptions) speakItem(item);
    else say(mission, { rate: RATE.talk });
  };

  const game = GAME[spec?.game ?? 'storyTime'];
  const oriSize = Math.min(s(110), short * 0.22);
  const start = () => { stopSpeech(); st.current.token++; setPhase(items[0]?.demo ? 'demo' : 'play'); };
  return (
    <Screen testID="play">
      <TopBar onClose={exit} stars={profile.wallet.stars}>
        {phase === 'play' && items.length > 1 ? <Dots n={items.length} i={ii} /> : <Dots n={plan.length} i={ai} />}
      </TopBar>
      {phase === 'play' && item ? (
        <View style={{ flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: s(14) }}>
          <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(8) }}>
            <Text style={{ fontSize: s(26) }}>{game.icon}</Text>
            <Txt size={18} font="uiMed" color={pal.soft}>{game.name}</Txt>
          </View>
          <View style={{ flexDirection: ROW, gap: s(10) }}>
            <HelpButton text={mission} size={50} testID="help-mission" />
            <Round emoji="🔊" label="שוב" onPress={replay} testID="replay" size={50} />
            {!item.unscored ? <Round emoji="💡" label="רמז" onPress={onHint} testID="hint" size={50} color="#FFF3C4" /> : null}
          </View>
        </View>
      ) : null}
      <View style={{ flex: 1, padding: s(10) }}>
        {phase === 'mission' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: s(18) }} testID="mission">
            <Text style={{ fontSize: s(100) }}>{game.icon}</Text>
            <Txt size={34} font="read">{game.name}</Txt>
            <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(14) }}>
              <Butz size={oriSize} mood="talk" />
              <HelpButton text={mission} attention={firstTime} size={64} testID="help-mission" />
            </View>
            <Big label="יוֹצְאִים!" emoji="▶️" color={pal.green} onPress={start} testID="go" glow />
          </View>
        ) : null}
        {phase === 'demo' && item?.demo ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: s(18) }} testID="demo">
            <Card style={{ alignItems: 'center', minWidth: s(200) }}>
              {item.demo.big ? <Txt font="read" size={110}>{item.demo.big}</Txt> : null}
              {item.demo.emoji ? <Text style={{ fontSize: s(70) }}>{item.demo.emoji}</Text> : null}
            </Card>
            <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(14) }}>
              <Butz size={oriSize} mood="talk" />
              <Round emoji="🔊" label="שוב" onPress={() => item.demo && say(item.demo.lines, { rate: RATE.talk, gap: 250 })} testID="demo-again" />
            </View>
            <Big label="נְנַסֶּה!" emoji="✋" color={pal.green} onPress={() => { stopSpeech(); st.current.token++; setPhase('play'); }} testID="try" />
          </View>
        ) : null}
        {phase === 'play' && item ? (
          <Mechanic key={item.id + ':' + ii} item={item} help={help} easy={easy} highlight={highlight} known={knownFor(profile)} onRight={onRight} onWrong={onWrong} onNext={onNext} replay={replay} />
        ) : null}
        {phase === 'done' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: s(16) }} testID="activity-done">
            <Butz size={Math.min(s(170), short * 0.36)} mood="cheer" />
            <Txt size={46} font="uiHeavy">{`+${earned} ⭐`}</Txt>
            <Big label="מַמְשִׁיכִים" emoji="➡️" color={pal.green} onPress={() => { st.current.token++; stopSpeech(); advanceActivity(); }} testID="next-activity" />
          </View>
        ) : null}
      </View>
      {phase === 'play' && item ? (
        <View pointerEvents="none" style={{ position: 'absolute', bottom: s(6), left: s(6) }}>
          <Butz size={Math.min(s(70), short * 0.15)} mood={mood} />
        </View>
      ) : null}
      <Burst run={burst} />
    </Screen>
  );
}
