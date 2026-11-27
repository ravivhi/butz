import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { NotoSansHebrew_500Medium } from '@expo-google-fonts/noto-sans-hebrew/500Medium';
import { NotoSansHebrew_700Bold } from '@expo-google-fonts/noto-sans-hebrew/700Bold';
import { NotoSerifHebrew_700Bold } from '@expo-google-fonts/noto-serif-hebrew/700Bold';
import { Rubik_500Medium } from '@expo-google-fonts/rubik/500Medium';
import { Rubik_700Bold } from '@expo-google-fonts/rubik/700Bold';
import { Rubik_800ExtraBold } from '@expo-google-fonts/rubik/800ExtraBold';
import { getState, go, hydrate, useRoute, useStore } from './src/state/store';
import { initSpeech, stopSpeech } from './src/services/speech';
import { initAudio } from './src/services/sfx';
import { initBackButton } from './src/services/backButton';
import { Home, Setup } from './src/screens/Home';
import { Placement, Play } from './src/screens/Play';
import { MapScreen } from './src/screens/Map';
import { NotebookView, Notebooks, Shop } from './src/screens/Stickers';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Router() {
  const r = useRoute();
  const depth = useStore((s) => s.stack.length);
  const hasProfile = useStore((s) => !!s.currentId);
  useEffect(() => stopSpeech, [r]);
  if (!hasProfile && r.name !== 'setup') return <Setup />;
  switch (r.name) {
    case 'setup': return <Setup />;
    case 'home': return <Home />;
    case 'map': return <MapScreen />;
    case 'play': return <Play key={`${depth}:${r.game}`} game={r.game} />;
    case 'placement': return <Placement />;
    case 'notebooks': return <Notebooks />;
    case 'notebook': return <NotebookView key={r.id} id={r.id} open={r.open} />;
    case 'shop': return <Shop />;
  }
}

export default function App() {
  const [fonts, fontError] = useFonts({ NotoSansHebrew_500Medium, NotoSansHebrew_700Bold, NotoSerifHebrew_700Bold, Rubik_500Medium, Rubik_700Bold, Rubik_800ExtraBold, DanaYad: require('./assets/fonts/DanaYadAlefAlefAlef-Normal.otf') });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    initAudio();
    initSpeech();
    hydrate().then(() => { initBackButton(); setReady(true); });
    if (Platform.OS === 'web') (globalThis as any).__butz = { getState, go };
  }, []);
  const loaded = ready && (fonts || !!fontError);
  useEffect(() => { if (loaded) SplashScreen.hideAsync().catch(() => undefined); }, [loaded]);
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      {/* Layout is forced LTR so ROW = 'row-reverse' always lays out right-to-left, whatever the device locale. */}
      <View style={{ flex: 1, direction: 'ltr' }}>
        <StatusBar style="dark" />
        <Router />
      </View>
    </SafeAreaProvider>
  );
}
