/* Game mechanics (SPEC §8.3): reusable interaction engines. Each renders one item and reports right/wrong to GameHost. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import type { Item, Option } from '../engine/generators';
import { speakSyllable } from '../engine/generators';
import { LETTERS, analyzeWord, cvText, textWords } from '../engine/hebrew';
import { canRead, type Known } from '../engine/gating';
import { Big, Card, Tile, Txt, type TileState } from '../ui/kit';
import { Door, Lighthouse } from '../ui/Butz';
import { FONT, ROW, useLayout, usePalette, useSettings } from '../ui/theme';
import { RATE, say } from '../services/speech';
import { sfx } from '../services/sfx';
import { useProfile } from '../state/store';
import { SAY, g } from '../engine/phrases';

export interface HostItem extends Item { pages?: boolean; unscored?: boolean; listen?: boolean }
export interface MechProps {
  item: HostItem;
  help: 0 | 1 | 2;
  easy: boolean;
  highlight: string | null;
  known: Known;
  onRight: (o?: { stay?: boolean; quiet?: boolean }) => Promise<void>;
  onWrong: (choice?: string, lines?: string[]) => void;
  onNext: () => void;
  replay: () => void;
}

const isRight = (it: Item, id: string) => id === it.answer || !!it.accept?.includes(id);
const letterIdByChar = (ch: string) => LETTERS.find((l) => l.char === ch || l.base === ch)?.id ?? ch;

/** Which wrong options are hidden by help level 1 / easy mode (deterministic per item). */
function hiddenWrong(it: Item, help: number, easy: boolean, chosen: Set<string>): Set<string> {
  const wrongs = it.options.filter((o) => !isRight(it, o.id) && !chosen.has(o.id));
  const n = (help >= 1 ? 1 : 0) + (easy && it.options.length >= 3 ? 1 : 0);
  return new Set(wrongs.slice(0, Math.min(n, Math.max(0, wrongs.length - 1))).map((o) => o.id));
}

function Options({ it, help, easy, highlight, onPick, solved, size, wrongIds, selected }: {
  it: Item; help: number; easy: boolean; highlight: string | null; onPick: (o: Option) => void; solved: string | null; size: number; wrongIds: Set<string>; selected?: string | null;
}) {
  const { s } = useLayout();
  const hidden = hiddenWrong(it, help, easy, wrongIds);
  return (
    <View style={{ flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', gap: s(14), paddingHorizontal: s(8) }}>
      {it.options.map((o) => {
        let st: TileState = 'idle';
        if (solved) st = solved === o.id ? 'right' : 'dim';
        else if (wrongIds.has(o.id)) st = 'wrong';
        else if (hidden.has(o.id)) st = 'off';
        else if (help >= 2 && isRight(it, o.id)) st = 'hint';
        else if (highlight === o.id || selected === o.id) st = 'selected';
        return <Tile key={o.id} testID={'opt-' + o.id} text={o.text} emoji={o.emoji} font={o.font ?? 'read'} color={o.color} state={st} size={size} label={o.label} onPress={() => onPick(o)} />;
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ choose (listen/read and pick) */

function Train({ parts, speakable, lit }: { parts: string[]; speakable: boolean; lit: boolean }) {
  const pal = usePalette();
  const { s, t } = useLayout();
  return (
    <View style={{ flexDirection: ROW, alignItems: 'flex-end', justifyContent: 'center', gap: s(6) }} testID="train">
      <Text style={{ fontSize: s(64), transform: [{ scaleX: -1 }] }}>🚂</Text>
      {parts.map((p, i) => (
        <Pressable key={i} disabled={!speakable} onPress={() => say(speakSyllable(p), { rate: RATE.stimulus })} testID={'car-' + i}
          style={{ minWidth: s(78), height: s(70), borderRadius: s(14), backgroundColor: lit ? pal.green : [pal.red, pal.blue, pal.purple, pal.teal][i % 4], borderWidth: s(3), borderColor: pal.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: s(8) }}>
          <Text style={{ fontFamily: FONT.read, fontSize: t(34), color: '#FFFFFF', writingDirection: 'rtl' }}>{p}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Choose(p: MechProps) {
  const it = p.item;
  const { s, short } = useLayout();
  const pal = usePalette();
  const [solved, setSolved] = useState<string | null>(null);
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => { setSolved(null); setWrongIds(new Set()); setSelected(null); }, [it.id]);
  const password = it.game === 'secretPassword';

  const pick = (o: Option) => {
    if (solved) return;
    if (password) { setSelected(o.id); if (o.say) say(o.say, { rate: RATE.stimulus }); return; }
    decide(o.id);
  };
  const decide = (id: string) => {
    if (isRight(it, id)) { setSolved(id); p.onRight(); }
    else { setWrongIds((w) => new Set(w).add(id)); setSelected(null); p.onWrong(id); }
  };

  const k = it.options.length;
  const size = Math.min(150, Math.max(84, (short / s(1)) * (k > 3 ? 0.22 : 0.27)));
  const head = (() => {
    switch (it.game) {
      case 'soundLighthouse':
        return <Pressable onPress={p.replay} testID="replay-visual"><Lighthouse size={s(150)} lit={!!solved} /></Pressable>;
      case 'secretPassword':
        return (
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Door size={s(190)} open={!!solved} />
            <View style={{ position: 'absolute', top: s(40), backgroundColor: '#FFF6E5', borderRadius: s(16), borderWidth: s(3), borderColor: pal.line, paddingHorizontal: s(16) }}>
              <Txt font="read" size={56}>{solved ? '🦄' : it.show?.text}</Txt>
            </View>
          </View>
        );
      case 'syllableTrain':
        return <Train parts={it.show!.parts!} speakable={!!it.supported || p.help >= 1} lit={!!solved} />;
      case 'wordExplorer':
        return (
          <Card color="#FFF1C9" style={{ alignItems: 'center', minWidth: s(220) }}>
            <Text style={{ fontSize: s(30) }}>🗺️</Text>
            <Txt font="read" size={60}>{it.show?.text}</Txt>
          </Card>
        );
      case 'soundSafari':
        return <Pressable onPress={p.replay} testID="replay-visual"><Card style={{ alignItems: 'center' }}><Text style={{ fontSize: s(84) }}>{it.show?.emoji}</Text></Card></Pressable>;
      case 'robotMixer':
        return <Pressable onPress={p.replay} testID="replay-visual"><Text style={{ fontSize: s(100) }}>🤖</Text></Pressable>;
      case 'syllableDJ':
        return <Pressable onPress={p.replay} testID="replay-visual"><Text style={{ fontSize: s(96) }}>🎧</Text></Pressable>;
      case 'wordCollector':
        return <Pressable onPress={p.replay} testID="replay-visual"><Text style={{ fontSize: s(90) }}>🏛️</Text></Pressable>;
      default:
        return (
          <Pressable onPress={p.replay} testID="replay-visual">
            <Card style={{ maxWidth: s(520) }}><Txt font="read" size={28}>{'🔊 ' + (it.say?.[0] ?? '')}</Txt></Card>
          </Pressable>
        );
    }
  })();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      {head}
      <Options it={it} help={p.help} easy={p.easy} highlight={p.highlight} onPick={pick} solved={solved} size={size} wrongIds={wrongIds} selected={selected} />
      {password && !solved ? <Big label="פּוֹתְחִים!" emoji="🚪" color={pal.green} disabled={!selected} onPress={() => selected && decide(selected)} testID="open-door" /> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ find and tap */

export function FindTap(p: MechProps) {
  const it = p.item;
  const pal = usePalette();
  const { s, w } = useLayout();
  const [found, setFound] = useState<Set<string>>(new Set());
  const [bad, setBad] = useState<string | null>(null);
  useEffect(() => { setFound(new Set()); setBad(null); }, [it.id]);
  const cols = it.options.length > 9 ? 4 : 3;
  const cell = Math.min(s(96), (w - s(40)) / cols - s(10));
  const tap = (o: Option) => {
    if (found.has(o.id)) return;
    if (it.targets!.includes(o.id)) {
      const f = new Set(found).add(o.id);
      setFound(f);
      sfx('tap');
      if (f.size === it.targets!.length) p.onRight();
    } else {
      setBad(o.id);
      setTimeout(() => setBad(null), 500);
      p.onWrong(letterIdByChar(o.text ?? ''));
    }
  };
  const glow = p.help >= 2 ? it.targets!.filter((t) => !found.has(t)) : p.help === 1 ? it.targets!.filter((t) => !found.has(t)).slice(0, 1) : [];
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      <Pressable onPress={p.replay} testID="replay-visual" style={{ flexDirection: ROW, alignItems: 'center', gap: s(12) }}>
        <Text style={{ fontSize: s(54) }}>🔍</Text>
        <Card style={{ paddingVertical: s(2), paddingHorizontal: s(22) }}><Txt font="read" size={64}>{it.show?.letter}</Txt></Card>
        <Txt size={22} font="uiHeavy" color={pal.soft}>{`${found.size}/${it.targets!.length}`}</Txt>
      </Pressable>
      <View style={{ flexDirection: ROW, flexWrap: 'wrap', width: cols * (cell + s(10)), justifyContent: 'center', gap: s(10) }}>
        {it.options.map((o) => (
          <Tile key={o.id} testID={'cell-' + o.id} text={o.text} size={cell / s(1)} state={found.has(o.id) ? 'right' : bad === o.id ? 'wrong' : glow.includes(o.id) ? 'hint' : 'idle'} onPress={() => tap(o)} />
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ build: nikud magnet, word bakery, final letters */

export function Magnet(p: MechProps) {
  const it = p.item;
  const { s } = useLayout();
  const pal = usePalette();
  const [solved, setSolved] = useState<string | null>(null);
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  useEffect(() => { setSolved(null); setWrongIds(new Set()); }, [it.id]);
  const [, L] = it.id.split(':');
  const pick = (o: Option) => {
    if (solved) return;
    if (isRight(it, o.id)) { setSolved(o.id); p.onRight(); }
    else { setWrongIds((x) => new Set(x).add(o.id)); p.onWrong(o.id); }
  };
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      <Pressable onPress={p.replay} testID="replay-visual" style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: s(44) }}>🧲</Text>
        <Card color={solved ? '#E9FBEF' : undefined} style={{ minWidth: s(170), alignItems: 'center' }}>
          <Txt font="read" size={96} color={solved ? pal.green : pal.ink}>{solved ? cvText(L, solved) : it.show?.letter}</Txt>
          {!solved ? <Txt size={28} color={pal.soft}>◌</Txt> : null}
        </Card>
      </Pressable>
      <Options it={it} help={p.help} easy={p.easy} highlight={p.highlight} onPick={pick} solved={solved} size={104} wrongIds={wrongIds} />
    </View>
  );
}

export function Bakery(p: MechProps) {
  const it = p.item;
  const pal = usePalette();
  const { s, t } = useLayout();
  const [placed, setPlaced] = useState<Option[]>([]);
  const [bounce, setBounce] = useState<string | null>(null);
  useEffect(() => { setPlaced([]); setBounce(null); }, [it.id]);
  const seq = it.sequence!;
  const byId = (id: string) => it.options.find((o) => o.id === id)!;
  const used = new Set(placed.map((o) => o.id));
  const expected = byId(seq[placed.length] ?? seq[0]);
  const tap = (o: Option) => {
    if (placed.length >= seq.length || used.has(o.id)) return;
    if (o.text === expected.text) {
      const np = [...placed, o];
      setPlaced(np);
      say(speakSyllable(o.text!), { rate: RATE.stimulus });
      if (np.length === seq.length) setTimeout(() => p.onRight(), 350);
    } else {
      setBounce(o.id);
      setTimeout(() => setBounce(null), 500);
      p.onWrong(o.text, (it.word?.syl ?? []).map(speakSyllable));
    }
  };
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      <Pressable onPress={p.replay} testID="replay-visual"><Card style={{ alignItems: 'center' }}><Text style={{ fontSize: s(74) }}>{it.show?.emoji}</Text></Card></Pressable>
      <View style={{ flexDirection: ROW, gap: s(6), alignItems: 'center' }} testID="tray">
        <Text style={{ fontSize: s(40) }}>🧁</Text>
        {seq.map((_, i) => (
          <View key={i} style={{ minWidth: s(80), height: s(70), borderRadius: s(14), borderWidth: s(3), borderStyle: placed[i] ? 'solid' : 'dashed', borderColor: pal.line, backgroundColor: placed[i] ? '#FFD7A8' : 'transparent', alignItems: 'center', justifyContent: 'center', paddingHorizontal: s(6) }}>
            <Text style={{ fontFamily: FONT.read, fontSize: t(32), color: pal.ink }}>{placed[i]?.text ?? ''}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', gap: s(12) }}>
        {it.options.map((o) => (
          <Tile key={o.id} testID={'blk-' + o.id} text={o.text} size={92} state={used.has(o.id) ? 'off' : bounce === o.id ? 'wrong' : p.help >= 2 && o.text === expected.text && !used.has(o.id) ? 'hint' : 'idle'} onPress={() => tap(o)} />
        ))}
      </View>
    </View>
  );
}

export function FinalGap(p: MechProps) {
  const it = p.item;
  const pal = usePalette();
  const { s, t } = useLayout();
  const [solved, setSolved] = useState<string | null>(null);
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  useEffect(() => { setSolved(null); setWrongIds(new Set()); }, [it.id]);
  const pick = (o: Option) => {
    if (solved) return;
    if (isRight(it, o.id)) { setSolved(o.id); p.onRight(); }
    else { setWrongIds((x) => new Set(x).add(o.id)); p.onWrong(o.id); }
  };
  const fill = solved ? it.options.find((o) => o.id === solved)?.text : '';
  const piece = (x: string | undefined) => (x ? <Text style={{ fontFamily: FONT.read, fontSize: t(64), color: pal.ink }}>{x}</Text> : null);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(12) }}>
        <Text style={{ fontSize: s(56) }}>🦾</Text>
        <Text style={{ fontSize: s(56) }}>{it.show?.emoji}</Text>
      </View>
      <Card style={{ flexDirection: ROW, alignItems: 'center', paddingHorizontal: s(22) }}>
        {piece(it.show?.before)}
        <View testID="gap" style={{ minWidth: s(58), height: s(84), marginHorizontal: s(2), borderRadius: s(10), borderWidth: s(3), borderStyle: solved ? 'solid' : 'dashed', borderColor: solved ? pal.green : pal.line, alignItems: 'center', justifyContent: 'center', backgroundColor: solved ? '#E9FBEF' : 'transparent' }}>
          {piece(fill || ' ')}
        </View>
        {piece(it.show?.after)}
      </Card>
      <Options it={it} help={p.help} easy={false} highlight={null} onPick={pick} solved={solved} size={110} wrongIds={wrongIds} />
    </View>
  );
}

/* ------------------------------------------------------------------ count: syllable hop */

export function Hop(p: MechProps) {
  const it = p.item;
  const pal = usePalette();
  const { s } = useLayout();
  const [n, setN] = useState(0);
  const [frog, setFrog] = useState(-1);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setN(0); setFrog(-1); setBusy(false); }, [it.id]);
  useEffect(() => { if (p.help >= 2) setN(it.count!); }, [p.help, it.count]);
  const jump = async () => {
    if (busy || n === 0) return;
    setBusy(true);
    const parts = (it.word?.syl ?? []).map(speakSyllable);
    for (let i = 0; i < n; i++) {
      setFrog(i);
      sfx('tap');
      if (n === it.count) await say(parts[i], { rate: RATE.stimulus });
      else await new Promise((r) => setTimeout(r, 380));
    }
    if (n === it.count) await p.onRight({ quiet: true });
    else { setFrog(-1); setBusy(false); p.onWrong(String(n)); }
  };
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      <Pressable onPress={p.replay} testID="replay-visual"><Card style={{ alignItems: 'center' }}><Text style={{ fontSize: s(80) }}>{it.show?.emoji}</Text></Card></Pressable>
      <View style={{ flexDirection: ROW, alignItems: 'flex-end', gap: s(8), minHeight: s(110), backgroundColor: '#BDE7FF', borderRadius: s(30), padding: s(12), borderWidth: s(3), borderColor: pal.line }} testID="pond">
        <Text style={{ fontSize: s(44), opacity: frog < 0 ? 1 : 0.25 }}>🐸</Text>
        {Array.from({ length: n }, (_, i) => (
          <View key={i} style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: s(40), opacity: frog === i ? 1 : 0 }}>🐸</Text>
            <View style={{ width: s(62), height: s(30), borderRadius: s(20), backgroundColor: p.help >= 2 ? pal.yellow : '#7CB342', borderWidth: s(3), borderColor: pal.line }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: ROW, gap: s(14) }}>
        <Big emoji="🪨" label="+" color={pal.teal} size="m" onPress={() => !busy && setN((x) => Math.min(5, x + 1))} testID="stone-add" />
        <Big emoji="↩️" color={pal.soft} size="m" onPress={() => !busy && setN((x) => Math.max(0, x - 1))} testID="stone-remove" />
        <Big emoji="🐸" label="קְפֹץ!" color={pal.green} size="m" disabled={n === 0 || busy} onPress={jump} testID="jump" />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ sequence: story puzzle */

export function Sequence(p: MechProps) {
  const it = p.item;
  const pal = usePalette();
  const { s } = useLayout();
  const [placed, setPlaced] = useState<string[]>([]);
  const [bounce, setBounce] = useState<string | null>(null);
  const pool = useMemo(() => {
    const h = (x: string) => [...x].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const shuffled = [...it.options].sort((a, b) => h(a.id + it.id) - h(b.id + it.id));
    return shuffled.map((o) => o.id).join() === it.sequence!.join() ? shuffled.reverse() : shuffled;
  }, [it.id, it.options, it.sequence]);
  useEffect(() => { setPlaced([]); setBounce(null); }, [it.id]);
  const seq = it.sequence!;
  const expected = seq[placed.length];
  const tap = (o: Option) => {
    if (placed.includes(o.id) || placed.length >= seq.length) return;
    if (o.id === expected) {
      const np = [...placed, o.id];
      setPlaced(np);
      sfx('tap');
      if (np.length === seq.length) setTimeout(() => p.onRight(), 300);
    } else {
      setBounce(o.id);
      setTimeout(() => setBounce(null), 500);
      const exp = it.options.find((x) => x.id === expected);
      p.onWrong(o.id, exp?.say ? [exp.say] : undefined);
    }
  };
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      <Txt size={26} font="uiHeavy">🧩</Txt>
      <View style={{ flexDirection: ROW, gap: s(8) }} testID="slots">
        {seq.map((id, i) => (
          <View key={i} style={{ width: s(84), height: s(84), borderRadius: s(16), borderWidth: s(3), borderStyle: placed[i] ? 'solid' : 'dashed', borderColor: pal.line, alignItems: 'center', justifyContent: 'center', backgroundColor: placed[i] ? '#E9FBEF' : 'transparent' }}>
            {placed[i] ? <Text style={{ fontSize: s(36) }}>{it.options.find((o) => o.id === placed[i])?.emoji}</Text> : <Txt size={28} color={pal.soft}>{String(i + 1)}</Txt>}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', gap: s(12) }}>
        {pool.map((o) => (
          <Tile key={o.id} testID={'card-' + o.id} emoji={o.emoji} size={100} wide state={placed.includes(o.id) ? 'off' : bounce === o.id ? 'wrong' : p.help >= 2 && o.id === expected ? 'hint' : 'idle'} onPress={() => tap(o)} />
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ read along: echo reader, phrase train */

export function ReadAlong(p: MechProps) {
  const it = p.item;
  const sent = it.sentence!;
  const pal = usePalette();
  const { s, t } = useLayout();
  const echo = it.game === 'echoReader';
  const [phase, setPhase] = useState<'read' | 'check' | 'listen' | 'echo'>('read');
  const [lit, setLit] = useState<number>(-1);
  const [hl, setHl] = useState<number>(-1);
  const [solved, setSolved] = useState<string | null>(null);
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const alive = useRef(true);
  const gender = useProfile()?.gender;
  useEffect(() => { alive.current = true; setPhase('read'); setLit(-1); setHl(-1); setSolved(null); setWrongIds(new Set());
    return () => { alive.current = false; }; }, [it.id, echo]);

  const listen = async () => {
    setPhase('listen');
    for (let i = 0; i < sent.phrases.length && alive.current; i++) { setHl(i); await say(sent.phrases[i], { rate: RATE.stimulus }); }
    if (!alive.current) return;
    setHl(-1);
    if (echo) { setPhase('echo'); say(g(SAY.echoTurn, gender)); } else setTimeout(() => alive.current && p.onNext(), 600);
  };
  const pick = async (o: Option) => {
    if (solved) return;
    if (isRight(it, o.id)) { setSolved(o.id); await p.onRight({ stay: true, quiet: true }); if (alive.current) listen(); }
    else { setWrongIds((x) => new Set(x).add(o.id)); p.onWrong(o.id); }
  };
  const tapCar = (i: number) => {
    if (phase !== 'read' || i !== lit + 1) return;
    sfx('tap');
    setLit(i);
    if (i === sent.phrases.length - 1) setTimeout(() => setPhase('check'), 300);
  };
  const sentenceView = echo ? (
    <Card style={{ maxWidth: '94%' }}>
      <View style={{ flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', gap: s(10) }}>
        {sent.phrases.map((ph, i) => <Text key={i} style={{ fontFamily: FONT.read, fontSize: t(44), color: hl === i ? pal.orange : pal.ink, writingDirection: 'rtl' }}>{ph}</Text>)}
      </View>
    </Card>
  ) : (
    <View style={{ flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', gap: s(8), alignItems: 'flex-end' }}>
      <Text style={{ fontSize: s(50), transform: [{ scaleX: -1 }] }}>🚂</Text>
      {sent.phrases.map((ph, i) => (
        <Pressable key={i} onPress={() => tapCar(i)} testID={'phrase-' + i}
          style={{ borderRadius: s(14), borderWidth: s(3), borderColor: hl === i ? pal.orange : pal.line, backgroundColor: i <= lit || phase !== 'read' ? '#FFE7B8' : pal.card, paddingHorizontal: s(14), paddingVertical: s(6) }}>
          <Text style={{ fontFamily: FONT.read, fontSize: t(38), color: pal.ink, writingDirection: 'rtl' }}>{ph}</Text>
        </Pressable>
      ))}
    </View>
  );
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      <Text style={{ fontSize: s(54) }}>{echo ? '🦜' : '🚃'}</Text>
      {sentenceView}
      {phase === 'read' && echo ? <Big label="קָרָאתִי!" emoji="📖" color={pal.blue} onPress={() => setPhase('check')} testID="read-done" /> : null}
      {phase === 'check' || solved ? <Options it={it} help={p.help} easy={p.easy} highlight={null} onPick={pick} solved={solved} size={110} wrongIds={wrongIds} /> : null}
      {phase === 'echo' ? (
        <View style={{ flexDirection: ROW, gap: s(14) }}>
          <Big emoji="🔊" color={pal.purple} size="m" onPress={listen} testID="echo-again" />
          <Big emoji="👍" label="קָרָאתִי!" color={pal.green} size="m" onPress={p.onNext} testID="echo-done" />
        </View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ story pages */

export function StoryPages(p: MechProps) {
  const story = p.item.story!;
  const pal = usePalette();
  const { s, t } = useLayout();
  const reduced = useSettings().reducedMotion;
  const [i, setI] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const alive = useRef(true);
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const page = story.pages[i];
  const read = async () => {
    setSpeaking(true);
    await say(page.text, { rate: RATE.talk });
    if (!alive.current) return;
    setSpeaking(false);
  };
  useEffect(() => {
    if (!reduced) { fade.setValue(0); Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: false }).start(); }
    if (p.item.listen) read().then(() => { if (alive.current && p.item.listen) setTimeout(() => alive.current && nextPage(), 900); });
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const nextPage = () => {
    sfx('page');
    setI((x) => {
      if (x + 1 >= story.pages.length) { setTimeout(p.onNext, 0); return x; }
      return x + 1;
    });
  };
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-evenly' }}>
      <Txt font="read" size={26} color={pal.soft}>{story.title}</Txt>
      <Animated.View style={{ opacity: fade, alignItems: 'center', width: '92%' }}>
        <Card style={{ alignItems: 'center', width: '100%' }}>
          <Text style={{ fontSize: s(92) }} testID="scene">{page.scene}</Text>
          {p.item.listen ? (
            <Txt font="read" size={30} color={speaking ? pal.blue : pal.ink}>{page.text}</Txt>
          ) : (
            <View style={{ flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', columnGap: s(10) }}>
              {page.text.split(' ').map((tok, j) => {
                const clean = textWords(tok)[0] ?? '';
                const easy = !clean || canRead(analyzeWord(clean).units, p.known);
                return (
                  <Pressable key={j} disabled={easy} onPress={() => say(clean, { rate: RATE.stimulus })} testID={easy ? undefined : 'storyword-' + j}>
                    <Text style={{ fontFamily: FONT.read, fontSize: t(38), color: pal.ink, textDecorationLine: easy ? 'none' : 'underline', textDecorationStyle: 'dotted', writingDirection: 'rtl' }}>{tok}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Card>
      </Animated.View>
      <View style={{ flexDirection: ROW, gap: s(14), alignItems: 'center' }}>
        {p.item.listen ? <Big emoji="🔊" color={pal.purple} size="m" onPress={read} testID="page-again" /> : null}
        <Txt size={20} font="uiHeavy" color={pal.soft}>{`${i + 1}/${story.pages.length}`}</Txt>
        <Big emoji="⬅️" color={pal.green} size="m" onPress={nextPage} testID="page-next" />
      </View>
    </View>
  );
}

export function Mechanic(p: MechProps) {
  const it = p.item;
  if (it.pages) return <StoryPages {...p} />;
  switch (it.game) {
    case 'letterDetective': return <FindTap {...p} />;
    case 'nikudMagnet': return <Magnet {...p} />;
    case 'wordBakery': return <Bakery {...p} />;
    case 'finalTransformer': return <FinalGap {...p} />;
    case 'syllableHop': return <Hop {...p} />;
    case 'echoReader': case 'phraseTrain': return <ReadAlong {...p} />;
    default: return it.sequence ? <Sequence {...p} /> : <Choose {...p} />;
  }
}
