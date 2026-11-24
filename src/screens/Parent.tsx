/* Grown-ups area behind a gate (SPEC §11.2): progress report, settings, voice check, children. Parent-facing Hebrew. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { buildReport } from '../engine/report';
import type { Band } from '../engine/learner';
import { introduce, newLearner } from '../engine/learner';
import { LETTERS, VOWELS, cvSay } from '../engine/hebrew';
import { WORDS } from '../engine/content/words';
import { SIGHT_WORDS } from '../engine/content/texts';
import { SKILL } from '../engine/curriculum';
import { nextToIntroduce, practiceFocus } from '../engine/planner';
import { makeRng } from '../engine/rng';
import { allSpokenTexts } from '../engine/spoken';
import { back, deleteProfile, go, knownFor, refresh, replace, switchProfile, updateProfile, useProfile, useStore, type Route, type Settings } from '../state/store';
import { Big, Card, Round, Screen, TopBar, Txt } from '../ui/kit';
import { FONT, ROW, useLayout, usePalette } from '../ui/theme';
import { RATE, say, speechInfo } from '../services/speech';
import { CLIPS } from '../services/clips';
import { BUTZ } from '../engine/phrases';

export function Gate({ then }: { then: Route }) {
  const pal = usePalette();
  const { s } = useLayout();
  const [held, setHeld] = useState(false);
  const fill = useRef(new Animated.Value(0)).current;
  const q = useMemo(() => { const a = 3 + Math.floor(Math.random() * 6), b = 4 + Math.floor(Math.random() * 5); const ans = a + b; return { a, b, ans, opts: [ans, ans + 2, ans - 3, ans + 5].sort(() => Math.random() - 0.5) }; }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = () => { Animated.timing(fill, { toValue: 1, duration: 2500, useNativeDriver: false }).start(); timer.current = setTimeout(() => setHeld(true), 2500); };
  const stop = () => { if (timer.current) clearTimeout(timer.current); if (!held) { fill.stopAnimation(); fill.setValue(0); } };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <Screen testID="gate">
      <TopBar onClose={back} closeEmoji="↩️" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: s(20), padding: s(20) }}>
        <Txt size={24} font="uiHeavy">אזור הורים</Txt>
        {!held ? (
          <>
            <Txt size={16} font="uiMed" color={pal.soft}>לחצו והחזיקו את הכפתור</Txt>
            <Pressable onPressIn={start} onPressOut={stop} testID="gate-hold" style={{ width: s(220), height: s(64), borderRadius: s(32), borderWidth: s(3), borderColor: pal.line, overflow: 'hidden', backgroundColor: '#FFFFFF', justifyContent: 'center' }}>
              <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), backgroundColor: pal.yellow }} />
              <Txt size={20} font="ui">🔒 החזיקו</Txt>
            </Pressable>
          </>
        ) : (
          <>
            <Txt size={22} font="ui">{`כמה זה ${q.a} + ${q.b}?`}</Txt>
            <View style={{ flexDirection: ROW, gap: s(12) }}>
              {q.opts.map((o) => (
                <Big key={o} label={String(o)} size="m" color={pal.blue} onPress={() => (o === q.ans ? replace(then) : back())} testID={o === q.ans ? 'gate-answer' : 'gate-wrong-' + o} />
              ))}
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

const BAND: Record<Band, { label: string; color: string }> = {
  notStarted: { label: 'עוד לא התחלנו', color: '#B0BEC5' },
  practising: { label: 'מתרגלים', color: '#FFB74D' },
  developing: { label: 'מתפתח יפה', color: '#4FC3F7' },
  strong: { label: 'חזק', color: '#66BB6A' },
};

function Report() {
  const p = useProfile()!;
  const pal = usePalette();
  const { s } = useLayout();
  const r = buildReport(p.learner, Date.now());
  const ctx = { learner: p.learner, known: knownFor(p), now: Date.now(), minutes: p.settings.minutes, storyToday: true, rng: makeRng(1), spine: p.spine };
  const next = nextToIntroduce(ctx);
  const upcoming = p.spine.find((u) => !p.learner.skills[u] && !ctx.known.has(u));
  const pushed = (p.learner.pushNext ?? 0) > 0;
  const focus = practiceFocus(ctx);
  const label = (id: string) => SKILL[id]?.label ?? id;
  const maxDay = Math.max(1, ...r.days.map((d) => d.items));
  return (
    <View style={{ gap: s(14) }} testID="report">
      <Txt size={14} font="uiMed" color={pal.soft} center={false}>תצפיות למידה מתוך המשחק, לא אבחון. קושי מתמשך כדאי לשתף עם המורה.</Txt>
      <Card style={{ gap: s(8) }}>
        {r.strands.map((st) => (
          <View key={st.id} style={{ flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between' }} testID={'strand-' + st.id}>
            <Txt size={17} font="read" center={false}>{st.label}</Txt>
            <View style={{ flexDirection: ROW, alignItems: 'center', gap: s(6) }}>
              {st.needsPractice ? <Txt size={13} font="ui" color={pal.red}>צריך תרגול</Txt> : null}
              <View style={{ backgroundColor: BAND[st.band].color, borderRadius: s(12), paddingHorizontal: s(10), paddingVertical: s(3) }}>
                <Txt size={14} font="ui" color="#FFFFFF">{BAND[st.band].label}</Txt>
              </View>
            </View>
          </View>
        ))}
      </Card>
      <Txt size={18} font="uiHeavy" center={false}>אותיות</Txt>
      <View style={{ flexDirection: ROW, flexWrap: 'wrap', gap: s(6) }}>
        {r.letters.map((l) => (
          <View key={l.id} style={{ width: s(44), height: s(44), borderRadius: s(10), alignItems: 'center', justifyContent: 'center', backgroundColor: BAND[l.band].color }}>
            <Text style={{ fontFamily: FONT.read, fontSize: s(22), color: '#FFFFFF' }}>{l.char}</Text>
          </View>
        ))}
      </View>
      <Txt size={18} font="uiHeavy" center={false}>ניקוד</Txt>
      <View style={{ flexDirection: ROW, flexWrap: 'wrap', gap: s(6) }}>
        {r.vowels.map((v) => (
          <View key={v.id} style={{ borderRadius: s(10), paddingHorizontal: s(10), paddingVertical: s(6), backgroundColor: BAND[v.band].color }}>
            <Text style={{ fontFamily: FONT.read, fontSize: s(16), color: '#FFFFFF' }}>{v.name}</Text>
          </View>
        ))}
      </View>
      {r.confusions.length ? (
        <Card><Txt size={16} font="ui" center={false}>{'בלבולים חוזרים: ' + r.confusions.map((c) => `${c.a} ↔ ${c.b}`).join(',  ')}</Txt></Card>
      ) : null}
      <Txt size={18} font="uiHeavy" center={false}>7 הימים האחרונים</Txt>
      <View style={{ flexDirection: ROW, alignItems: 'flex-end', gap: s(8), height: s(90) }}>
        {r.days.map((d) => (
          <View key={d.day} style={{ flex: 1, alignItems: 'center', gap: s(2) }}>
            <View style={{ width: '70%', height: s(70) * (d.items / maxDay) + 2, backgroundColor: pal.blue, borderRadius: s(4) }} />
            <Txt size={11} font="uiMed">{d.day.slice(8)}</Txt>
          </View>
        ))}
      </View>
      <Card style={{ gap: s(4) }}>
        <Txt size={16} font="uiHeavy" center={false}>מה מתרגלים עכשיו</Txt>
        <Txt size={16} font="read" center={false}>{focus.map(label).join(' · ') || '—'}</Txt>
        {upcoming ? <Txt size={16} font="read" center={false}>{'הבא בתור: ' + label(upcoming) + (next || pushed ? '  — יוצג במפגש הבא ✓' : '')}</Txt> : null}
        {upcoming && !next && !pushed ? (
          <Big label="להתקדם עכשיו" emoji="⏭️" size="s" color={pal.blue} onPress={() => updateProfile((pp) => { pp.learner.pushNext = 1; })} testID="push-next" />
        ) : null}
        <Txt size={13} font="uiMed" color={pal.soft} center={false}>אות או ניקוד חדשים נפתחים כשהקודמים מתחילים להתייצב, ובכל מקרה אחרי כ-30 תשובות. כל המשחקים פתוחים במפה.</Txt>
      </Card>
    </View>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  const { s } = useLayout();
  return (
    <View style={{ flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between', paddingVertical: s(6), gap: s(10) }}>
      <Txt size={17} font="ui" center={false} style={{ flex: 1 }}>{label}</Txt>
      <View style={{ flexDirection: ROW, gap: s(6) }}>{children}</View>
    </View>
  );
}
function Seg<T extends string | number>({ value, options, onChange, testID }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; testID?: string }) {
  const pal = usePalette();
  const { s } = useLayout();
  return (
    <>
      {options.map((o) => (
        <Pressable key={String(o.v)} onPress={() => onChange(o.v)} testID={testID ? `${testID}-${o.v}` : undefined}
          style={{ paddingHorizontal: s(10), paddingVertical: s(6), borderRadius: s(10), borderWidth: s(2), borderColor: pal.line, backgroundColor: value === o.v ? pal.yellow : '#FFFFFF' }}>
          <Txt size={15} font="ui">{o.label}</Txt>
        </Pressable>
      ))}
    </>
  );
}

function SettingsTab() {
  const p = useProfile()!;
  const pal = usePalette();
  const { s } = useLayout();
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => updateProfile((pp) => { pp.settings[k] = v; });
  const [confirm, setConfirm] = useState(0);
  const school = new Set(p.school);
  const toggleSchool = (u: string) => updateProfile((pp) => {
    if (pp.school.includes(u)) pp.school = pp.school.filter((x) => x !== u);
    else { pp.school = [...pp.school, u]; introduce(pp.learner, u, Date.now(), 'school'); }
  });
  return (
    <View style={{ gap: s(6) }} testID="settings">
      <Card>
        <Row label="הקראה אוטומטית (כבוי: שומעים רק כשהילד/ה לוחצ/ת על 🔊 או 👂)"><Switch value={p.settings.autoSpeak} onValueChange={(v) => set('autoSpeak', v)} testID="set-autospeak" /></Row>
        <Row label="צלילי משחק"><Switch value={p.settings.sfx} onValueChange={(v) => set('sfx', v)} testID="set-sfx" /></Row>
        <Row label="קצב הדיבור"><Seg value={p.settings.rate} onChange={(v) => set('rate', v)} options={[{ v: 'slow', label: 'איטי' }, { v: 'normal', label: 'רגיל' }]} testID="set-rate" /></Row>
        <Row label="אורך מפגש (דקות)"><Seg value={p.settings.minutes} onChange={(v) => set('minutes', v)} options={[{ v: 5, label: '5' }, { v: 8, label: '8' }, { v: 12, label: '12' }]} testID="set-minutes" /></Row>
        <Row label="גודל טקסט"><Seg value={p.settings.textScale} onChange={(v) => set('textScale', v)} options={[{ v: 1, label: '100%' }, { v: 1.25, label: '125%' }, { v: 1.5, label: '150%' }]} testID="set-text" /></Row>
        <Row label="ניגודיות גבוהה"><Switch value={p.settings.highContrast} onValueChange={(v) => set('highContrast', v)} testID="set-contrast" /></Row>
        <Row label="פחות תנועה"><Switch value={p.settings.reducedMotion} onValueChange={(v) => set('reducedMotion', v)} testID="set-motion" /></Row>
        <Row label="פחות אפשרויות בכל שאלה"><Switch value={p.settings.fewerChoices} onValueChange={(v) => set('fewerChoices', v)} testID="set-fewer" /></Row>
      </Card>
      <Txt size={18} font="uiHeavy" center={false}>מה כבר נלמד בבית הספר?</Txt>
      <Txt size={14} font="uiMed" color={pal.soft} center={false}>סמנו אותיות וניקוד שהילד/ה כבר מכירים. האפליקציה תתרגל אותם ותבדוק שהם יציבים.</Txt>
      <View style={{ flexDirection: ROW, flexWrap: 'wrap', gap: s(6) }}>
        {LETTERS.map((l) => (
          <Pressable key={l.id} onPress={() => toggleSchool('L.' + l.id)} testID={'school-L.' + l.id}
            style={{ width: s(44), height: s(44), borderRadius: s(10), alignItems: 'center', justifyContent: 'center', borderWidth: s(2), borderColor: pal.line, backgroundColor: school.has('L.' + l.id) || p.learner.skills['L.' + l.id] ? pal.green : '#FFFFFF' }}>
            <Text style={{ fontFamily: FONT.read, fontSize: s(20), color: pal.ink }}>{l.char}</Text>
          </Pressable>
        ))}
        {VOWELS.map((v) => (
          <Pressable key={v.id} onPress={() => toggleSchool('V.' + v.id)} testID={'school-V.' + v.id}
            style={{ paddingHorizontal: s(8), height: s(44), borderRadius: s(10), alignItems: 'center', justifyContent: 'center', borderWidth: s(2), borderColor: pal.line, backgroundColor: school.has('V.' + v.id) || p.learner.skills['V.' + v.id] ? pal.green : '#FFFFFF' }}>
            <Text style={{ fontFamily: FONT.read, fontSize: s(15), color: pal.ink }}>{v.name}</Text>
          </Pressable>
        ))}
      </View>
      <Card style={{ gap: s(10), marginTop: s(8) }}>
        <Big label="בדיקת פתיחה מחדש" size="s" color={pal.blue} onPress={() => { updateProfile((pp) => { pp.learner.placementDone = false; }); go({ name: 'placement' }); }} testID="rerun-placement" />
        <Big label={confirm === 0 ? 'איפוס התקדמות' : 'בטוח? לחצו שוב לאיפוס'} size="s" color={pal.red}
          onPress={() => { if (confirm === 0) setConfirm(1); else { updateProfile((pp) => { pp.learner = newLearner(); pp.school = []; }); setConfirm(0); } }} testID="reset" />
        <Txt size={13} font="uiMed" color={pal.soft}>האיפוס מוחק את ההתקדמות בקריאה. כוכבים ומדבקות נשארים.</Txt>
      </Card>
    </View>
  );
}

function VoiceTab() {
  const p = useProfile()!;
  const pal = usePalette();
  const { s } = useLayout();
  const info = speechInfo();
  const bad = new Set(p.audioBad);
  const [cat, setCat] = useState<'letters' | 'cv' | 'words' | 'sight'>('letters');
  const rows = useMemo(() => {
    if (cat === 'letters') return LETTERS.filter((l) => !l.final).map((l) => ({ key: 'snd:' + l.id, show: l.char, say: l.say }));
    if (cat === 'cv') return LETTERS.filter((l) => !l.final && l.id !== 'vav').flatMap((l) => VOWELS.map((v) => ({ key: `cv:${l.id}:${v.id}`, show: cvSay(l.id, v.id), say: cvSay(l.id, v.id) })));
    if (cat === 'words') return WORDS.map((w) => ({ key: 'w:' + w.id, show: `${w.emoji} ${w.text}`, say: w.say ?? w.text }));
    return SIGHT_WORDS.map((w) => ({ key: 'sw:' + w.id, show: w.text, say: w.text }));
  }, [cat]);
  const toggle = (k: string) => updateProfile((pp) => { pp.audioBad = pp.audioBad.includes(k) ? pp.audioBad.filter((x) => x !== k) : [...pp.audioBad, k]; });
  const total = useMemo(() => allSpokenTexts().length, []);
  const recorded = Object.keys(CLIPS).length;
  return (
    <View style={{ gap: s(8) }} testID="voice">
      <Txt size={15} font="uiMed" center={false}>{info.hebrew ? `קול עברי במכשיר: ${info.voiceName}` : 'לא נמצא קול עברי במכשיר.'}</Txt>
      <Txt size={15} font="uiMed" center={false}>{`הקלטות באפליקציה: ${recorded} מתוך ${total}. ` + (recorded >= total ? 'כל הדיבור מוקלט.' : 'מה שלא הוקלט נאמר בקול של המכשיר.')}</Txt>
      <Txt size={14} font="uiMed" color={pal.soft} center={false}>הקשיבו. אם משהו נשמע לא נכון, סמנו 👎 והוא לא יושמע כשאלה עד שתהיה הקלטה.</Txt>
      <Card style={{ flexDirection: ROW, alignItems: 'center', gap: s(10) }}>
        <Round emoji="▶️" label="השמעה" size={40} onPress={() => say(BUTZ, { rate: RATE.talk })} testID="play-name" />
        <Txt size={15} font="uiMed" center={false} style={{ flex: 1 }}>{`שם הדמות: ${BUTZ} (בשורוק, "בוּץ" כמו Butz — לא "בוֹץ" של בוץ). הקול צריך לומר Butz.`}</Txt>
      </Card>
      <View style={{ flexDirection: ROW, gap: s(6) }}>
        <Seg value={cat} onChange={setCat} options={[{ v: 'letters', label: 'אותיות' }, { v: 'cv', label: 'צירופים' }, { v: 'words', label: 'מילים' }, { v: 'sight', label: 'מילים שכיחות' }]} testID="voice-cat" />
      </View>
      {rows.map((r) => (
        <View key={r.key} style={{ flexDirection: ROW, alignItems: 'center', gap: s(10), borderBottomWidth: 1, borderColor: '#E0E0E0', paddingVertical: s(4) }}>
          <Round emoji="▶️" label="השמעה" size={40} onPress={() => say(r.say, { rate: RATE.stimulus })} testID={'play-' + r.key} />
          <Text style={{ flex: 1, fontFamily: FONT.read, fontSize: s(22), textAlign: 'right', writingDirection: 'rtl', color: pal.ink }}>{r.show}</Text>
          <Pressable onPress={() => toggle(r.key)} testID={'bad-' + r.key} style={{ padding: s(6), opacity: bad.has(r.key) ? 1 : 0.35 }}>
            <Text style={{ fontSize: s(24) }}>👎</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function ChildrenTab() {
  const pal = usePalette();
  const { s } = useLayout();
  const profiles = useStore((st) => st.profiles);
  const currentId = useStore((st) => st.currentId);
  const [del, setDel] = useState<string | null>(null);
  return (
    <View style={{ gap: s(10) }} testID="children">
      {profiles.map((pr) => (
        <Card key={pr.id} style={{ flexDirection: ROW, alignItems: 'center', gap: s(10), flexWrap: 'wrap' }}>
          <Text style={{ fontSize: s(34) }}>{pr.avatar}</Text>
          <Txt size={18} font="ui" center={false} style={{ flex: 1 }}>{(pr.name || 'ללא שם') + (pr.id === currentId ? '  ✓' : '')}</Txt>
          <Seg value={pr.gender} onChange={(v) => { pr.gender = v; refresh(); }} options={[{ v: 'boy', label: 'בן' }, { v: 'girl', label: 'בת' }]} testID={'gender-' + pr.id} />
          {pr.id !== currentId ? <Big label="מעבר" size="s" color={pal.blue} onPress={() => switchProfile(pr.id)} testID={'switch-' + pr.id} /> : null}
          <Big label={del === pr.id ? 'למחוק?' : 'מחיקה'} size="s" color={pal.red} onPress={() => (del === pr.id ? deleteProfile(pr.id) : setDel(pr.id))} testID={'delete-' + pr.id} />
        </Card>
      ))}
      <Big label="ילד/ה נוספ/ת" emoji="➕" size="m" color={pal.green} onPress={() => go({ name: 'setup' })} testID="add-child" />
      <Txt size={13} font="uiMed" color={pal.soft}>כל המידע נשמר רק במכשיר הזה. אין חשבון, אין פרסומות, אין שליחת מידע.</Txt>
    </View>
  );
}

export function Parent({ tab = 'report' }: { tab?: 'report' | 'settings' | 'voice' | 'children' }) {
  const p = useProfile()!;
  const pal = usePalette();
  const { s } = useLayout();
  const [t, setT] = useState(tab);
  const TABS = [{ v: 'report', label: 'התקדמות' }, { v: 'settings', label: 'הגדרות' }, { v: 'voice', label: 'בדיקת קול' }, { v: 'children', label: 'ילדים' }] as const;
  return (
    <Screen testID="parent" bg="#F4F6FA">
      <TopBar onClose={back} closeEmoji="🏠"><Txt size={22} font="uiHeavy">{`${p.avatar} ${p.name || ''}`}</Txt></TopBar>
      <View style={{ flexDirection: ROW, justifyContent: 'center', gap: s(6), paddingHorizontal: s(8), flexWrap: 'wrap' }}>
        {TABS.map((x) => (
          <Pressable key={x.v} onPress={() => setT(x.v)} testID={'tab-' + x.v}
            style={{ paddingHorizontal: s(14), paddingVertical: s(8), borderRadius: s(14), borderWidth: s(2), borderColor: pal.line, backgroundColor: t === x.v ? pal.yellow : '#FFFFFF' }}>
            <Txt size={16} font="ui">{x.label}</Txt>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ padding: s(14), paddingBottom: s(40) }}>
        {t === 'report' ? <Report /> : t === 'settings' ? <SettingsTab /> : t === 'voice' ? <VoiceTab /> : <ChildrenTab />}
      </ScrollView>
    </Screen>
  );
}
