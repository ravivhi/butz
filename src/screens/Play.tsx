/* Play: a Continue session or free play; session end with the surprise envelope; the playful starting check. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { GameHost, type SessionResult } from '../games/GameHost';
import { Mechanic, type HostItem } from '../games/mechanics';
import { DEFAULT_SPINE, GAME, type GameId } from '../engine/curriculum';
import { freePlaySpec, planSession, playedStoryToday } from '../engine/planner';
import { answerPlacement, currentItem, startPlacement, type PlacementState } from '../engine/placement';
import { envelopePrice, STARS } from '../engine/economy';
import { makeRng } from '../engine/rng';
import { BUTZ, SAY, g } from '../engine/phrases';
import { back, go, home, knownFor, replace, updateProfile, useProfile } from '../state/store';
import { Big, Burst, Dots, HelpButton, Screen, TopBar, Txt } from '../ui/kit';
import { Butz } from '../ui/Butz';
import { ROW, useLayout, usePalette } from '../ui/theme';
import { RATE, say, stopSpeech } from '../services/speech';
import { sfx } from '../services/sfx';

export function Play({ source, game }: { source: 'session' | 'free'; game?: string }) {
  const p = useProfile()!;
  const [result, setResult] = useState<SessionResult | null>(null);
  const [run, setRun] = useState(0);
  const plan = useMemo(() => {
    const rng = makeRng();
    const known = knownFor(p);
    if (source === 'free' && game) {
      const spec = freePlaySpec(game as GameId, p.learner, known, rng);
      return spec ? [spec] : [];
    }
    return planSession({ learner: p.learner, known, now: Date.now(), minutes: p.settings.minutes, storyToday: playedStoryToday(p.learner, Date.now()), rng, spine: p.spine?.length ? p.spine : DEFAULT_SPINE });
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps
  if (Platform.OS === 'web') (globalThis as any).__butzPlan = plan;
  useEffect(() => { if (!plan.length) back(); }, [plan]);
  if (result) return <SessionEnd result={result} source={source} again={() => { setResult(null); setRun((r) => r + 1); }} />;
  if (!plan.length) return null;
  return <GameHost key={run} plan={plan} onFinish={setResult} onExit={() => { stopSpeech(); back(); }} />;
}

function SessionEnd({ result, source, again }: { result: SessionResult; source: 'session' | 'free'; again: () => void }) {
  const p = useProfile()!;
  const pal = usePalette();
  const { s, short } = useLayout();
  const [burst] = useState(1);
  const said = useRef(false);
  const price = envelopePrice(p.wallet);
  if (!said.current) {
    said.current = true;
    sfx('win');
    say(g(result.early ? SAY.sessionEndEarly : SAY.sessionEnd, p.gender), { rate: RATE.talk });
  }
  return (
    <Screen testID="session-end">
      <TopBar onClose={home} closeEmoji="🏠" stars={p.wallet.stars} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly', padding: s(14) }}>
        <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(12) }}>
          <Butz size={Math.min(s(200), short * 0.4)} mood="cheer" />
          <HelpButton text={g(SAY.sessionEndHelp, p.gender)} />
        </View>
        <Txt size={44} font="uiHeavy">{`+${result.stars} ⭐`}</Txt>
        <View style={{ flexDirection: ROW, gap: s(14), flexWrap: 'wrap', justifyContent: 'center' }}>
          {p.wallet.stars >= price ? (
            <Big label="הַפְתָּעָה!" emoji="✉️" color={pal.purple} glow onPress={() => replace({ name: 'notebook', id: p.wallet.active, open: true })} testID="open-surprise" />
          ) : null}
          <Big label="עוֹד!" emoji="▶️" color={pal.green} onPress={again} testID="again" />
          <Big emoji="🏠" color={pal.blue} onPress={home} testID="home-btn" />
        </View>
        {source === 'session' && p.wallet.stars < price ? (
          <Txt size={20} font="uiMed" color={pal.soft}>{`✉️ ${p.wallet.stars}/${price} ⭐`}</Txt>
        ) : null}
      </View>
      <Burst run={burst} emojis={['⭐', '🎉', '✨', '🏆']} />
    </Screen>
  );
}

/* ------------------------------------------------------------------ playful starting check (SPEC §7.1) */

export function Placement() {
  const p = useProfile()!;
  const pal = usePalette();
  const { s, short } = useLayout();
  const rng = useMemo(() => makeRng(), []);
  const ctx = () => ({ learner: p.learner, known: knownFor(p), rng, fewerChoices: false, audioBad: new Set(p.audioBad) });
  const st = useRef<PlacementState | null>(null);
  const [stage, setStage] = useState<'intro' | 'play' | 'done'>('intro');
  const [, force] = useState(0);
  const [locked, setLocked] = useState(false);
  const item = st.current ? (currentItem(st.current) as HostItem | undefined) : undefined;
  if (Platform.OS === 'web') (globalThis as any).__butzGame = { item, phase: stage === 'play' ? 'play' : stage, game: item?.game };

  const speakItem = (it: HostItem | undefined) => {
    if (!it) return;
    say([...(it.say ?? []), ...(it.nameOptions ? it.options.map((o) => o.say) : [])], { rate: RATE.stimulus, gap: 150 });
  };
  const begin = () => {
    stopSpeech();
    st.current = startPlacement(ctx());
    setStage('play');
    speakItem(currentItem(st.current));
  };
  const answer = async (ok: boolean) => {
    if (!st.current || locked) return;
    setLocked(true);
    sfx(ok ? 'correct' : 'tap');
    await say(g(ok ? SAY.placementOk : SAY.placementNext, p.gender), { rate: RATE.talk });
    updateProfile((pp) => answerPlacement(st.current!, pp.learner, { ...ctx(), known: knownFor(pp) }, ok, Date.now()));
    setLocked(false);
    const next = currentItem(st.current);
    if (!next) {
      updateProfile((pp) => { pp.wallet.stars += STARS.placement; });
      setStage('done');
      sfx('win');
      say(g(SAY.placementDone, p.gender), { rate: RATE.talk });
    } else {
      force((x) => x + 1);
      speakItem(next);
    }
  };

  if (stage === 'intro') {
    return (
      <Screen testID="placement-intro">
        <TopBar onClose={home} closeEmoji="🏠" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
          <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(12) }}>
            <Butz size={Math.min(s(200), short * 0.42)} mood="talk" />
            <HelpButton text={g(SAY.placementHelp, p.gender)} attention size={64} />
          </View>
          <Txt size={30} font="read">{`שָׁלוֹם! אֲנִי ${BUTZ} 🦉`}</Txt>
          <Big label={p.gender === 'girl' ? 'בּוֹאִי נְשַׂחֵק!' : 'בּוֹא נְשַׂחֵק!'} emoji="▶️" size="xl" color={pal.green} onPress={begin} testID="placement-start" glow />
        </View>
      </Screen>
    );
  }
  if (stage === 'done' || !item) {
    return (
      <Screen testID="placement-done">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
          <Butz size={Math.min(s(200), short * 0.42)} mood="cheer" />
          <Txt size={44} font="uiHeavy">{`+${STARS.placement} ⭐`}</Txt>
          <Big label="יוֹצְאִים לַהַרְפַּתְקָה!" emoji="▶️" size="l" color={pal.green} onPress={() => replace({ name: 'play', source: 'session' })} testID="placement-continue" />
        </View>
        <Burst run={1} />
      </Screen>
    );
  }
  const total = 22;
  return (
    <Screen testID="placement">
      <TopBar onClose={home} closeEmoji="🏠">
        <Dots n={Math.min(10, total)} i={Math.min(9, Math.floor((st.current!.total / total) * 10))} />
      </TopBar>
      <View style={{ flexDirection: ROW, alignItems: 'center', justifyContent: 'center', gap: s(8) }}>
        <Text style={{ fontSize: s(26) }}>{GAME[item.game].icon}</Text>
        <Txt size={18} font="uiMed" color={pal.soft}>{GAME[item.game].name}</Txt>
      </View>
      <View style={{ flex: 1, padding: s(10) }}>
        <Mechanic key={item.id + ':' + st.current!.total} item={item} help={0} easy={false} highlight={null} known={knownFor(p)}
          onRight={async () => { await answer(true); }} onWrong={() => { answer(false); }} onNext={() => answer(true)}
          replay={() => speakItem(item)} />
      </View>
    </Screen>
  );
}

export const startSession = () => go({ name: 'play', source: 'session' });
